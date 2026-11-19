import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callerIsAdmin } from '@/lib/auth-server'
import { isValidEvent } from '@/lib/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SELECT =
  'id, event, url, description, enabled, last_status, last_delivered_at, last_error, created_at, updated_at'

// Update an endpoint — toggle enabled, edit url/description, or rotate the
// secret. Admin only. A `secret` of '' clears it; omitting `secret` leaves it.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await callerIsAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const body = await req.json()

  const update: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (typeof body.url === 'string') {
    const url = body.url.trim()
    if (!/^https?:\/\/.+/i.test(url)) return NextResponse.json({ error: 'A valid http(s) URL is required' }, { status: 400 })
    update.url = url
  }
  if (typeof body.description === 'string') update.description = body.description.trim() || null
  if (body.event !== undefined && isValidEvent(body.event)) update.event = body.event
  if (body.enabled !== undefined) update.enabled = !!body.enabled
  if (typeof body.secret === 'string') update.secret = body.secret.trim() || null

  const supabase = await createClient()
  const { data, error } = await supabase.from('webhook_endpoints').update(update).eq('id', id).select(SELECT).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await callerIsAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from('webhook_endpoints').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
