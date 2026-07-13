import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isTeamVa } from '@/lib/team'

// List / create VA time entries. Access gating is UI-only (see plan) — va_id
// comes from the client.

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const vaId = searchParams.get('va_id')
  const paidParam = searchParams.get('paid') // 'true' | 'false' | null (all)

  let query = supabase
    .from('team_time_entries')
    .select('*, client:clients(id, name, business_name)')
    .order('created_at', { ascending: false })
    .limit(500)

  if (vaId) query = query.eq('va_id', vaId)
  if (paidParam === 'true') query = query.eq('paid', true)
  if (paidParam === 'false') query = query.eq('paid', false)

  const { data, error } = await query
  if (error) return NextResponse.json([]) // table may not exist yet — empty state
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()

  if (!isTeamVa(body.va_id)) {
    return NextResponse.json({ error: 'valid va_id required' }, { status: 400 })
  }

  const row: Record<string, unknown> = {
    va_id: body.va_id,
    description: body.description ?? null,
    is_standard: body.is_standard ?? false,
    client_id: body.client_id ?? null,
    assigned_at: body.assigned_at ?? null,
    status: 'idle',
    accumulated_seconds: 0,
  }

  const { data, error } = await supabase
    .from('team_time_entries')
    .insert(row)
    .select('*, client:clients(id, name, business_name)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
