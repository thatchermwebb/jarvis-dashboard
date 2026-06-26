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

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!process.env.GHL_API_KEY) {
    return NextResponse.json({ error: 'GHL not configured' }, { status: 503 })
  }
  const { id } = await params
  const res = await fetch(`${GHL_BASE}/calendars/events/${id}`, {
    method: 'DELETE',
    headers: ghlHeaders(),
  })
  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `GHL error: ${text}` }, { status: res.status })
  }
  return NextResponse.json({ ok: true })
}
