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
 * Affiliates that are tracked as affiliates but do NOT earn commission — hidden
 * from the Affiliate Portal entirely (switcher, totals, due alerts, red dot).
 */
export const COMMISSION_EXCLUDED_AFFILIATES = new Set<string>([
  '16957272-8af4-48d1-aebb-ac84612a1526', // Jaques Brock — affiliate, no commission
])
