import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')
  const status = searchParams.get('status')

  let query = supabase
    .from('payments')
    .select('*, client:clients(id, name, business_name)')
    .order('due_date', { ascending: true })

  if (clientId) query = query.eq('client_id', clientId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  // Auto-mark overdue on creation if past due
  if (body.status === 'pending' && body.due_date && new Date(body.due_date) < new Date()) {
    body.status = 'overdue'
  }

  const { data, error } = await supabase.from('payments').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
