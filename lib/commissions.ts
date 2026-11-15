// Shared config for affiliate commission tracking (used by the commission API
// routes). Keep this as the single source of truth.

/**
 * Commission tracking launched here — payments due before this date are
 * pre-launch history and don't accrue commissions. The program starts at this
 * month and accumulates forward.
 */
export const COMMISSION_START = '2026-11-01'

/** Payment statuses that never generate a commission. */
export const NON_COMMISSIONABLE = new Set(['voided', 'waived'])

/**
 * Payment statuses that mean the client has actually paid the invoice. A
 * commission is only *owed* — and only worth notifying about — once the money
 * is collected; an unpaid/overdue invoice doesn't put you on the hook to the
 * affiliate yet. Drives the due-commission alert (red dot + on-open toast).
 */
export const CLIENT_PAID_STATUSES = new Set(['paid', 'paid_late'])

/**
 * Affiliates that are tracked as affiliates but do NOT earn commission — hidden
 * from the Affiliate Portal entirely (switcher, totals, due alerts, red dot).
 */
export const COMMISSION_EXCLUDED_AFFILIATES = new Set<string>([
  '16957272-8af4-48d1-aebb-ac84612a1526', // Jaques Brock — affiliate, no commission
  'b2374d8d-b9bb-4ce4-9e80-4b3b134bce5c', // John Huda — affiliate, not currently earning commission
])
