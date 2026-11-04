import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerUser, getAffiliateScope, callerIsAdmin } from '@/lib/auth-server'
import { currentMrr, isMrrActive } from '@/lib/analytics'
import type { CommissionLine, CommissionStatus } from '@/types'

function todayStr() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Payments that never generate a commission.
const NON_COMMISSIONABLE = new Set(['voided', 'waived'])

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const scope = await getAffiliateScope()
  const admin = await callerIsAdmin()

  const { data: affiliatesData } = await supabase.from('affiliates').select('*').order('name')
  const affiliates = affiliatesData ?? []

  // Which affiliate are we looking at? Associates are locked to their own.
  let affiliateId = searchParams.get('affiliate_id') || ''
  if (scope) affiliateId = scope
  if (!affiliateId && affiliates.length) affiliateId = affiliates[0].id

  const affiliate = affiliates.find(a => a.id === affiliateId) || null
  if (!affiliate) {
    return NextResponse.json({ affiliate: null, affiliates: admin ? affiliates : [], lines: [], mrr: 0, client_count: 0 })
  }
  // Default to 10% when unset (new affiliate, or column not yet migrated).
  const rate = affiliate.commission_rate == null ? 10 : Number(affiliate.commission_rate)

  // This affiliate's clients (for MRR + names).
  const { data: clientsData } = await supabase
    .from('clients')
    .select('id, name, business_name, monthly_retainer, stage, affiliate_id')
    .eq('affiliate_id', affiliateId)
  const clients = clientsData ?? []
  const clientName = (id: string) => {
    const c = clients.find(x => x.id === id)
    return c ? (c.business_name || c.name) : 'Unknown'
  }

  // Every payment belonging to those clients.
  const { data: paymentsData } = await supabase
    .from('payments')
    .select('id, client_id, payment_type, amount, due_date, paid_date, status, client:clients!inner(affiliate_id)')
    .eq('client.affiliate_id', affiliateId)
    .order('due_date', { ascending: true })
  const payments = (paymentsData ?? []) as unknown as {
    id: string; client_id: string; payment_type: string; amount: number
    due_date: string; paid_date: string | null; status: string
  }[]

  // Which commissions have been paid out.
  type Payout = { payment_id: string; paid_date: string; marked_by: string | null }
  const paymentIds = payments.map(p => p.id)
  const payoutsData: Payout[] = paymentIds.length
    ? ((await supabase.from('affiliate_commission_payouts').select('payment_id, paid_date, marked_by').in('payment_id', paymentIds)).data ?? [])
    : []
  const payouts = new Map(payoutsData.map(p => [p.payment_id, p]))

  const today = todayStr()
  const lines: CommissionLine[] = payments
    .filter(p => !NON_COMMISSIONABLE.has(p.status))
    .map(p => {
      const payout = payouts.get(p.id)
      const status: CommissionStatus = payout ? 'paid' : p.due_date >= today ? 'open' : 'overdue'
      return {
        payment_id: p.id,
        client_id: p.client_id,
        client_name: clientName(p.client_id),
        payment_type: p.payment_type,
        payment_amount: Number(p.amount) || 0,
        commission: Math.round((Number(p.amount) || 0) * rate) / 100,
        due_date: p.due_date,
        payment_paid_date: p.paid_date,
        payment_status: p.status,
        status,
        commission_paid_date: payout?.paid_date ?? null,
        marked_by: payout?.marked_by ?? null,
      }
    })

  return NextResponse.json({
    affiliate: { ...affiliate, commission_rate: rate },
    affiliates: admin ? affiliates : [],
    lines,
    mrr: currentMrr(clients as Parameters<typeof currentMrr>[0]),
    // Active paying clients — the population behind MRR, not every tagged record
    // (churned clients, dead trials and old leads keep the affiliate_id but
    // aren't "their clients" for commission purposes).
    client_count: (clients as Parameters<typeof isMrrActive>[0][]).filter(isMrrActive).length,
  })
}

// Mark a commission paid / unpaid. Admins may do any; an affiliate may do their own.
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const user = await getServerUser()
  const scope = await getAffiliateScope()
  const admin = await callerIsAdmin()
  const { payment_id, paid } = await req.json()
  if (!payment_id) return NextResponse.json({ error: 'payment_id required' }, { status: 400 })

  // Verify the payment belongs to an affiliate the caller may act on.
  const { data: pay } = await supabase
    .from('payments')
    .select('id, client:clients!inner(affiliate_id)')
    .eq('id', payment_id)
    .maybeSingle()
  const affId = (pay?.client as unknown as { affiliate_id?: string } | null)?.affiliate_id
  if (!pay || !affId) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!admin && scope !== affId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (paid) {
    const { error } = await supabase
      .from('affiliate_commission_payouts')
      .upsert({ payment_id, paid_date: todayStr(), marked_by: user?.id ?? null }, { onConflict: 'payment_id' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  } else {
    const { error } = await supabase.from('affiliate_commission_payouts').delete().eq('payment_id', payment_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
