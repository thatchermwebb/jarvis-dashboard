import { cookies } from 'next/headers'
import { getUserById, affiliateScope, isReadOnly, type AppUser } from './auth'

/**
 * Resolve the signed-in user inside a route handler / server component.
 *
 * Note: `cza_user` is an unsigned cookie, so this is identification, not
 * cryptographic authentication — the app is internal and sits behind the
 * login screen. It is still the enforcement point for associate scoping:
 * without it, `/api/clients` would hand every client to any logged-in user.
 */
export async function getServerUser(): Promise<AppUser | undefined> {
  const store = await cookies()
  const id = store.get('cza_user')?.value
  return id ? getUserById(id) : undefined
}

/** Affiliate id this request is restricted to, or null if unrestricted. */
export async function getAffiliateScope(): Promise<string | null> {
  return affiliateScope(await getServerUser())
}

/** True when the caller may not mutate data (associates). */
export async function callerIsReadOnly(): Promise<boolean> {
  return isReadOnly(await getServerUser())
}
