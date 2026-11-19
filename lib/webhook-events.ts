// Shared webhook event definitions — safe to import from BOTH client and server
// (no node-only imports here). The server dispatcher lives in lib/webhooks.ts.

export type WebhookEventKey = 'payment.ltv' | 'payment.cash_30d'

/** The events an endpoint can subscribe to — drives the Settings UI + validation. */
export const WEBHOOK_EVENTS: { key: WebhookEventKey; label: string; description: string }[] = [
  {
    key: 'payment.ltv',
    label: 'All payments · LTV',
    description: 'Fires on every successful payment. Use for lifetime value.',
  },
  {
    key: 'payment.cash_30d',
    label: 'First 30 days · Cash collection',
    description: "Fires only when a payment lands within 30 days of the client's first payment.",
  },
]

export const WEBHOOK_EVENT_KEYS = WEBHOOK_EVENTS.map(e => e.key)

export function isValidEvent(key: unknown): key is WebhookEventKey {
  return typeof key === 'string' && (WEBHOOK_EVENT_KEYS as string[]).includes(key)
}
