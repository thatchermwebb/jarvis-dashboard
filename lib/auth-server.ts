import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { getUserById, affiliateScope, isReadOnly, isAdmin, type AppUser } from './auth'

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

/** True when the caller is an admin (full permissions). */
export async function callerIsAdmin(): Promise<boolean> {
  return isAdmin(await getServerUser())
}

/**
 * Whether the caller may write to a given client. Unrestricted users (admin/va)
 * always may; affiliate-scoped users (associates) only for clients in their own
 * book. Pass the request's supabase client to reuse it.
 */
export async function callerCanAccessClient(supabase: SupabaseClient, clientId: string | null | undefined): Promise<boolean> {
  const scope = await getAffiliateScope()
  if (!scope) return true
  if (!clientId) return false
  const { data } = await supabase
    .from('clients').select('id').eq('id', clientId).eq('affiliate_id', scope).maybeSingle()
  return !!data
}
