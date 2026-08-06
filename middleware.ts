import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getUserById, ASSOCIATE_ALLOWED_HREFS, ASSOCIATE_ALLOWED_API, NO_PAYMENTS_API_PREFIXES, NO_PAYMENTS_HREFS } from '@/lib/auth'

export function middleware(req: NextRequest) {
  const cookie = req.cookies.get('cza_user')
  const { pathname } = req.nextUrl
  const user = cookie ? getUserById(cookie.value) : undefined

  // ── API: only ever *narrow* access, for associates. Everyone else (including
  // unauthenticated webhook callers like /api/slack and /api/ghl) is untouched.
  if (pathname.startsWith('/api')) {
    if (user?.userType === 'associate') {
      const allowed = ASSOCIATE_ALLOWED_API.some(p => pathname === p || pathname.startsWith(p + '/'))
      if (!allowed) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    // noPayments users can't touch the payments/revenue APIs at all.
    if (user?.noPayments && NO_PAYMENTS_API_PREFIXES.some(p => pathname === p || pathname.startsWith(p + '/'))) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    return NextResponse.next()
  }

  // ── Pages
  if (!cookie && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (cookie && pathname === '/login') {
    return NextResponse.redirect(new URL(user?.userType === 'associate' ? '/clients' : '/', req.url))
  }

  // Associates are confined to their two pages (client detail lives under /clients).
  if (user?.userType === 'associate' && pathname !== '/login') {
    const allowed = ASSOCIATE_ALLOWED_HREFS.some(p => pathname === p || pathname.startsWith(p + '/'))
    if (!allowed) return NextResponse.redirect(new URL('/clients', req.url))
  }

  // noPayments users can't open the Payments or Reports pages.
  if (user?.noPayments && NO_PAYMENTS_HREFS.some(p => pathname === p || pathname.startsWith(p + '/'))) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  return NextResponse.next()
}

export const config = {
  // Include /api so associate scoping is enforced centrally; exclude Next.js
  // internals and any file with an extension (static assets).
  matcher: ['/((?!_next|favicon\\.ico|.*\\..*).*)'],
}
