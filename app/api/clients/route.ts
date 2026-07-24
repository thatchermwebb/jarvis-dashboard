import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sortClientsByPriority } from '@/lib/scoring'
import { getAffiliateScope, callerIsReadOnly } from '@/lib/auth-server'

// Throttle the "expire old trials" write so it runs at most once per interval
// instead of firing a table-wide UPDATE scan on every single list load.
let lastTrialSweep = 0
const TRIAL_SWEEP_INTERVAL_MS = 5 * 60_000 // 5 minutes

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const stage = searchParams.get('stage')
  const search = searchParams.get('search')
  const prioritized = searchParams.get('prioritized') === 'true'

  // Auto-promote expired trials → trial_concluded, and expired signed
  // contracts → over (fire-and-forget, best effort, throttled)
  const now = Date.now()
  if (now - lastTrialSweep > TRIAL_SWEEP_INTERVAL_MS) {
    lastTrialSweep = now
    const today = new Date().toISOString().slice(0, 10)
    supabase
      .from('clients')
      .update({ stage: 'trial_concluded' })
      .in('stage', ['free_trial', 'free_trial_pending', 'trial_ending_soon'])
      .lt('trial_end', today)
      .then(() => {})

    supabase
      .from('clients')
      .update({ contract_status: 'over' })
      .eq('contract_status', 'signed')
      .lt('contract_end', today)
      .then(() => {})
  }

  let query = supabase.from('clients').select('*').order('updated_at', { ascending: false })

  // Associates only ever see their own affiliated book.
  const scope = await getAffiliateScope()
  if (scope) query = query.eq('affiliate_id', scope)

  if (stage) query = query.eq('stage', stage)
  if (search) {
    query = query.or(
      `name.ilike.%${search}%,business_name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`
    )
  }

  const { data, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const clients = prioritized ? sortClientsByPriority(data ?? []) : (data ?? [])
  return NextResponse.json(clients)
}

// Known valid DB columns — prevents unknown fields causing PostgREST errors
const CLIENT_FIELDS = new Set([
  'name','business_name','owner_name','phone','email','market_location','timezone',
  'stage','assigned_owner','assigned_va','assigned_closer','monthly_retainer',
  'payment_frequency','payment_status','deal_notes','trial_start','trial_end',
  'trial_health_score','close_probability','close_call_booked','trial_outcome',
  'trial_lost_reason','last_contact_date','last_contact_method','last_call_outcome',
  'last_call_summary','last_client_sentiment','next_followup_date','followup_reason',
  'suggested_message','promises_made','objections','client_concerns','ad_status',
  'new_ads','campaign_link','ad_account_link','budget','spend','leads','cpl',
  'bookings','cost_per_booking','best_ad','worst_ad','creative_status',
  'location_targeting','last_ad_change','next_ad_action','ghl_location_link',
  'ai_status','avg_ai_response_time','phone_numbers_collected','vehicle_info_collected',
  'area_collected','conversations_needing_human','missed_conversations','booking_rate',
  'crm_issue','churn_risk_score','risk_reason','save_action','thatcher_needed',
  'va_needed','trepp_needed','payment_issue','urgency_level','slack_thread','google_drive_folder',
  'advertised_package','affiliate_id','growth_stage',
  'contract_status','contract_start','contract_end',
  'contract_payment_count','contract_total_value',
])

export async function POST(req: NextRequest) {
  if (await callerIsReadOnly()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = await createClient()
  const raw = await req.json()

  // import_mode: true allows setting created_at to backdate the client
  const isImport = raw.import_mode === true
  const clientSince: string | undefined = typeof raw.client_since === 'string' && raw.client_since ? raw.client_since : undefined

  // Only pass known fields; convert empty strings to null
  const body: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    if (!CLIENT_FIELDS.has(k)) continue
    body[k] = (typeof v === 'string' && v.trim() === '') ? null : v
  }

  // Backdate created_at for imported existing clients
  if (isImport && clientSince) {
    body.created_at = new Date(clientSince + 'T00:00:00').toISOString()
  }

  const { data, error } = await supabase
    .from('clients')
    .insert(body)
    .select()
    .single()

  if (error) {
    console.error('Client insert error:', error)
    return NextResponse.json({ error: `${error.message} (${error.code})` }, { status: 500 })
  }

  // Log timeline event
  await supabase.from('timeline_events').insert({
    client_id: data.id,
    event_type: 'created',
    description: isImport ? 'Client imported (existing)' : 'Client added to JARVIS',
    created_by: 'Diego',
  })

  return NextResponse.json(data, { status: 201 })
}
