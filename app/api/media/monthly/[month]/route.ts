import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerUser } from '@/lib/auth-server'
import { isMonthKey } from '@/lib/media'

const STATUSES = new Set(['ads_produced', 'completed'])

// One month's page: every client, their advertised package, and this month's
// status + creatives for each (plus the creative library for the picker).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ month: string }> }) {
  const { month } = await params
  if (!isMonthKey(month)) return NextResponse.json({ error: 'Invalid month' }, { status: 400 })
  const supabase = await createClient()

  const [pageRes, clientsRes, updatesRes, creativesRes] = await Promise.all([
    supabase.from('media_monthly_pages').select('*').eq('month', month).maybeSingle(),
    supabase
      .from('clients')
      .select('id, name, business_name, market_location, stage, advertised_package')
      .order('name', { ascending: true }),
    supabase.from('media_monthly_updates').select('*').eq('month', month),
    supabase.from('media_creatives').select('code, name').eq('status', 'active').order('code', { ascending: true }),
  ])

  if (pageRes.error) return NextResponse.json({ error: pageRes.error.message }, { status: 500 })
  if (!pageRes.data) return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  if (clientsRes.error) return NextResponse.json({ error: clientsRes.error.message }, { status: 500 })

  const updateByClient: Record<string, { status: string | null; creatives: string[] | null; updated_by: string | null; updated_at: string | null }> = {}
  for (const u of updatesRes.data ?? []) updateByClient[u.client_id] = u

  const clients = (clientsRes.data ?? []).map(c => ({
    ...c,
    status: updateByClient[c.id]?.status ?? null,
    creatives: updateByClient[c.id]?.creatives ?? [],
    updated_by: updateByClient[c.id]?.updated_by ?? null,
    updated_at: updateByClient[c.id]?.updated_at ?? null,
  }))

  return NextResponse.json({ month, clients, creatives: creativesRes.data ?? [] })
}

// Set one client's status and/or creatives for the month. Only the fields
// sent are written, so saving creatives never clobbers the status (and vice versa).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ month: string }> }) {
  const { month } = await params
  if (!isMonthKey(month)) return NextResponse.json({ error: 'Invalid month' }, { status: 400 })
  const body = await req.json()
  const { client_id } = body
  if (typeof client_id !== 'string' || !client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if ('status' in body) {
    if (body.status !== null && !STATUSES.has(body.status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    patch.status = body.status
  }
  if ('creatives' in body) {
    if (!Array.isArray(body.creatives) || body.creatives.some((c: unknown) => typeof c !== 'string')) {
      return NextResponse.json({ error: 'creatives must be a list of codes' }, { status: 400 })
    }
    patch.creatives = [...new Set((body.creatives as string[]).map(c => c.trim()).filter(Boolean))]
  }
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  const user = await getServerUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('media_monthly_updates')
    .upsert(
      { month, client_id, ...patch, updated_by: user?.name ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'month,client_id' },
    )
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
