import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAffiliateScope, callerIsReadOnly } from '@/lib/auth-server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')

  // Associates only see logs belonging to their own affiliated clients.
  const scope = await getAffiliateScope()
  const clientJoin = scope
    ? 'client:clients!inner(id, name, business_name, affiliate_id)'
    : 'client:clients(id, name, business_name)'

  let query = supabase
    .from('communication_logs')
    .select(`*, ${clientJoin}`)
    .order('created_at', { ascending: false })
    .limit(100)

  if (scope) query = query.eq('client.affiliate_id', scope)
  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  if (await callerIsReadOnly()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = await createClient()
  const body = await req.json()

  const { data: log, error } = await supabase
    .from('communication_logs')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Update client with last contact info
  const clientUpdate: Record<string, unknown> = {
    last_contact_date: new Date().toISOString(),
    last_contact_method: body.log_type,
    last_call_outcome: body.outcome,
  }
  if (body.summary) clientUpdate.last_call_summary = body.summary
  if (body.sentiment) clientUpdate.last_client_sentiment = body.sentiment
  if (body.followup_date) clientUpdate.next_followup_date = body.followup_date
  if (body.followup_time) clientUpdate.next_followup_time = body.followup_time
  if (body.next_step) clientUpdate.followup_reason = body.next_step
  if (body.promises_made) clientUpdate.promises_made = body.promises_made
  if (body.objections) clientUpdate.objections = body.objections

  await supabase.from('clients').update(clientUpdate).eq('id', body.client_id)

  // Add timeline event
  const outcomeLabel = body.outcome ? ` — ${body.outcome}` : ''
  await supabase.from('timeline_events').insert({
    client_id: body.client_id,
    event_type: body.log_type ?? 'note',
    description: `${body.log_type ?? 'Note'}${outcomeLabel}${body.summary ? ': ' + body.summary : ''}`,
    created_by: body.created_by ?? 'Diego',
  })

  return NextResponse.json(log, { status: 201 })
}
