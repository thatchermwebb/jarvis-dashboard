import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { message, scheduled_for, channel } = await req.json()

  // Onboarding notifications post to their own channel (#new-onboardings) when a
  // webhook is configured; everything else — and onboarding if that webhook is
  // unset — falls back to #operations so nothing silently drops.
  const opsUrl = process.env.SLACK_OPERATIONS_WEBHOOK_URL
  const webhookUrl = channel === 'onboarding'
    ? (process.env.SLACK_ONBOARDING_WEBHOOK_URL || opsUrl)
    : opsUrl
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
