import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { message, scheduled_for } = await req.json()

  const webhookUrl = process.env.SLACK_OPERATIONS_WEBHOOK_URL
  if (!webhookUrl) {
    return NextResponse.json({ error: 'SLACK_OPERATIONS_WEBHOOK_URL not configured' }, { status: 503 })
  }

  // Scheduled sends: store and return — actual scheduling requires Slack API token
  if (scheduled_for) {
    return NextResponse.json({ ok: true, scheduled: true, note: 'Scheduled sends require Slack API token — save the message and send manually at the scheduled time.' })
  }

  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: message }),
  })

  if (!res.ok) {
    const text = await res.text()
    return NextResponse.json({ error: `Slack error: ${text}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
