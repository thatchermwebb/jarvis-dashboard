import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const FIELDS = new Set(['slot', 'name', 'service_type', 'price_point', 'angle', 'video_link', 'creative', 'cpl', 'rating', 'status', 'launched_at', 'retired_at'])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const raw = await req.json()
  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) if (FIELDS.has(k)) patch[k] = v
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
  const { data, error } = await supabase.from('media_ads').update(patch).eq('id', id).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from('media_ads').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
