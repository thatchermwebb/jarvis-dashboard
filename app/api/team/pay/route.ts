import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isTeamVa } from '@/lib/team'

// Mark all of a VA's unpaid, completed entries as paid — the pay-out reset.
// Only completed entries are paid out (an in-progress task keeps its timer).

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  if (!isTeamVa(body.va_id)) {
    return NextResponse.json({ error: 'valid va_id required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('team_time_entries')
    .update({ paid: true, paid_at: new Date().toISOString() })
    .eq('va_id', body.va_id)
    .eq('paid', false)
    .eq('status', 'completed')
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, paid_count: data?.length ?? 0 })
}
