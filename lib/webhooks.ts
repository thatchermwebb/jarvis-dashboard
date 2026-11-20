import crypto from 'crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { WEBHOOK_EVENTS, WEBHOOK_EVENT_KEYS, isValidEvent, type WebhookEventKey } from './webhook-events'

// ─── Outbound webhooks ──────────────────────────────────────────────────────
// Server-only. Delivers structured JSON payloads to endpoints configured in
// Settings (the webhook_endpoints table). Best-effort: a dead or slow receiver
// can never fail or slow down the action that triggered it.
//
// Two payment events, both tracked back to a client, for attribution software:
//   • payment.ltv       — every successful payment (lifetime value).
//   • payment.cash_30d  — a successful payment that lands within 30 days of the
//                         client's FIRST payment (30-day cash collection).
// A client's first payment fires BOTH (day 0 is within the window). A payment
// 60 days after the first fires only payment.ltv.

// Re-exported so server code can keep importing these from '@/lib/webhooks'.
export { WEBHOOK_EVENTS, WEBHOOK_EVENT_KEYS, isValidEvent }
export type { WebhookEventKey }

/** The 30-day cash-collection window, in days (inclusive). */
export const CASH_WINDOW_DAYS = 30

/** Statuses that mean the client has actually paid — the webhook trigger. */
export const PAID_STATUSES = new Set(['paid', 'paid_late'])

const DELIVERY_TIMEOUT_MS = 8000

// ─── Payload shapes (stable contract — external consumers depend on these) ────
export interface WebhookPayment {
  id: string
  amount: number
  currency: string
  payment_type: string | null
  /** Revenue-share rate for rev_share payments (e.g. 15 = 15%); null otherwise. */
  rev_share_percent: number | null
  status: string
  description: string | null
  due_date: string | null
  paid_date: string | null
  source: string | null
}
export interface WebhookClient {
  id: string
  name: string | null
  business_name: string | null
  email: string | null
  phone: string | null
  market_location: string | null
  stage: string | null
  monthly_retainer: number | null
}
export interface WebhookAttribution {
  first_payment_date: string | null   // client's earliest collected payment (YYYY-MM-DD)
  days_since_first_payment: number | null
  is_first_payment: boolean            // is THIS payment the client's first?
  within_30_days: boolean              // is THIS payment inside the 30-day window?
}
export interface WebhookEvent {
  id: string                 // unique event id (evt_…), for receiver idempotency
  event: WebhookEventKey
  created_at: string         // ISO-8601, when we emitted the event
  data: {
    payment: WebhookPayment
    client: WebhookClient | null
    attribution: WebhookAttribution
  }
}

/** HMAC-SHA256 of the raw body, hex-encoded — sent as `X-CZA-Signature: sha256=…`. */
export function signPayload(secret: string, body: string): string {
  return 'sha256=' + crypto.createHmac('sha256', secret).update(body, 'utf8').digest('hex')
}

const toNum = (v: unknown): number | null => (v == null || v === '' ? null : Number(v))
const toStr = (v: unknown): string | null => (v == null ? null : String(v))
const toDay = (v: unknown): string | null => {
  const s = v == null ? '' : String(v)
  return s ? s.slice(0, 10) : null
}

/** Whole days between two YYYY-MM-DD dates (UTC), or null if either is missing. */
export function daysBetween(fromDay: string | null, toDayStr: string | null): number | null {
  if (!fromDay || !toDayStr) return null
  const a = new Date(fromDay + 'T00:00:00Z').getTime()
  const b = new Date(toDayStr + 'T00:00:00Z').getTime()
  if (Number.isNaN(a) || Number.isNaN(b)) return null
  return Math.floor((b - a) / 86_400_000)
}

/** Build one event payload for a given event key. */
export function buildPaymentEvent(
  eventKey: WebhookEventKey,
  payment: Record<string, unknown>,
  client: Record<string, unknown> | null,
  attribution: WebhookAttribution,
): WebhookEvent {
  return {
    id: 'evt_' + crypto.randomUUID(),
    event: eventKey,
    created_at: new Date().toISOString(),
    data: {
      payment: {
        id: String(payment.id),
        amount: Number(payment.amount) || 0,
        currency: 'usd',
        payment_type: toStr(payment.payment_type),
        rev_share_percent: toNum(payment.rev_share_percent),
        status: String(payment.status),
        description: toStr(payment.description),
        due_date: toDay(payment.due_date),
        paid_date: toDay(payment.paid_date),
        source: toStr(payment.source),
      },
      client: client
        ? {
            id: String(client.id),
            name: toStr(client.name),
            business_name: toStr(client.business_name),
            email: toStr(client.email),
            phone: toStr(client.phone),
            market_location: toStr(client.market_location),
            stage: toStr(client.stage),
            monthly_retainer: toNum(client.monthly_retainer),
          }
        : null,
      attribution,
    },
  }
}

/**
 * Work out where this payment sits relative to the client's FIRST collected
 * payment. Looks at every paid/paid_late payment the client has (the current
 * one is already written by the time we dispatch), takes the earliest effective
 * date (paid_date, falling back to due_date) as the anchor, and measures from
 * there.
 */
export async function computeAttribution(
  supabase: SupabaseClient,
  payment: Record<string, unknown>,
): Promise<WebhookAttribution> {
  const currentDay = toDay(payment.paid_date) ?? toDay(payment.due_date)
  let firstDay = currentDay
  let firstId = String(payment.id)

  try {
    const { data: rows } = await supabase
      .from('payments')
      .select('id, paid_date, due_date, status')
      .eq('client_id', payment.client_id as string)
      .in('status', [...PAID_STATUSES])

    if (rows && rows.length) {
      let min: string | null = null
      for (const r of rows as { id: string; paid_date: string | null; due_date: string | null }[]) {
        const d = toDay(r.paid_date) ?? toDay(r.due_date)
        if (!d) continue
        if (min == null || d < min) {
          min = d
          firstId = r.id
        }
      }
      if (min) firstDay = min
    }
  } catch {
    // Fall back to treating this payment as the first.
  }

  const days = daysBetween(firstDay, currentDay)
  return {
    first_payment_date: firstDay,
    days_since_first_payment: days,
    is_first_payment: firstId === String(payment.id),
    within_30_days: days != null && days >= 0 && days <= CASH_WINDOW_DAYS,
  }
}

/** Deliver one event to one endpoint. Returns the HTTP status, or null on network error. */
export async function deliverToEndpoint(
  endpoint: { url: string; secret: string | null },
  event: WebhookEvent,
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

/** Fire one event key to every enabled endpoint subscribed to it. Records delivery health. */
async function fireEvent(
  supabase: SupabaseClient,
  eventKey: WebhookEventKey,
  payment: Record<string, unknown>,
  client: Record<string, unknown> | null,
  attribution: WebhookAttribution,
): Promise<void> {
  const { data: endpoints } = await supabase
    .from('webhook_endpoints')
    .select('id, url, secret')
    .eq('event', eventKey)
    .eq('enabled', true)
  if (!endpoints || endpoints.length === 0) return

  const event = buildPaymentEvent(eventKey, payment, client, attribution)
  await Promise.all(
    (endpoints as { id: string; url: string; secret: string | null }[]).map(async ep => {
      const { status, error } = await deliverToEndpoint(ep, event)
      await supabase
        .from('webhook_endpoints')
        .update({ last_status: status, last_error: error, last_delivered_at: new Date().toISOString() })
        .eq('id', ep.id)
    }),
  )
}

/**
 * A payment just became successful. Always fires `payment.ltv`; additionally
 * fires `payment.cash_30d` when the payment is within 30 days of the client's
 * first payment. Best-effort — never throws, so webhooks can't break the
 * payment flow.
 */
export async function dispatchPaymentSucceeded(
  supabase: SupabaseClient,
  payment: Record<string, unknown>,
  client: Record<string, unknown> | null,
): Promise<void> {
  try {
    const attribution = await computeAttribution(supabase, payment)

    const events: WebhookEventKey[] = ['payment.ltv']
    if (attribution.within_30_days) events.push('payment.cash_30d')

    for (const eventKey of events) {
      await fireEvent(supabase, eventKey, payment, client, attribution)
    }
  } catch {
    // Webhooks are best-effort; never let them break the payment flow.
  }
}
