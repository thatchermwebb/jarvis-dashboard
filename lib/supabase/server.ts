import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''

function isConfigured() {
  return SUPABASE_URL.startsWith('http') && SUPABASE_KEY.length > 10
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
