export type UserType = 'admin' | 'va' | 'associate'

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
}

export const USERS: AppUser[] = [
  { id: 'thatcher', name: 'Thatcher Webb',  role: 'Co-Founder', initials: 'TW', userType: 'admin' },
  { id: 'trepp',    name: 'Trepp Grandich', role: 'Co-Founder', initials: 'TG', userType: 'admin' },
  { id: 'diego',    name: 'Diego Carranza', role: 'VP',         initials: 'DC', userType: 'admin' },
  { id: 'jacques',  name: 'Jacques Brock',  role: 'Head of Operations', initials: 'JB', userType: 'admin', noPayments: true },
  { id: 'wilson',   name: 'Wilson',         role: 'Ads VA',     initials: 'WL', userType: 'va'    },
  { id: 'samuel',   name: 'Samuel',         role: 'Backend VA', initials: 'SM', userType: 'va'    },
  {
    id: 'malakai',
    name: 'Malakai Fung-A-Wing',
    role: 'Associate',
    initials: 'MF',
    userType: 'associate',
    affiliateId: 'd9f2779d-1269-4cd9-90bd-bdc968e923ed',
  },
]

export function getUserById(id: string): AppUser | undefined {
  return USERS.find(u => u.id === id)
}

// ─── Access control ──────────────────────────────────────────────────────────

/** Pages an associate may open. Everything else redirects to /clients. */
export const ASSOCIATE_ALLOWED_HREFS = ['/clients', '/payments']

/** API prefixes an associate may call. Everything else is 403. */
export const ASSOCIATE_ALLOWED_API = [
  '/api/clients',
  '/api/payments',
  '/api/payment-schedules',
  '/api/communication-logs', // scoped to their own clients; read-only
  '/api/affiliates',
  '/api/auth',
]

/** Associates are read-only — they may never mutate anything. */
export function isReadOnly(user: AppUser | undefined | null): boolean {
  return user?.userType === 'associate'
}

/** Pages hidden from noPayments users (payments ledger + revenue reporting). */
export const NO_PAYMENTS_HREFS = ['/payments', '/reports']

/** API prefixes blocked for noPayments users (payments + revenue analytics). */
export const NO_PAYMENTS_API_PREFIXES = ['/api/payments', '/api/payment-schedules', '/api/reports']

/** Whether the Payments/revenue module is hidden for this user. */
export function paymentsHidden(user: AppUser | undefined | null): boolean {
  return !!user?.noPayments
}

/**
 * The affiliate a user is restricted to, or null for unrestricted (admin/VA).
 * Server code uses this to scope every clients/payments query.
 */
export function affiliateScope(user: AppUser | undefined | null): string | null {
  return user?.userType === 'associate' ? (user.affiliateId ?? '__none__') : null
}
