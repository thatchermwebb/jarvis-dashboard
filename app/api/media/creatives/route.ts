import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callerIsAdmin, getServerUser } from '@/lib/auth-server'
import { aggregateCreativeStats } from '@/lib/media-assign'
import type { MediaCreative, MediaCreativeStats } from '@/types'

// Admin-only Creative Library. GET returns every creative with its computed
// network performance; POST adds a new one.
export async function GET() {
  if (!(await callerIsAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = await createClient()

  const [creativesRes, adsRes] = await Promise.all([
    supabase.from('media_creatives').select('*').order('created_at', { ascending: false }),
    supabase.from('media_ads').select('creative, rating, cpl, status, client_id'),
  ])
  if (creativesRes.error) return NextResponse.json({ error: creativesRes.error.message }, { status: 500 })

  const stats = aggregateCreativeStats(adsRes.data ?? [])
  const rows: MediaCreativeStats[] = (creativesRes.data as MediaCreative[]).map(c => {
    const s = stats.get(c.code)
    return {
      ...c,
      deployments: s?.deployments ?? 0,
      good: s?.good ?? 0,
      decent: s?.decent ?? 0,
      bad: s?.bad ?? 0,
      avg_cpl: s?.avgCpl ?? null,
      score: s?.score ?? null,
      running_now: s?.runningNow ?? 0,
    }
  })
  return NextResponse.json(rows)
}

export async function POST(req: NextRequest) {
  if (!(await callerIsAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = await createClient()
  const user = await getServerUser()
  const body = await req.json()
  const code = (body.code ?? '').trim()
  if (!code) return NextResponse.json({ error: 'code is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('media_creatives')
    .insert({
      code,
      name: body.name?.trim() || null,
      notes: body.notes?.trim() || null,
      status: body.status === 'retired' ? 'retired' : 'active',
      created_by: user?.name ?? null,
    })
    .select()
    .single()
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return NextResponse.json({ error: `Creative "${code}" already exists` }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
