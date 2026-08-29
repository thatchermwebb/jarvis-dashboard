import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callerIsAdmin, getServerUser } from '@/lib/auth-server'
import { sendOpsSlack } from '@/lib/slack'
import type { TeamTimeEntry } from '@/types'

// Timer state machine + edits for a single entry.
// PATCH body: { action: 'start'|'pause'|'resume'|'complete' } OR field edits
// ({ description, is_standard, worked_minutes }).

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const body = await req.json()

  // Field edits (no action) — description / standard toggle / retroactive time
  if (!body.action) {
    const patch: Record<string, unknown> = {}
    if (body.description !== undefined) patch.description = body.description
    if (body.is_standard !== undefined) patch.is_standard = body.is_standard
    // Retroactive worked-time correction (admins only). Freezes any live
    // segment so the edited value sticks instead of continuing to accrue.
    if (body.worked_minutes !== undefined) {
      if (!(await callerIsAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      patch.accumulated_seconds = Math.max(0, Math.round(Number(body.worked_minutes) * 60))
      patch.running_since = null
    }
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

  // Pipeline handoff when Wilson completes an ads task: ping Samuel on Slack so
  // he knows the ad is ready (no more manual "done" messages), and auto-create
  // his onboarding task on the board.
  if (body.action === 'complete' && e.va_id === 'wilson' && e.is_standard) {
    const clientName = (data as { client?: { name?: string } })?.client?.name
    const label = clientName ?? e.description ?? 'the ads'

    // Awaited so the send completes before the serverless function returns.
    await sendOpsSlack(`✅ *Ads complete* — Wilson finished ${clientName ? `ads for *${clientName}*` : `*${label}*`}. Ready for Samuel to onboard. 🚀`)

    // Auto-create Samuel's onboarding task, assigned now (KPI anchor), deduped.
    if (e.assigned_at && e.client_id) {
      const { data: existing } = await supabase
        .from('team_time_entries')
        .select('id')
        .eq('va_id', 'samuel')
        .eq('client_id', e.client_id)
        .neq('status', 'completed')
        .limit(1)
      if (!existing || existing.length === 0) {
        await supabase.from('team_time_entries').insert({
          va_id: 'samuel',
          description: `${clientName ?? 'Client'} — Onboarding`,
          is_standard: true,
          client_id: e.client_id,
          assigned_at: nowIso,
          status: 'idle',
          accumulated_seconds: 0,
        })
      }
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params

  // Admins may delete any entry; a VA may delete their own time entries.
  const user = await getServerUser()
  if (user?.userType !== 'admin') {
    const { data: entry } = await supabase
      .from('team_time_entries').select('va_id').eq('id', id).maybeSingle()
    const ownsIt = user?.userType === 'va' && !!entry && entry.va_id === user.id
    if (!ownsIt) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { error } = await supabase.from('team_time_entries').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
