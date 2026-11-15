import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getAffiliateScope } from '@/lib/auth-server'
import { COMMISSION_START, CLIENT_PAID_STATUSES, COMMISSION_EXCLUDED_AFFILIATES } from '@/lib/commissions'

/**
 * Count of commissions that are actually owed right now — the client has paid
 * the invoice (so the commission is earned) but the affiliate hasn't been paid
 * out yet. Unpaid/overdue invoices don't count: a commission only becomes due
 * once the money is collected. Drives the sidebar red dot and the on-open
 * notification. Admins see every affiliate's clients; an associate only theirs.
 */
export async function GET() {
  const supabase = await createClient()
  const scope = await getAffiliateScope()

  // An affiliate scoped to a non-commission affiliate has nothing owed.
  if (scope && COMMISSION_EXCLUDED_AFFILIATES.has(scope)) return NextResponse.json({ count: 0 })

  let q = supabase
    .from('payments')
    .select('id, status, client:clients!inner(affiliate_id)')
    .gte('due_date', COMMISSION_START)
    .in('status', [...CLIENT_PAID_STATUSES]) // only once the client has actually paid
    .not('client.affiliate_id', 'is', null)
  if (scope) q = q.eq('client.affiliate_id', scope)

  const { data, error } = await q
  if (error) return NextResponse.json({ count: 0 })

  const commissionable = (data ?? []).filter(p => {
    const affId = (p.client as unknown as { affiliate_id?: string } | null)?.affiliate_id
    return !affId || !COMMISSION_EXCLUDED_AFFILIATES.has(affId)
  })
  const ids = commissionable.map(p => p.id)
  const { data: paidRows } = ids.length
    ? await supabase.from('affiliate_commission_payouts').select('payment_id').in('payment_id', ids)
    : { data: [] as { payment_id: string }[] }
  const paid = new Set((paidRows ?? []).map(r => r.payment_id))

  const count = commissionable.filter(p => !paid.has(p.id)).length
  return NextResponse.json({ count })
}
