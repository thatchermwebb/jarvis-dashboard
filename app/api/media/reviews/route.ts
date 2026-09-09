import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerUser } from '@/lib/auth-server'
import { decide, weekMonday } from '@/lib/media'
import { assignCreative, aggregateCreativeStats, type CreativeStat, type ClientCreativeHistory } from '@/lib/media-assign'
import type { AdRating, MediaAd } from '@/types'

// Submit Samuel's weekly review for one client. The matrix decides the move,
// losers are auto-paused, and Wilson's work orders are auto-created.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getServerUser()
  const body = await req.json() as {
    client_id?: string
    week?: string
    ad1?: { id?: string; rating?: AdRating; cpl?: number | null; creative?: string | null }
    ad2?: { id?: string; rating?: AdRating; cpl?: number | null; creative?: string | null }
    notes?: string
  }

  const r1 = body.ad1?.rating
  const r2 = body.ad2?.rating
  if (!body.client_id || !r1 || !r2) {
    return NextResponse.json({ error: 'client_id and both ad ratings are required' }, { status: 400 })
  }

  const week = body.week || weekMonday()
  const nowIso = new Date().toISOString()
  const m = decide(r1, r2)

  // Upsert the review (one per client per week).
  const { data: review, error: revErr } = await supabase
    .from('media_reviews')
    .upsert({
      client_id: body.client_id,
      week,
      reviewed_by: user?.name ?? 'Unknown',
      reviewed_at: nowIso,
      ad1_id: body.ad1?.id ?? null, ad1_rating: r1, ad1_cpl: body.ad1?.cpl ?? null, ad1_creative: body.ad1?.creative ?? null,
      ad2_id: body.ad2?.id ?? null, ad2_rating: r2, ad2_cpl: body.ad2?.cpl ?? null, ad2_creative: body.ad2?.creative ?? null,
      decision: m.decision, winner_slot: m.winnerSlot, notes: body.notes ?? null,
    }, { onConflict: 'client_id,week' })
    .select('*, client:clients(id, name, business_name)')
    .single()
  if (revErr) return NextResponse.json({ error: revErr.message }, { status: 500 })

  // Persist the ratings/creative onto the ad rows themselves.
  if (body.ad1?.id) await supabase.from('media_ads').update({ rating: r1, cpl: body.ad1.cpl ?? null, creative: body.ad1.creative ?? null }).eq('id', body.ad1.id)
  if (body.ad2?.id) await supabase.from('media_ads').update({ rating: r2, cpl: body.ad2.cpl ?? null, creative: body.ad2.creative ?? null }).eq('id', body.ad2.id)

  // "All spend to winner" → pause the losing active slot.
  if (m.winnerSlot) {
    const loserSlot = m.winnerSlot === 1 ? 2 : 1
    await supabase.from('media_ads')
      .update({ status: 'paused' })
      .eq('client_id', body.client_id).eq('slot', loserSlot).eq('status', 'active')
  }

  // Rebuild this review's outstanding work orders (avoid dupes on re-review).
  // Pull the ids first so we can also clear the not-yet-started Team-queue
  // entries they spawned (leave any Wilson has already started alone).
  const { data: staleOrders } = await supabase
    .from('media_work_orders').select('id').eq('review_id', review.id).eq('status', 'todo')
  const staleIds = (staleOrders ?? []).map(o => o.id)
  if (staleIds.length) {
    await supabase.from('team_time_entries')
      .delete().in('work_order_id', staleIds).is('started_at', null)
    await supabase.from('media_work_orders').delete().in('id', staleIds)
  }

  let ordersCreated = 0
  if (m.ordersToCreate.length) {
    // Gather everything the assignment engine needs: the client's package, the
    // active creative pool, network-wide performance, and this client's history.
    const [clientRes, poolRes, networkRes, clientAdsRes] = await Promise.all([
      supabase.from('clients').select('advertised_package').eq('id', body.client_id).single(),
      supabase.from('media_creatives').select('code').eq('status', 'active'),
      supabase.from('media_ads').select('creative, rating, cpl, status, client_id'),
      supabase.from('media_ads').select('creative, rating, status, slot, service_type, price_point').eq('client_id', body.client_id),
    ])

    const pkg = clientRes.data?.advertised_package ?? null
    const clientAds = (clientAdsRes.data ?? []) as MediaAd[]
    const bySlot: Record<number, MediaAd> = {}
    for (const a of clientAds) if (a.slot && (a.status === 'active' || a.status === 'paused')) bySlot[a.slot] = a

    // Per-creative network stats → the engine's pool.
    const stats = aggregateCreativeStats(networkRes.data ?? [])
    const pool: CreativeStat[] = (poolRes.data ?? []).map(c => {
      const s = stats.get(c.code)
      return {
        code: c.code,
        deployments: s?.deployments ?? 0,
        openCount: s?.openCount ?? 0,
        ratedCount: s?.ratedCount ?? 0,
        score: s?.score ?? null,
        avgCpl: s?.avgCpl ?? null,
      }
    })

    // This client's creative history (running now / known losers / ever run).
    const history: ClientCreativeHistory = { running: new Set(), bad: new Set(), everRan: new Set() }
    for (const a of clientAds) {
      if (!a.creative) continue
      history.everRan.add(a.creative)
      if (a.status === 'active' || a.status === 'paused') history.running.add(a.creative)
      if (a.rating === 'bad') history.bad.add(a.creative)
    }

    // Pick a distinct creative per order (fully automatic).
    const picked = new Set<string>()
    const orders = m.ordersToCreate.map(slot => {
      const prev = bySlot[slot]
      const target = assignCreative(pool, history, picked)
      if (target) picked.add(target)
      return {
        client_id: body.client_id,
        review_id: review.id,
        replaces_slot: slot,                 // internal: which slot the new ad fills
        service_type: prev?.service_type ?? null,
        price_point: prev?.price_point ?? null,
        angle: null,
        notes: pkg,                          // what to produce: the client's package
        target_creative: target,             // which creative the engine chose
        status: 'todo',
      }
    })
    const { data: createdOrders, error: woErr } = await supabase
      .from('media_work_orders').insert(orders).select('id, target_creative')
    if (woErr) return NextResponse.json({ error: woErr.message }, { status: 500 })
    ordersCreated = createdOrders?.length ?? 0

    // Drop each order into Wilson's Team queue as an assigned entry he can start
    // immediately. No per-order Slack ping (Samuel sends one summary when done);
    // completing the entry auto-advances the work order (see team entries PATCH).
    // The package resolves live at display time (Team page / Work Orders card); the
    // assigned creative is fixed, so it's baked into the description.
    const clientName = (review as { client?: { name?: string } })?.client?.name ?? 'Client'
    const nowIso = new Date().toISOString()
    const queueEntries = (createdOrders ?? []).map(o => ({
      va_id: 'wilson',
      description: o.target_creative ? `🎬 Produce ${o.target_creative} — ${clientName}` : `🎬 Produce ad — ${clientName}`,
      is_standard: true,
      client_id: body.client_id,
      assigned_at: nowIso,
      status: 'idle',
      accumulated_seconds: 0,
      work_order_id: o.id,
    }))
    if (queueEntries.length) await supabase.from('team_time_entries').insert(queueEntries)
  }

  return NextResponse.json({ review, decision: m.decision, winner_slot: m.winnerSlot, orders_created: ordersCreated })
}
