import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sortClientsByPriority } from '@/lib/scoring'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const stage = searchParams.get('stage')
  const search = searchParams.get('search')
  const prioritized = searchParams.get('prioritized') === 'true'

  let query = supabase.from('clients').select('*').order('updated_at', { ascending: false })

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

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  const { data, error } = await supabase
    .from('clients')
    .insert(body)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Log timeline event
  await supabase.from('timeline_events').insert({
    client_id: data.id,
    event_type: 'created',
    description: 'Client added to JARVIS',
    created_by: 'Diego',
  })

  return NextResponse.json(data, { status: 201 })
}
