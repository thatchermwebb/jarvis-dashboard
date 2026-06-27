import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')
  const status = searchParams.get('status')

  const assignedTo = searchParams.get('assigned_to')

  let query = supabase
    .from('tasks')
    .select('*, client:clients(id, name, stage)')
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)
  if (status) query = query.eq('status', status)
  if (assignedTo) query = query.eq('assigned_to', assignedTo)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('tasks')
    .insert({
      title:       body.title       || null,
      task_type:   body.task_type   || null,
      client_id:   body.client_id   || null,
      assigned_to: body.assigned_to || null,
      due_date:    body.due_date    || null,
      notes:       body.notes       || null,
      status:      body.status      || 'open',
    })
    .select('*, client:clients(id, name, stage)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Only log timeline event when attached to a client
  if (body.client_id) {
    await supabase.from('timeline_events').insert({
      client_id:   body.client_id,
      event_type:  'task_created',
      description: `Task created: ${body.title || body.task_type?.replace(/_/g, ' ') || 'task'}`,
      created_by:  body.assigned_to || 'Diego',
    })
  }

  return NextResponse.json(data, { status: 201 })
}
