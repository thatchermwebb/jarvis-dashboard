import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { userId, password } = await req.json()
  if (!userId || !password) return NextResponse.json({ ok: false }, { status: 400 })

  const passwords: Record<string, string | undefined> = {
    thatcher: process.env.PW_THATCHER,
    trepp:    process.env.PW_TREPP,
    diego:    process.env.PW_DIEGO,
  }

  const expected = passwords[userId]
  if (!expected || password !== expected) return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({ ok: true })
}
