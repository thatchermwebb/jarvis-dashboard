import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAffiliateScope, callerIsReadOnly } from '@/lib/auth-server'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  let query = supabase
    .from('clients')
    .select('*, affiliate:affiliates(id, name, initials)')
    .eq('id', id)

  // Associates may only open clients in their own affiliated book — a direct
  // URL to someone else's client 404s rather than leaking the record.
  const scope = await getAffiliateScope()
  if (scope) query = query.eq('affiliate_id', scope)

  const { data, error } = await query.single()

  if (error) return NextResponse.json({ error: error.message }, { status: 404 })
  return NextResponse.json(data)
}

// Terminal "lost" stages — once a client lands here they have no open
// follow-up obligation, so any scheduled next step is cleared automatically.
const LOST_STAGES = new Set(['churned', 'free_trial_lost'])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await callerIsReadOnly()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()

  // Marking a client lost/churned wipes any future follow-up. (You can still
  // add one back later by logging a new note with a follow-up date.)
  if (typeof body.stage === 'string' && LOST_STAGES.has(body.stage)) {
    body.next_followup_date = null
    body.followup_reason = null
  }

  const { data, error } = await supabase
    .from('clients')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await callerIsReadOnly()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
