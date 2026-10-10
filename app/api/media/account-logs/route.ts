import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Structured account-review logs for the main Media Buying tracker.
// GET ?client_id=… → that client's log history (newest first).
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const clientId = new URL(req.url).searchParams.get('client_id')
  if (!clientId) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('media_account_logs')
    .select('*')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

const NUM = (v: unknown) => (v === '' || v == null ? null : Number(v))
const INT = (v: unknown) => (v === '' || v == null ? null : parseInt(String(v), 10))
const STR = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const b = await req.json()
  if (!b.client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('media_account_logs')
    .insert({
      client_id: b.client_id,
      created_by: STR(b.created_by),
      period_start: b.period_start || null,
      period_end: b.period_end || null,
      creatives: STR(b.creatives),
      leads: INT(b.leads),
      cpl: NUM(b.cpl),
      numbers_submitted: INT(b.numbers_submitted),
      booked: INT(b.booked),
      spend: NUM(b.spend),
      revenue: NUM(b.revenue),
      situation: STR(b.situation),
      verdict: STR(b.verdict),
      changes: STR(b.changes),
      follow_up_date: b.follow_up_date || null,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
