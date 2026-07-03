import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
// Service role key bypasses RLS — safe here because this file is server-only
// and auth is handled via custom cookies, not Supabase Auth
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || SUPABASE_ANON_KEY

function isConfigured() {
  return SUPABASE_URL.startsWith('http') && SUPABASE_ANON_KEY.length > 10 && SUPABASE_URL !== 'your_supabase_project_url'
}

// Stub client: returns empty results for any query chain when Supabase isn't configured
function createStubClient() {
  const result = { data: [] as any[], error: null, count: 0 }
  const chain: any = new Proxy(result, {
    get(target, prop) {
      if (prop === 'data' || prop === 'error' || prop === 'count') return target[prop as keyof typeof target]
      if (prop === 'then') return undefined // not a Promise
      if (prop === 'single') return () => ({ data: null, error: null })
      return () => chain
    },
  })
  return { from: () => chain } as any
}

export async function createClient() {
  if (!isConfigured()) return createStubClient()

  const cookieStore = await cookies()
  return createServerClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {}
        },
      },
    }
  )
}
