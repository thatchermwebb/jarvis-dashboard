import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callerCanAccessClient } from '@/lib/auth-server'

/**
 * Void every future unpaid invoice (pending/overdue, due today or later) for a
 * client. Intended for churned/paused clients — stops them appearing in upcoming
 * & projected revenue. Mirrors the schedule "cancel" void semantics.
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { client_id } = await req.json()
  if (!client_id) return NextResponse.json({ error: 'client_id required' }, { status: 400 })
  if (!(await callerCanAccessClient(supabase, client_id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Only allowed for churned/paused clients — a safety guard mirroring the UI.
  const { data: client } = await supabase.from('clients').select('stage').eq('id', client_id).maybeSingle()
  if (!client || (client.stage !== 'churned' && client.stage !== 'paused')) {
    return NextResponse.json({ error: 'Client is not churned or paused' }, { status: 400 })
  }

  const today = new Date().toISOString().split('T')[0]
  const { data, error } = await supabase
    .from('payments')
    .update({ status: 'voided' })
    .eq('client_id', client_id)
    .in('status', ['pending', 'overdue'])
    .gte('due_date', today)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, voided: data?.length ?? 0 })
}
