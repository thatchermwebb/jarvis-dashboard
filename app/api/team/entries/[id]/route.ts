import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { TeamTimeEntry } from '@/types'

// Timer state machine + edits for a single entry.
// PATCH body: { action: 'start'|'pause'|'resume'|'complete' } OR field edits
// ({ description, is_standard }).

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const body = await req.json()

  // Field edits (no action) — description / standard toggle
  if (!body.action) {
    const patch: Record<string, unknown> = {}
    if (body.description !== undefined) patch.description = body.description
    if (body.is_standard !== undefined) patch.is_standard = body.is_standard
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'nothing to update' }, { status: 400 })
    const { data, error } = await supabase
      .from('team_time_entries').update(patch).eq('id', id)
      .select('*, client:clients(id, name, business_name)').single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Load current state to advance the timer correctly
  const { data: current, error: loadErr } = await supabase
    .from('team_time_entries').select('*').eq('id', id).single()
  if (loadErr || !current) return NextResponse.json({ error: 'entry not found' }, { status: 404 })
  const e = current as TeamTimeEntry

  const now = new Date()
  const nowIso = now.toISOString()
  const patch: Record<string, unknown> = {}

  // Fold the currently-running segment into accumulated seconds.
  const foldRunning = () => {
    if (e.status === 'running' && e.running_since) {
      const secs = Math.max(0, Math.floor((now.getTime() - Date.parse(e.running_since)) / 1000))
      patch.accumulated_seconds = (e.accumulated_seconds ?? 0) + secs
    }
    patch.running_since = null
  }

  switch (body.action) {
    case 'start':
    case 'resume':
      if (e.status === 'completed') return NextResponse.json({ error: 'entry already completed' }, { status: 400 })
      patch.status = 'running'
      patch.running_since = nowIso
      if (!e.started_at) patch.started_at = nowIso
      break
    case 'pause':
      foldRunning()
      patch.status = 'paused'
      break
    case 'complete':
      foldRunning()
      patch.status = 'completed'
      patch.completed_at = nowIso
      break
    default:
      return NextResponse.json({ error: `unknown action: ${body.action}` }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('team_time_entries').update(patch).eq('id', id)
    .select('*, client:clients(id, name, business_name)').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-chain the pipeline handoff: completing Wilson's fulfillment ads task
  // hands off to Samuel — create his onboarding task, assigned right now.
  if (
    body.action === 'complete' &&
    e.va_id === 'wilson' && e.is_standard && e.assigned_at && e.client_id
  ) {
    // Dedupe: skip if Samuel already has an open onboarding task for this client
    const { data: existing } = await supabase
      .from('team_time_entries')
      .select('id')
      .eq('va_id', 'samuel')
      .eq('client_id', e.client_id)
      .neq('status', 'completed')
      .limit(1)
    if (!existing || existing.length === 0) {
      const clientName = (data as { client?: { name?: string } })?.client?.name ?? 'Client'
      await supabase.from('team_time_entries').insert({
        va_id: 'samuel',
        description: `${clientName} — Onboarding`,
        is_standard: true,
        client_id: e.client_id,
        assigned_at: nowIso,
        status: 'idle',
        accumulated_seconds: 0,
      })
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const { error } = await supabase.from('team_time_entries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
