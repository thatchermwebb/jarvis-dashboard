import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAffiliateScope } from '@/lib/auth-server'

// Keep in sync with ../route.ts
const NON_COMMISSIONABLE = new Set(['voided', 'waived'])
const COMMISSION_START = '2026-11-01'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * Count of commissions that are owed right now — due today or overdue, and not
 * yet paid out. Drives the sidebar red dot and the on-open notification.
 * Admins see every affiliate's clients; an associate sees only their own.
 */
export async function GET() {
  const supabase = await createClient()
  const scope = await getAffiliateScope()
  const today = todayStr()

  let q = supabase
    .from('payments')
    .select('id, status, client:clients!inner(affiliate_id)')
    .gte('due_date', COMMISSION_START)
    .lte('due_date', today)
    .not('client.affiliate_id', 'is', null)
  if (scope) q = q.eq('client.affiliate_id', scope)

  const { data, error } = await q
  if (error) return NextResponse.json({ count: 0 })

  const commissionable = (data ?? []).filter(p => !NON_COMMISSIONABLE.has(p.status as string))
  const ids = commissionable.map(p => p.id)
  const { data: paidRows } = ids.length
    ? await supabase.from('affiliate_commission_payouts').select('payment_id').in('payment_id', ids)
    : { data: [] as { payment_id: string }[] }
  const paid = new Set((paidRows ?? []).map(r => r.payment_id))

  const count = commissionable.filter(p => !paid.has(p.id)).length
  return NextResponse.json({ count })
}
