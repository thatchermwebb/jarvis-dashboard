import { NextResponse } from 'next/server'

const GHL_BASE = 'https://services.leadconnectorhq.com'
const GHL_VERSION = '2021-07-28'

export async function GET() {
  const locationId = process.env.GHL_LOCATION_ID
  if (!process.env.GHL_API_KEY || !locationId) {
    return NextResponse.json({ error: 'GHL not configured' }, { status: 503 })
  }

  const res = await fetch(`${GHL_BASE}/calendars/?locationId=${locationId}`, {
    headers: {
      Authorization: `Bearer ${process.env.GHL_API_KEY}`,
      Version: GHL_VERSION,
    },
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `GHL error: ${text}` }, { status: res.status })
  }

  const data = await res.json()
  return NextResponse.json(data)
}
