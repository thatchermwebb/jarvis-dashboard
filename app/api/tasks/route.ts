import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')
  const status = searchParams.get('status')

  let query = supabase
    .from('tasks')
    .select('*, client:clients(id, name, stage)')
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('tasks')
    .insert(body)
    .select('*, client:clients(id, name, stage)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Timeline event
  await supabase.from('timeline_events').insert({
    client_id: body.client_id,
    event_type: 'task_created',
    description: `VA task created: ${body.task_type?.replace(/_/g, ' ')}`,
    created_by: 'Diego',
  })

  return NextResponse.json(data, { status: 201 })
}
