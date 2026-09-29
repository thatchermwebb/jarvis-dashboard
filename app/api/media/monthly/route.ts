import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerUser } from '@/lib/auth-server'
import { isMonthKey } from '@/lib/media'

// Monthly Ad Update pages (one per month), with completion counts.
export async function GET() {
  const supabase = await createClient()
  const [pagesRes, updatesRes] = await Promise.all([
    supabase.from('media_monthly_pages').select('*').order('month', { ascending: false }),
    supabase.from('media_monthly_updates').select('month, status'),
  ])
  if (pagesRes.error) return NextResponse.json({ error: pagesRes.error.message }, { status: 500 })

  const counts: Record<string, { ads_produced: number; completed: number }> = {}
  for (const u of updatesRes.data ?? []) {
    const c = (counts[u.month] ??= { ads_produced: 0, completed: 0 })
    if (u.status === 'ads_produced') c.ads_produced++
    if (u.status === 'completed') c.completed++
  }

  const pages = (pagesRes.data ?? []).map((p: { month: string }) => ({
    ...p,
    ...(counts[p.month] ?? { ads_produced: 0, completed: 0 }),
  }))
  return NextResponse.json({ pages })
}

export async function POST(req: NextRequest) {
  const { month } = await req.json()
  if (typeof month !== 'string' || !isMonthKey(month)) {
    return NextResponse.json({ error: 'month must be YYYY-MM' }, { status: 400 })
  }
  const user = await getServerUser()
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('media_monthly_pages')
    .insert({ month, created_by: user?.name ?? null })
    .select()
    .single()
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return NextResponse.json({ error: 'That month already exists' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}
