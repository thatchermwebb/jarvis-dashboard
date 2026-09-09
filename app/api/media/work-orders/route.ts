import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Wilson's production queue (optionally filtered by status).
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const status = new URL(req.url).searchParams.get('status')
  let query = supabase
    .from('media_work_orders')
    .select('*, client:clients(id, name, business_name, advertised_package)')
    .order('created_at', { ascending: true })
  if (status && status !== 'all') query = query.eq('status', status)
  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
