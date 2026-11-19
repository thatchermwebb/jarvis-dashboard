import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callerIsAdmin } from '@/lib/auth-server'
import { buildPaymentEvent, deliverToEndpoint, isValidEvent, type WebhookAttribution } from '@/lib/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Send a sample payload to one endpoint, using that endpoint's own event, so
// the admin can confirm the receiver is wired up. Uses the real signing secret
// but clearly-fake sample data. Admin only.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await callerIsAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const supabase = await createClient()

  const { data: ep } = await supabase
    .from('webhook_endpoints')
    .select('id, url, secret, event')
    .eq('id', id)
    .maybeSingle()
  if (!ep) return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })

  const eventKey = isValidEvent(ep.event) ? ep.event : 'payment.ltv'
  const today = new Date().toISOString().slice(0, 10)

  // Representative sample: a payment 12 days into the client's lifecycle, so it
  // falls inside the 30-day window (valid for either event type).
  const attribution: WebhookAttribution = {
    first_payment_date: new Date(Date.now() - 12 * 86_400_000).toISOString().slice(0, 10),
    days_since_first_payment: 12,
    is_first_payment: false,
    within_30_days: true,
  }

  const event = buildPaymentEvent(
    eventKey,
    {
      id: 'pay_sample_0000',
      amount: 1000,
      payment_type: 'retainer_monthly',
      status: 'paid',
      description: 'Sample test event from CZA Command Center',
      due_date: today,
      paid_date: today,
      source: 'stripe',
    },
    {
      id: 'client_sample_0000',
      name: 'Sample Detailer',
      business_name: 'Sample Detailing Co.',
      email: 'sample@example.com',
      phone: '(555) 010-1000',
      market_location: 'Austin, TX',
      stage: 'active_client',
      monthly_retainer: 1000,
    },
    attribution,
  )

  const { status, error } = await deliverToEndpoint(ep, event)
  await supabase
    .from('webhook_endpoints')
    .update({ last_status: status, last_error: error, last_delivered_at: new Date().toISOString() })
    .eq('id', ep.id)

  const ok = status != null && status >= 200 && status < 300
  return NextResponse.json({ ok, status, error, event: eventKey }, { status: ok ? 200 : 502 })
}
