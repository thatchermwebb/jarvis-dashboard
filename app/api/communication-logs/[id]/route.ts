import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callerCanAccessClient } from '@/lib/auth-server'

/** 403 unless the caller may write to the client this log belongs to. */
async function guardLog(supabase: Awaited<ReturnType<typeof createClient>>, id: string): Promise<boolean> {
  const { data } = await supabase.from('communication_logs').select('client_id').eq('id', id).maybeSingle()
  return callerCanAccessClient(supabase, data?.client_id)
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  if (!(await guardLog(supabase, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()

  const { data, error } = await supabase
    .from('communication_logs')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Sync client record with updated log fields
  if (data?.client_id) {
    const clientUpdate: Record<string, unknown> = {}
    if (body.followup_date !== undefined) clientUpdate.next_followup_date = body.followup_date || null
    if (body.followup_time !== undefined) clientUpdate.next_followup_time = body.followup_time || null
    if (body.sentiment) clientUpdate.last_client_sentiment = body.sentiment
    if (body.next_step) clientUpdate.followup_reason = body.next_step
    if (body.promises_made) clientUpdate.promises_made = body.promises_made
    if (Object.keys(clientUpdate).length > 0) {
      await supabase.from('clients').update(clientUpdate).eq('id', data.client_id)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  if (!(await guardLog(supabase, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('communication_logs').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
