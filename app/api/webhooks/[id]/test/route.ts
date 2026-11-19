import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callerIsAdmin } from '@/lib/auth-server'
import { buildPaymentSucceededEvent, deliverToEndpoint } from '@/lib/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Send a sample payment.succeeded payload to one endpoint, so the admin can
// confirm the receiver is wired up. Uses the endpoint's real signing secret but
// clearly-fake sample data. Admin only.
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!(await callerIsAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const { id } = await params
  const supabase = await createClient()

  const { data: ep } = await supabase
    .from('webhook_endpoints')
    .select('id, url, secret')
    .eq('id', id)
    .maybeSingle()
  if (!ep) return NextResponse.json({ error: 'Endpoint not found' }, { status: 404 })

  const event = buildPaymentSucceededEvent(
    {
      id: 'pay_sample_0000',
      amount: 1000,
      payment_type: 'retainer_monthly',
      status: 'paid',
      description: 'Sample test event from CZA Command Center',
      due_date: new Date().toISOString().slice(0, 10),
      paid_date: new Date().toISOString().slice(0, 10),
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
  )

  const { status, error } = await deliverToEndpoint(ep, event)
  await supabase
    .from('webhook_endpoints')
    .update({ last_status: status, last_error: error, last_delivered_at: new Date().toISOString() })
    .eq('id', ep.id)

  const ok = status != null && status >= 200 && status < 300
  return NextResponse.json({ ok, status, error }, { status: ok ? 200 : 502 })
}
