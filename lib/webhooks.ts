import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'

// ─── Outbound webhooks ──────────────────────────────────────────────────────
// Server-only. Delivers structured JSON payloads to endpoints configured in
// Settings (the webhook_endpoints table). Best-effort: a dead or slow receiver
// can never fail or slow down the action that triggered it.

export type WebhookEvent = 'payment.succeeded'

export interface WebhookEndpoint {
  id: string
  event: string
  url: string
  secret: string | null
  description: string | null
  enabled: boolean
}

// Shapes of the data we put on the wire. Intentionally a stable, documented
// contract — external consumers depend on these field names.
export interface PaymentSucceededPayment {
  id: string
  amount: number
  currency: string
  payment_type: string | null
  status: string
  description: string | null
  due_date: string | null
  paid_date: string | null
  source: string | null
}
export interface PaymentSucceededClient {
  id: string
  name: string | null
  business_name: string | null
  email: string | null
  phone: string | null
  market_location: string | null
  stage: string | null
  monthly_retainer: number | null
}

export interface PaymentSucceededEvent {
  id: string                 // unique event id (evt_…), for receiver idempotency
  event: 'payment.succeeded'
  created_at: string         // ISO-8601, when we emitted the event
  data: {
    payment: PaymentSucceededPayment
    client: PaymentSucceededClient | null
  }
}

/** Statuses that mean the client has actually paid — the webhook trigger. */
export const PAID_STATUSES = new Set(['paid', 'paid_late'])

const DELIVERY_TIMEOUT_MS = 8000

/** HMAC-SHA256 of the raw body, hex-encoded — sent as `X-CZA-Signature: sha256=…`. */
export function signPayload(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

/** Build the structured payment.succeeded payload from a payment + its client row. */
export function buildPaymentSucceededEvent(
  payment: Record<string, unknown>,
  client: Record<string, unknown> | null,
): PaymentSucceededEvent {
  const num = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
  const str = (v: unknown): string | null => (v == null ? null : String(v))
  return {
    id: 'evt_' + crypto.randomUUID(),
    event: 'payment.succeeded',
    created_at: new Date().toISOString(),
    data: {
      payment: {
        id: String(payment.id),
        amount: Number(payment.amount) || 0,
        currency: 'usd',
        payment_type: str(payment.payment_type),
        status: String(payment.status),
        description: str(payment.description),
        due_date: str(payment.due_date),
        paid_date: str(payment.paid_date),
        source: str(payment.source),
      },
      client: client
        ? {
            id: String(client.id),
            name: str(client.name),
            business_name: str(client.business_name),
            email: str(client.email),
            phone: str(client.phone),
            market_location: str(client.market_location),
            stage: str(client.stage),
            monthly_retainer: num(client.monthly_retainer),
          }
        : null,
    },
  }
}

/** Deliver one event to one endpoint. Returns the HTTP status, or null on network error. */
export async function deliverToEndpoint(
  endpoint: Pick<WebhookEndpoint, 'url' | 'secret'>,
  event: PaymentSucceededEvent,
): Promise<{ status: number | null; error: string | null }> {
  const body = JSON.stringify(event)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'CZA-Command-Center-Webhooks/1',
    'X-CZA-Event': event.event,
    'X-CZA-Event-Id': event.id,
    'X-CZA-Delivery': crypto.randomUUID(),
  }
  if (endpoint.secret) headers['X-CZA-Signature'] = signPayload(endpoint.secret, body)

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS)
  try {
    const res = await fetch(endpoint.url, { method: 'POST', headers, body, signal: controller.signal })
    return { status: res.status, error: res.ok ? null : `HTTP ${res.status}` }
  } catch (err) {
    return { status: null, error: err instanceof Error ? err.message : 'network error' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fire the `payment.succeeded` event to every enabled endpoint. Best-effort and
 * non-blocking in spirit: it awaits delivery (so serverless doesn't kill the
 * request early) but swallows all errors and records the last delivery result
 * on each endpoint row. Never throws.
 */
export async function dispatchPaymentSucceeded(
  supabase: SupabaseClient,
  payment: Record<string, unknown>,
  client: Record<string, unknown> | null,
): Promise<void> {
  try {
    const { data: endpoints } = await supabase
      .from('webhook_endpoints')
      .select('id, url, secret')
      .eq('event', 'payment.succeeded')
      .eq('enabled', true)

    if (!endpoints || endpoints.length === 0) return

    const event = buildPaymentSucceededEvent(payment, client)

    await Promise.all(
      (endpoints as { id: string; url: string; secret: string | null }[]).map(async ep => {
        const { status, error } = await deliverToEndpoint(ep, event)
        // Record delivery health; ignore any failure updating it.
        await supabase
          .from('webhook_endpoints')
          .update({ last_status: status, last_error: error, last_delivered_at: new Date().toISOString() })
          .eq('id', ep.id)
      }),
    )
  } catch {
    // Webhooks are best-effort; never let them break the payment flow.
  }
}
