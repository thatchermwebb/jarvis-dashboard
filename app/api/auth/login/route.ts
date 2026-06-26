import { NextRequest, NextResponse } from 'next/server'

const PASSWORDS: Record<string, string> = {
  thatcher: process.env.PW_THATCHER ?? '',
  trepp:    process.env.PW_TREPP    ?? '',
  diego:    process.env.PW_DIEGO    ?? '',
}

export async function POST(req: NextRequest) {
  const { userId, password } = await req.json()
  if (!userId || !password) return NextResponse.json({ ok: false }, { status: 400 })
  const expected = PASSWORDS[userId]
  if (!expected || password !== expected) return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({ ok: true })
}
