import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerUser } from '@/lib/auth-server'
import { sendOpsSlack } from '@/lib/slack'
import { decide, weekMonday, DECISION_LABEL } from '@/lib/media'
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
  await supabase.from('media_work_orders').delete().eq('review_id', review.id).eq('status', 'todo')

  let ordersCreated = 0
  if (m.ordersToCreate.length) {
    // Spec defaults: inherit from the ad being replaced, else the client's package.
    const { data: clientRow } = await supabase
      .from('clients').select('advertised_package').eq('id', body.client_id).single()
    const { data: existingAds } = await supabase
      .from('media_ads').select('*').eq('client_id', body.client_id).in('status', ['active', 'paused'])
    const bySlot: Record<number, MediaAd> = {}
    for (const a of (existingAds ?? []) as MediaAd[]) if (a.slot) bySlot[a.slot] = a

    const orders = m.ordersToCreate.map(slot => {
      const prev = bySlot[slot]
      return {
        client_id: body.client_id,
        review_id: review.id,
        replaces_slot: slot,
        service_type: prev?.service_type ?? null,
        price_point: prev?.price_point ?? null,
        angle: null,
        notes: prev ? `Replace ${prev.name ?? 'ad'} (slot ${slot})` : (clientRow?.advertised_package ?? null),
        status: 'todo',
      }
    })
    const { error: woErr } = await supabase.from('media_work_orders').insert(orders)
    if (woErr) return NextResponse.json({ error: woErr.message }, { status: 500 })
    ordersCreated = orders.length

    const name = (review as { client?: { name?: string } })?.client?.name ?? 'a client'
    await sendOpsSlack(`🎬 *New ad work order${ordersCreated > 1 ? 's' : ''}* for *${name}* — ${DECISION_LABEL[m.decision]}. ${ordersCreated} ad${ordersCreated > 1 ? 's' : ''} for Wilson to produce.`)
  }

  return NextResponse.json({ review, decision: m.decision, winner_slot: m.winnerSlot, orders_created: ordersCreated })
}
