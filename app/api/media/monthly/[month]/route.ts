import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerUser } from '@/lib/auth-server'
import { isMonthKey } from '@/lib/media'

const STATUSES = new Set(['ads_produced', 'completed'])

// One month's page: every client, their advertised package, and this month's
// status for each.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ month: string }> }) {
  const { month } = await params
  if (!isMonthKey(month)) return NextResponse.json({ error: 'Invalid month' }, { status: 400 })
  const supabase = await createClient()

  const [pageRes, clientsRes, updatesRes] = await Promise.all([
    supabase.from('media_monthly_pages').select('*').eq('month', month).maybeSingle(),
    supabase
      .from('clients')
      .select('id, name, business_name, market_location, stage, advertised_package')
      .order('name', { ascending: true }),
    supabase.from('media_monthly_updates').select('*').eq('month', month),
  ])

  if (pageRes.error) return NextResponse.json({ error: pageRes.error.message }, { status: 500 })
  if (!pageRes.data) return NextResponse.json({ error: 'Page not found' }, { status: 404 })
  if (clientsRes.error) return NextResponse.json({ error: clientsRes.error.message }, { status: 500 })

  const updateByClient: Record<string, { status: string | null; updated_by: string | null; updated_at: string | null }> = {}
  for (const u of updatesRes.data ?? []) updateByClient[u.client_id] = u

  const clients = (clientsRes.data ?? []).map(c => ({
    ...c,
    status: updateByClient[c.id]?.status ?? null,
    updated_by: updateByClient[c.id]?.updated_by ?? null,
    updated_at: updateByClient[c.id]?.updated_at ?? null,
  }))

  return NextResponse.json({ month, clients })
}

// Set (or clear) one client's status for the month.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ month: string }> }) {
  const { month } = await params
  if (!isMonthKey(month)) return NextResponse.json({ error: 'Invalid month' }, { status: 400 })
  const { client_id, status } = await req.json()
  if (typeof client_id !== 'string' || !client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
  if (status !== null && !STATUSES.has(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const user = await getServerUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('media_monthly_updates')
    .upsert(
      { month, client_id, status, updated_by: user?.name ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'month,client_id' },
    )
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
