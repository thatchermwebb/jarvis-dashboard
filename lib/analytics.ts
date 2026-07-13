// Shared business-analytics computations over clients + payments + schedules.
// Pure functions — used by the JARVIS agent (voice), the Reports analyst, and
// anywhere else that needs LTV / cash-collected / audit math. All money math
// happens here server-side so the models only narrate, never arithmetic.

import type { Client, Payment, PaymentSchedule } from '@/types'

const PAID = new Set(['paid', 'paid_late'])
const UPCOMING = new Set(['pending', 'overdue'])
const ACTIVE_STAGES = new Set(['active_client', 'won_back'])

/** The date a client became a paying client: signed_at (immutable, set on the
 *  first transition to active) with created_at as fallback for older rows. */
export function signedAnchor(c: Client): string {
  return (c.signed_at ?? c.created_at).slice(0, 10)
}

function addDaysStr(dateStr: string, days: number): string {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d) + days * 86_400_000)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function todayStr(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Lifetime value = everything actually collected from this client. */
export function clientLtv(clientId: string, payments: Payment[]): number {
  return payments
    .filter(p => p.client_id === clientId && PAID.has(p.status) && p.paid_date)
    .reduce((s, p) => s + p.amount, 0)
}

/** Earliest date the payments ledger has any record for — history before this
 *  simply wasn't tracked, so per-client "first 30 days" windows that predate
 *  it would read as $0 when the money was actually collected off-ledger. */
export function ledgerStart(payments: Payment[]): string | null {
  let min: string | null = null
  for (const p of payments) {
    const d = p.paid_date ?? p.due_date
    if (d && (!min || d < min)) min = d
  }
  return min
}

/**
 * Cash collected within 30 days of signing. Returns null when the window is
 * not measurable: the client signed <30 days ago (window incomplete), or the
 * window predates the payments ledger entirely (history never tracked).
 * Callers report those separately rather than dragging the average to $0.
 */
export function collectedFirst30Days(c: Client, payments: Payment[], ledgerFrom?: string | null): number | null {
  const anchor = signedAnchor(c)
  const windowEnd = addDaysStr(anchor, 30)
  if (windowEnd > todayStr()) return null
  const from = ledgerFrom === undefined ? ledgerStart(payments) : ledgerFrom
  if (from && windowEnd < from) return null // window predates payment tracking
  return payments
    .filter(p => p.client_id === c.id && PAID.has(p.status) && p.paid_date && p.paid_date >= anchor && p.paid_date <= windowEnd)
    .reduce((s, p) => s + p.amount, 0)
}

// ─── Bookkeeping audit ────────────────────────────────────────────────────────

export interface PaymentAuditReport {
  /** ACTIVE clients with no pending/overdue payment AND no active schedule —
   *  the classic "we forgot to enter their next payment" error. */
  missing_upcoming: { client: string; client_id: string; stage: string; retainer: number | null; last_paid_date: string | null }[]
  /** Overdue payments that need collecting. */
  overdue: { client: string; amount: number; due_date: string; days_late: number }[]
  /** Active clients with a retainer set but zero payments ever recorded. */
  never_paid: { client: string; retainer: number | null; signed: string }[]
}

export function paymentAudit(
  clients: Client[],
  payments: Payment[],
  schedules: PaymentSchedule[],
): PaymentAuditReport {
  const t = todayStr()
  const upcomingByClient = new Set(
    payments.filter(p => UPCOMING.has(p.status)).map(p => p.client_id),
  )
  const activeScheduleByClient = new Set(
    schedules.filter(s => s.active && (!s.end_date || s.end_date >= t)).map(s => s.client_id),
  )
  const paidByClient = new Map<string, string>() // client_id -> latest paid_date
  for (const p of payments) {
    if (PAID.has(p.status) && p.paid_date) {
      const prev = paidByClient.get(p.client_id)
      if (!prev || p.paid_date > prev) paidByClient.set(p.client_id, p.paid_date)
    }
  }

  const activeClients = clients.filter(c => ACTIVE_STAGES.has(c.stage))

  const missing_upcoming = activeClients
    .filter(c => !upcomingByClient.has(c.id) && !activeScheduleByClient.has(c.id))
    .map(c => ({
      client: c.name,
      client_id: c.id,
      stage: c.stage,
      retainer: c.monthly_retainer ?? null,
      last_paid_date: paidByClient.get(c.id) ?? null,
    }))

  const clientName = new Map(clients.map(c => [c.id, c.name]))
  const overdue = payments
    .filter(p => p.status === 'overdue')
    .map(p => ({
      client: clientName.get(p.client_id) ?? 'Unknown',
      amount: p.amount,
      due_date: p.due_date,
      days_late: Math.max(0, Math.round((Date.parse(t) - Date.parse(p.due_date)) / 86_400_000)),
    }))
    .sort((a, b) => b.days_late - a.days_late)

  const hasAnyPayment = new Set(payments.map(p => p.client_id))
  const never_paid = activeClients
    .filter(c => c.monthly_retainer && !hasAnyPayment.has(c.id))
    .map(c => ({ client: c.name, retainer: c.monthly_retainer ?? null, signed: signedAnchor(c) }))

  return { missing_upcoming, overdue, never_paid }
}

// ─── Monthly business series ─────────────────────────────────────────────────

export interface MonthlyBusinessRow {
  month: string // YYYY-MM
  new_clients: number
  churned: number
  cash_collected: number
  mrr_end_of_month: number
}

const LOST_STAGES = new Set(['churned', 'free_trial_lost'])

export function monthlyBusinessSeries(clients: Client[], payments: Payment[], monthsBack = 12): MonthlyBusinessRow[] {
  const now = new Date()
  const rows: MonthlyBusinessRow[] = []

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0)
    const monthEndStr = `${monthEnd.getFullYear()}-${String(monthEnd.getMonth() + 1).padStart(2, '0')}-${String(monthEnd.getDate()).padStart(2, '0')}`

    const new_clients = clients.filter(c => signedAnchor(c).startsWith(month) && (ACTIVE_STAGES.has(c.stage) || LOST_STAGES.has(c.stage) || c.stage === 'paused')).length
    const churned = clients.filter(c => LOST_STAGES.has(c.stage) && (c.updated_at ?? '').startsWith(month)).length
    const cash_collected = payments
      .filter(p => PAID.has(p.status) && p.paid_date?.startsWith(month))
      .reduce((s, p) => s + p.amount, 0)

    // Reconstructed MRR at month end: retainer clients signed by then, minus
    // ones already lost by then (same approach as the Reports page chart).
    const mrr_end_of_month = clients
      .filter(c => {
        if (!c.monthly_retainer) return false
        if (signedAnchor(c) > monthEndStr) return false
        if (LOST_STAGES.has(c.stage) && (c.updated_at ?? '').slice(0, 10) <= monthEndStr) return false
        return true
      })
      .reduce((s, c) => s + (c.monthly_retainer ?? 0), 0)

    rows.push({ month, new_clients, churned, cash_collected, mrr_end_of_month })
  }
  return rows
}

// ─── Compact per-client analytics rows ───────────────────────────────────────

export interface ClientAnalyticsRow {
  name: string
  stage: string
  retainer: number | null
  frequency: string | null
  signed: string
  tenure_days: number
  ltv: number
  collected_first_30d: number | null // null = signed <30d ago
  next_due: string | null
  next_due_amount: number | null
  affiliate: string | null
}

export function clientAnalyticsRows(clients: Client[], payments: Payment[]): ClientAnalyticsRow[] {
  const t = todayStr()
  const from = ledgerStart(payments)
  return clients
    .filter(c => c.stage !== 'onboarding')
    .map(c => {
      const upcoming = payments
        .filter(p => p.client_id === c.id && UPCOMING.has(p.status))
        .sort((a, b) => a.due_date.localeCompare(b.due_date))[0]
      const anchor = signedAnchor(c)
      return {
        name: c.name,
        stage: c.stage,
        retainer: c.monthly_retainer ?? null,
        frequency: c.payment_frequency ?? null,
        signed: anchor,
        tenure_days: Math.max(0, Math.round((Date.parse(t) - Date.parse(anchor)) / 86_400_000)),
        ltv: clientLtv(c.id, payments),
        collected_first_30d: collectedFirst30Days(c, payments, from),
        next_due: upcoming?.due_date ?? null,
        next_due_amount: upcoming?.amount ?? null,
        affiliate: (c as Client & { affiliate?: { name?: string } }).affiliate?.name ?? null,
      }
    })
}
