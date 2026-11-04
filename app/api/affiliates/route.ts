import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callerIsAdmin } from '@/lib/auth-server'

export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase.from('affiliates').select('*').order('name')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { name } = await req.json()
  if (!name?.trim()) return NextResponse.json({ error: 'Name required' }, { status: 400 })

  const initials = name.trim()
    .split(/\s+/)
    .map((w: string) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  const { data, error } = await supabase
    .from('affiliates')
    .insert({ name: name.trim(), initials })
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

// Edit an affiliate's commission rate (admin only).
export async function PATCH(req: NextRequest) {
  if (!(await callerIsAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = await createClient()
  const { id, commission_rate } = await req.json()
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const rate = Number(commission_rate)
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) {
    return NextResponse.json({ error: 'commission_rate must be 0–100' }, { status: 400 })
  }
  const { data, error } = await supabase
    .from('affiliates')
    .update({ commission_rate: rate })
    .eq('id', id)
    .select()
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
