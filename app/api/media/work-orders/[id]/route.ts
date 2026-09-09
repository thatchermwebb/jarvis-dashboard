import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerUser } from '@/lib/auth-server'
import type { MediaWorkOrder } from '@/types'

// Transitions: start → in_production, produced (+video), launch (auto slot-swap),
// or plain field edits (spec). DELETE cancels an order.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const user = await getServerUser()
  const body = await req.json()
  const nowIso = new Date().toISOString()

  const { data: current } = await supabase.from('media_work_orders').select('*').eq('id', id).single()
  if (!current) return NextResponse.json({ error: 'work order not found' }, { status: 404 })
  const wo = current as MediaWorkOrder

  // Field edits (no action) — adjust the spec.
  if (!body.action) {
    const patch: Record<string, unknown> = {}
    for (const k of ['service_type', 'price_point', 'angle', 'notes', 'video_link']) {
      if (body[k] !== undefined) patch[k] = body[k]
    }
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
    const { data, error } = await supabase.from('media_work_orders').update(patch).eq('id', id)
      .select('*, client:clients(id, name, business_name)').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  const patch: Record<string, unknown> = {}
  switch (body.action) {
    case 'start':
      patch.status = 'in_production'
      patch.produced_by = user?.name ?? 'Wilson'
      break
    case 'produced':
      patch.status = 'produced'
      patch.produced_by = wo.produced_by ?? user?.name ?? 'Wilson'
      patch.produced_at = nowIso
      if (body.video_link !== undefined) patch.video_link = body.video_link
      break
    case 'launch': {
      // Auto slot-swap: retire the ad in the target slot, install the new one,
      // keep both in history (launched_at / retired_at).
      const slot = wo.replaces_slot ?? null
      const videoLink = body.video_link ?? wo.video_link ?? null
      // Default to the engine-assigned creative; Samuel can still override.
      const creative = (body.creative ?? wo.target_creative ?? null) || null
      const { data: newAd, error: adErr } = await supabase.from('media_ads').insert({
        client_id: wo.client_id,
        slot,
        name: body.name ?? null,
        service_type: wo.service_type ?? null,
        price_point: wo.price_point ?? null,
        angle: wo.angle ?? null,
        creative,
        video_link: videoLink,
        status: 'active',
        work_order_id: wo.id,
        launched_at: nowIso,
      }).select().single()
      if (adErr) return NextResponse.json({ error: adErr.message }, { status: 500 })

      // Auto-register the creative in the library if it's new.
      if (creative) {
        await supabase.from('media_creatives').upsert({ code: creative, created_by: 'auto' }, { onConflict: 'code', ignoreDuplicates: true })
      }

      if (slot) {
        await supabase.from('media_ads')
          .update({ status: 'retired', retired_at: nowIso, slot: null })
          .eq('client_id', wo.client_id).eq('slot', slot).neq('id', newAd.id)
          .in('status', ['active', 'paused'])
      }
      patch.status = 'done'
      patch.produced_ad_id = newAd.id
      patch.uploaded_by = user?.name ?? 'Samuel'
      patch.uploaded_at = nowIso
      if (videoLink) patch.video_link = videoLink
      break
    }
    default:
      return NextResponse.json({ error: `unknown action: ${body.action}` }, { status: 400 })
  }

  const { data, error } = await supabase.from('media_work_orders').update(patch).eq('id', id)
    .select('*, client:clients(id, name, business_name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from('media_work_orders').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
