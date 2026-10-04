import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAffiliateScope } from '@/lib/auth-server'

// Clients flagged "Running in Luna" — we pay their ad-spend and bill them a
// recurring subscription. Only flagged clients are returned.
export async function GET() {
  const supabase = await createClient()
  // select('*') so the page keeps working whether or not the newest luna_* columns
  // have been migrated yet (admin-gated page, so the full record is acceptable).
  let query = supabase
    .from('clients')
    .select('*')
    .eq('running_in_luna', true)
    .order('name', { ascending: true })

  // Associates only ever see their own affiliated book.
  const scope = await getAffiliateScope()
  if (scope) query = query.eq('affiliate_id', scope)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
