import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET ?client_id= — a client's ad library (active + retired, newest first).
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const clientId = new URL(req.url).searchParams.get('client_id')
  let query = supabase.from('media_ads').select('*, client:clients(id, name, business_name)')
  if (clientId) query = query.eq('client_id', clientId)
  const { data, error } = await query.order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// POST — add an ad to a client (used to seed the two current slots).
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const status = body.status ?? 'active'
  const { data, error } = await supabase
    .from('media_ads')
    .insert({
      client_id: body.client_id,
      slot: body.slot ?? null,
      name: body.name ?? null,
      service_type: body.service_type ?? null,
      price_point: body.price_point ?? null,
      angle: body.angle ?? null,
      video_link: body.video_link ?? null,
      creative: body.creative ?? null,
      cpl: body.cpl ?? null,
      rating: body.rating ?? null,
      status,
      launched_at: status === 'active' ? (body.launched_at ?? new Date().toISOString()) : null,
    })
    .select('*, client:clients(id, name, business_name)')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
