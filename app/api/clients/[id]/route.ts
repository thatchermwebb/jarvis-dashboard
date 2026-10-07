import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAffiliateScope, callerCanAccessClient, callerIsAdmin, getServerUser } from '@/lib/auth-server'
import { revenueHidden, CLIENT_MONEY_FIELDS } from '@/lib/auth'

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

  // Strip money figures for revenue-blind roles (appointment setters).
  if (data && revenueHidden(await getServerUser())) {
    for (const f of CLIENT_MONEY_FIELDS) delete (data as Record<string, unknown>)[f]
  }
  return NextResponse.json(data)
}

// Terminal "lost" stages — once a client lands here they have no open
// follow-up obligation, so any scheduled next step is cleared automatically.
const LOST_STAGES = new Set(['churned', 'free_trial_lost'])

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  // Affiliate-scoped users may only edit clients in their own book, and can't
  // reassign a client's affiliate out of it.
  if (!(await callerCanAccessClient(supabase, id))) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()
  if (await getAffiliateScope()) delete body.affiliate_id
  // Revenue-blind users never receive money fields, so never let them write them
  // either — otherwise an empty edit form would wipe real financials.
  if (revenueHidden(await getServerUser())) for (const f of CLIENT_MONEY_FIELDS) delete body[f]

  // Marking a client lost/churned wipes any future follow-up. (You can still
  // add one back later by logging a new note with a follow-up date.)
  if (typeof body.stage === 'string' && LOST_STAGES.has(body.stage)) {
    body.next_followup_date = null
    body.followup_reason = null
  }

  // Signing / re-signing: stamp signed_at to today whenever a client transitions
  // INTO active_client (from any other stage), so Deal Flow credits the day they
  // were actually signed — not just the very first time. A plain edit of an
  // already-active client (stage unchanged) never re-stamps. Use the caller's
  // local date (tz_today) so the signing lands on the right day in their timezone
  // rather than the server's UTC day.
  const tzToday = typeof body.tz_today === 'string' ? body.tz_today : null
  delete body.tz_today
  if (body.stage === 'active_client' && body.signed_at === undefined) {
    const { data: cur } = await supabase.from('clients').select('stage').eq('id', id).maybeSingle()
    if (cur && cur.stage !== 'active_client') {
      body.signed_at = tzToday ? `${tzToday}T12:00:00Z` : new Date().toISOString()
    }
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
  // Deleting a whole client record stays admin-only.
  if (!(await callerIsAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const supabase = await createClient()

  const { error } = await supabase.from('clients').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
