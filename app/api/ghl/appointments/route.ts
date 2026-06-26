import { NextRequest, NextResponse } from 'next/server'

const GHL_BASE = 'https://services.leadconnectorhq.com'
const GHL_VERSION = '2021-07-28'

function ghlHeaders() {
  return {
    Authorization: `Bearer ${process.env.GHL_API_KEY ?? ''}`,
    Version: GHL_VERSION,
    'Content-Type': 'application/json',
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const locationId = process.env.GHL_LOCATION_ID

  if (!process.env.GHL_API_KEY || !locationId) {
    return NextResponse.json({ error: 'GHL not configured' }, { status: 503 })
  }

  const startTime = searchParams.get('startTime') ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const endTime = searchParams.get('endTime') ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString()
  const calendarId = searchParams.get('calendarId') // optional filter

  const params = new URLSearchParams({ locationId, startTime, endTime })
  if (calendarId) params.set('calendarId', calendarId)

  const res = await fetch(`${GHL_BASE}/calendars/events?${params}`, {
    headers: ghlHeaders(),
    cache: 'no-store',
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `GHL error: ${text}` }, { status: res.status })
  }

  return NextResponse.json(await res.json())
}

export async function POST(req: NextRequest) {
  const locationId = process.env.GHL_LOCATION_ID

  if (!process.env.GHL_API_KEY || !locationId) {
    return NextResponse.json({ error: 'GHL not configured' }, { status: 503 })
  }

  const body = await req.json()

  const res = await fetch(`${GHL_BASE}/calendars/events/appointments`, {
    method: 'POST',
    headers: ghlHeaders(),
    body: JSON.stringify({ ...body, locationId }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `GHL error: ${text}` }, { status: res.status })
  }

  return NextResponse.json(await res.json())
}
