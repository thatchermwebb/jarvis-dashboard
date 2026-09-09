import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callerIsAdmin } from '@/lib/auth-server'

const FIELDS = new Set(['code', 'name', 'notes', 'status'])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await callerIsAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const supabase = await createClient()
  const raw = await req.json()
  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) if (FIELDS.has(k)) patch[k] = typeof v === 'string' ? v.trim() || null : v
  if (!Object.keys(patch).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })

  const { data, error } = await supabase.from('media_creatives').update(patch).eq('id', id).select().single()
  if (error) {
    if (/duplicate|unique/i.test(error.message)) return NextResponse.json({ error: 'That code already exists' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await callerIsAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const supabase = await createClient()
  const { error } = await supabase.from('media_creatives').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
