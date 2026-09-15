export type UserType = 'admin' | 'va' | 'associate' | 'setter'

export interface AppUser {
  id: string
  name: string
  role: string
  initials: string
  userType: UserType
  /**
   * Associates are scoped to a single affiliate: they may only ever see the
   * clients (and those clients' payments) carrying this `affiliate_id`.
   */
  affiliateId?: string
  /** Hides the entire Payments module (nav, pages, tabs, widgets, API). */
  noPayments?: boolean
  /**
   * Strips every money figure (retainer, budget, spend, payment amounts) from
   * the data this user receives — for money-blind roles like appointment
   * setters who see clients/notes/dates but no revenue. Implies noPayments.
   */
  hideRevenue?: boolean
}

export const USERS: AppUser[] = [
  { id: 'thatcher', name: 'Thatcher Webb',  role: 'Co-Founder',     initials: 'TW', userType: 'admin' },
  { id: 'trepp',    name: 'Trepp Grandich', role: 'Co-Founder',     initials: 'TG', userType: 'admin' },
  { id: 'diego',    name: 'Diego Carranza', role: 'Vice President',  initials: 'DC', userType: 'admin' },
  { id: 'jacques',  name: 'Jacques Brock',  role: 'Onboarding Specialist', initials: 'JB', userType: 'admin', noPayments: true },
  {
    id: 'toney',
    name: 'Toney Baker',
    role: 'Appointment Setter',
    initials: 'TB',
    userType: 'setter',
    noPayments: true,
    hideRevenue: true,
  },
  {
    id: 'malakai',
    name: 'Malakai Fung-A-Wing',
    role: 'Sales',
    initials: 'MF',
    userType: 'associate',
    affiliateId: 'd9f2779d-1269-4cd9-90bd-bdc968e923ed',
  },
  { id: 'wilson',   name: 'Wilson',         role: 'Ads VA',     initials: 'WL', userType: 'va' },
  { id: 'samuel',   name: 'Samuel',         role: 'Backend VA', initials: 'SM', userType: 'va' },
]

export function getUserById(id: string): AppUser | undefined {
  return USERS.find(u => u.id === id)
}

// Per-user accent color for @-mentions in notes (aligns with the assignee colors
// used elsewhere: Diego emerald, Thatcher blue, Trepp violet).
export const USER_COLORS: Record<string, string> = {
  thatcher: '#60a5fa', // blue
  trepp:    '#a78bfa', // violet
  diego:    '#34d399', // emerald
  jacques:  '#22d3ee', // cyan
  toney:    '#fbbf24', // amber
  malakai:  '#f472b6', // pink
  wilson:   '#818cf8', // indigo
  samuel:   '#2dd4bf', // teal
}

export function userColor(id?: string | null): string {
  return (id && USER_COLORS[id]) || '#9ca3af'
}

// ─── Access control ──────────────────────────────────────────────────────────

/** Pages an associate may open. Everything else redirects to /clients. */
export const ASSOCIATE_ALLOWED_HREFS = ['/clients', '/payments', '/tasks', '/ad-production']

/** Pages an appointment setter (money-blind) may open. */
export const SETTER_ALLOWED_HREFS = ['/clients', '/calls']

/** API prefixes a setter may call. Money/revenue APIs are excluded entirely. */
export const SETTER_ALLOWED_API = [
  '/api/clients',            // list + detail + situation (all under this prefix)
  '/api/communication-logs', // notes + call logs
  '/api/tasks',
  '/api/affiliates',
  '/api/slack',
  '/api/auth',
]

/** API prefixes an associate may call. Everything else is 403. */
export const ASSOCIATE_ALLOWED_API = [
  '/api/clients',
  '/api/payments',
  '/api/payment-schedules',
  '/api/communication-logs',
  '/api/tasks',
  '/api/ad-productions',
  '/api/slack', // send Slack notifications from fulfillment/ad flows
  '/api/affiliates',
  '/api/auth',
]

/**
 * No fully read-only role remains. Associates are affiliate-SCOPED read-write:
 * they can create/edit clients, payments and logs, but only within their own
 * affiliate book (enforced per-endpoint via affiliateScope + ownership checks).
 */
export function isReadOnly(_user: AppUser | undefined | null): boolean {
  return false
}

/** Admins (full permissions; can retroactively edit/delete team entries, etc.). */
export function isAdmin(user: AppUser | undefined | null): boolean {
  return user?.userType === 'admin'
}

/** Pages hidden from noPayments users (payments ledger + revenue reporting). */
export const NO_PAYMENTS_HREFS = ['/payments', '/reports']

/** API prefixes blocked for noPayments users (payments + revenue analytics). */
export const NO_PAYMENTS_API_PREFIXES = ['/api/payments', '/api/payment-schedules', '/api/reports']

/** Whether the Payments/revenue module is hidden for this user. */
export function paymentsHidden(user: AppUser | undefined | null): boolean {
  return !!user?.noPayments || !!user?.hideRevenue
}

/** Whether all money figures should be stripped from this user's data. */
export function revenueHidden(user: AppUser | undefined | null): boolean {
  return !!user?.hideRevenue
}

/** Money fields stripped from client records for revenue-hidden users. */
export const CLIENT_MONEY_FIELDS = ['monthly_retainer', 'budget', 'spend', 'payment_status', 'payment_frequency'] as const

/**
 * The affiliate a user is restricted to, or null for unrestricted (admin/VA).
 * Server code uses this to scope every clients/payments query.
 */
export function affiliateScope(user: AppUser | undefined | null): string | null {
  return user?.userType === 'associate' ? (user.affiliateId ?? '__none__') : null
}
