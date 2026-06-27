import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const body = await req.json()
  const { action, ...fields } = body

  // Update the schedule record itself
  const scheduleUpdate: Record<string, unknown> = { ...fields }
  if (action === 'cancel') scheduleUpdate.active = false
  if (action === 'pause')  scheduleUpdate.active = false

  const { error: schedErr } = await supabase
    .from('payment_schedules')
    .update(scheduleUpdate)
    .eq('id', id)

  if (schedErr) return NextResponse.json({ error: schedErr.message }, { status: 500 })

  // Cancel: void all future pending/overdue payments for this schedule
  if (action === 'cancel') {
    const today = new Date().toISOString().split('T')[0]
    const { error: payErr } = await supabase
      .from('payments')
      .update({ status: 'voided' })
      .eq('schedule_id', id)
      .in('status', ['pending', 'overdue'])
      .gte('due_date', today)

    if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()

  // Void all future pending payments first
  const today = new Date().toISOString().split('T')[0]
  await supabase
    .from('payments')
    .update({ status: 'voided' })
    .eq('schedule_id', id)
    .in('status', ['pending', 'overdue'])
    .gte('due_date', today)

  const { error } = await supabase.from('payment_schedules').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
