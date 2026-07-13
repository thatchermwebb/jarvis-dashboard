import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { addWeeks, addMonths, format, parseISO } from 'date-fns'

function generateDueDates(frequency: string, startDate: Date, endDate?: Date): Date[] {
  const dates: Date[] = []
  const end = endDate ?? addMonths(startDate, 12) // default: generate 12 months ahead
  let current = startDate

  while (current <= end) {
    dates.push(new Date(current))
    if (frequency === 'weekly') current = addWeeks(current, 1)
    else if (frequency === 'biweekly') current = addWeeks(current, 2)
    else if (frequency === 'monthly') current = addMonths(current, 1)
    else break // one_time: just the start date
  }

  return dates
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('payment_schedules')
    .select('*, client:clients(id, name, business_name, affiliate_id, affiliate:affiliates(id, name, initials))')
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  // Create the schedule
  const { data: schedule, error: schedErr } = await supabase
    .from('payment_schedules')
    .insert({
      client_id: body.client_id,
      label: body.label,
      payment_type: body.payment_type,
      amount: body.amount,
      frequency: body.frequency,
      start_date: body.start_date,
      end_date: body.end_date || null,
      notes: body.notes,
    })
    .select()
    .single()

  if (schedErr) return NextResponse.json({ error: schedErr.message }, { status: 500 })

  // Generate individual payment entries
  const startDate = parseISO(body.start_date)
  const endDate = body.end_date ? parseISO(body.end_date) : undefined
  const dueDates = generateDueDates(body.frequency, startDate, endDate)

  const today = new Date()
  const payments = dueDates.map((d) => ({
    client_id: body.client_id,
    schedule_id: schedule.id,
    payment_type: body.payment_type,
    amount: body.amount,
    due_date: format(d, 'yyyy-MM-dd'),
    status: d < today ? 'overdue' : 'pending',
  }))

  if (payments.length > 0) {
    const { error: payErr } = await supabase.from('payments').insert(payments)
    if (payErr) return NextResponse.json({ error: payErr.message }, { status: 500 })
  }

  return NextResponse.json({ schedule, payments_created: payments.length }, { status: 201 })
}
