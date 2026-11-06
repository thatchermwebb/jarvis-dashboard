import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerUser, getAffiliateScope } from '@/lib/auth-server'
import { buildClientsDocx } from '@/lib/export/clientDocx'
import type { ClientBundle, ExportClient } from '@/lib/export/clientNarrative'
import type { SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Fetch every row of a child table for a set of client ids, paginating past the
// PostgREST 1000-row cap so large exports never silently drop records.
async function fetchAll(
  supabase: SupabaseClient, table: string, clientIds: string[], order?: string,
): Promise<Record<string, unknown>[]> {
  if (clientIds.length === 0) return []
  const out: Record<string, unknown>[] = []
  const step = 1000
  for (let from = 0; ; from += step) {
    let q = supabase.from(table).select('*').in('client_id', clientIds).range(from, from + step - 1)
    if (order) q = q.order(order, { ascending: true })
    const { data, error } = await q
    if (error) break // table may not exist in every environment — skip gracefully
    out.push(...(data ?? []))
    if (!data || data.length < step) break
  }
  return out
}

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  // Full records carry financials and every note — restrict to revenue-trusted
  // roles. VAs and appointment setters can't export.
  if (!user || user.userType === 'va' || user.userType === 'setter') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { clientIds } = await req.json().catch(() => ({ clientIds: null }))
  if (!Array.isArray(clientIds) || clientIds.length === 0) {
    return NextResponse.json({ error: 'Select at least one client to export' }, { status: 400 })
  }
  if (clientIds.length > 100) {
    return NextResponse.json({ error: 'Export up to 100 clients at a time' }, { status: 400 })
  }

  const supabase = await createClient()
  const scope = await getAffiliateScope()

  // Clients (associates limited to their own book).
  let cq = supabase.from('clients').select('*').in('id', clientIds)
  if (scope) cq = cq.eq('affiliate_id', scope)
  const { data: clientsData, error: cErr } = await cq
  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 500 })
  const clients = (clientsData ?? []) as ExportClient[]
  if (clients.length === 0) return NextResponse.json({ error: 'No matching clients' }, { status: 404 })

  const ids = clients.map(c => c.id)

  // Every per-client table, in parallel, each fully paginated.
  const [
    payments, schedules, logs, timeline, tasks, closeBriefs,
    workOrders, reviews, accountLogs, adProductions, teamEntries, affiliatesData,
  ] = await Promise.all([
    fetchAll(supabase, 'payments', ids),
    fetchAll(supabase, 'payment_schedules', ids),
    fetchAll(supabase, 'communication_logs', ids),
    fetchAll(supabase, 'timeline_events', ids),
    fetchAll(supabase, 'tasks', ids),
    fetchAll(supabase, 'close_briefs', ids),
    fetchAll(supabase, 'media_work_orders', ids),
    fetchAll(supabase, 'media_reviews', ids),
    fetchAll(supabase, 'media_account_logs', ids),
    fetchAll(supabase, 'ad_productions', ids),
    fetchAll(supabase, 'team_time_entries', ids),
    supabase.from('affiliates').select('id, name'),
  ])

  const affiliateName = new Map<string, string>()
  for (const a of (affiliatesData.data ?? []) as { id: string; name: string }[]) affiliateName.set(a.id, a.name)

  const by = (rows: Record<string, unknown>[], cid: string) => rows.filter(r => r.client_id === cid)

  // Keep the order the user selected them in.
  const order = new Map(clientIds.map((id: string, i: number) => [id, i]))
  const sortedClients = [...clients].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))

  const bundles: ClientBundle[] = sortedClients.map(c => ({
    client: c,
    payments: by(payments, c.id),
    schedules: by(schedules, c.id),
    logs: by(logs, c.id),
    timeline: by(timeline, c.id),
    tasks: by(tasks, c.id),
    closeBriefs: by(closeBriefs, c.id),
    workOrders: by(workOrders, c.id),
    reviews: by(reviews, c.id),
    accountLogs: by(accountLogs, c.id),
    adProductions: by(adProductions, c.id),
    teamEntries: by(teamEntries, c.id),
    affiliateName: c.affiliate_id ? affiliateName.get(String(c.affiliate_id)) ?? null : null,
  }))

  const buffer = await buildClientsDocx(bundles, user.name)
  const stamp = new Date().toISOString().slice(0, 10)
  const filename = bundles.length === 1
    ? `cza-${String(bundles[0].client.business_name || bundles[0].client.name || 'client').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${stamp}.docx`
    : `cza-client-records-${bundles.length}-${stamp}.docx`

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
