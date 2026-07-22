import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAffiliateScope, callerIsReadOnly } from '@/lib/auth-server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')
  const status = searchParams.get('status')

  // Associates only see payments belonging to their own affiliated clients.
  // `!inner` makes the embedded client a join filter rather than a nullable side-load.
  const scope = await getAffiliateScope()
  const clientJoin = scope
    ? 'client:clients!inner(id, name, business_name, affiliate_id, affiliate:affiliates(id, name, initials))'
    : 'client:clients(id, name, business_name, affiliate_id, affiliate:affiliates(id, name, initials))'

  let query = supabase
    .from('payments')
    .select(`*, ${clientJoin}`)
    .order('due_date', { ascending: true })

  if (scope) query = query.eq('client.affiliate_id', scope)

  if (clientId) query = query.eq('client_id', clientId)
  if (status) query = query.eq('status', status)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  if (await callerIsReadOnly()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = await createClient()
  const body = await req.json()

  // Overdue only if due_date is strictly before today (yesterday or earlier)
  if (body.status === 'pending' && body.due_date) {
    const today = new Date(); today.setHours(0,0,0,0)
    const due = new Date(body.due_date + 'T00:00:00')
    if (due < today) body.status = 'overdue'
  }

  const { data, error } = await supabase.from('payments').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
