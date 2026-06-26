import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(req: NextRequest) {
  const user = req.cookies.get('cza_user')
  const { pathname } = req.nextUrl

  if (!user && pathname !== '/login') {
    return NextResponse.redirect(new URL('/login', req.url))
  }
  if (user && pathname === '/login') {
    return NextResponse.redirect(new URL('/', req.url))
  }
  return NextResponse.next()
}

export const config = {
  // Exclude API routes, Next.js internals, and any file with an extension (static assets)
  matcher: ['/((?!api|_next|favicon\\.ico|.*\\..*).*)'],
}
