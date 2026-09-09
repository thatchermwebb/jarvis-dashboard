import type { AdRating, MediaDecision, WorkOrderStatus } from '@/types'

// ─── Decision matrix (Media Buying Management SOP) ──────────────────────────────
// Rate Ad 1 and Ad 2 each Good / Decent / Bad (by CPL vs other/past ads):
//   Good+Good, Good+Decent, Decent+Good, Decent+Decent → Leave as-is
//   Good+Bad,  Bad+Good                                 → All spend to winner
//   Decent+Bad, Bad+Decent                             → All spend to winner + order 1 new
//   Bad+Bad                                            → Order 2 new

export interface MatrixResult {
  decision: MediaDecision
  /** Slot (1|2) that keeps all the spend, or null. */
  winnerSlot: number | null
  /** Slots that need a brand-new ad produced (0, 1, or 2 entries). */
  ordersToCreate: number[]
}

export function decide(r1: AdRating, r2: AdRating): MatrixResult {
  const bad = (r: AdRating) => r === 'bad'
  const decent = (r: AdRating) => r === 'decent'

  // Both bad → replace both.
  if (bad(r1) && bad(r2)) return { decision: 'order_2', winnerSlot: null, ordersToCreate: [1, 2] }

  // Exactly one bad → all spend to the other; if the other is only "decent",
  // also order a replacement for the bad one.
  if (bad(r1) || bad(r2)) {
    const winnerSlot = bad(r1) ? 2 : 1
    const loserSlot = bad(r1) ? 1 : 2
    const winnerRating = winnerSlot === 1 ? r1 : r2
    if (decent(winnerRating)) {
      return { decision: 'spend_to_winner_order_1', winnerSlot, ordersToCreate: [loserSlot] }
    }
    return { decision: 'spend_to_winner', winnerSlot, ordersToCreate: [] }
  }

  // Neither bad → leave everything running.
  return { decision: 'leave', winnerSlot: null, ordersToCreate: [] }
}

export const DECISION_LABEL: Record<MediaDecision, string> = {
  leave: 'Leave as-is',
  spend_to_winner: 'All spend to winner',
  spend_to_winner_order_1: 'All spend to winner · order 1 new',
  order_2: 'Order 2 new ads',
}

export const RATING_LABEL: Record<AdRating, string> = { good: 'Good', decent: 'Decent', bad: 'Bad' }

export const WORK_ORDER_STATUS_LABEL: Record<WorkOrderStatus, string> = {
  todo: 'To Do',
  in_production: 'In Production',
  produced: 'Produced',
  uploaded: 'Uploaded',
  done: 'Launched',
}

/** Monday (local) of the week containing `d` — the review-week anchor. */
export function weekMonday(d: Date = new Date()): string {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  const day = x.getDay() // 0=Sun … 6=Sat
  x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day))
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

/** Stages whose clients are actively running ads and get reviewed weekly. */
export const MEDIA_ACTIVE_STAGES = ['active_client', 'won_back', 'overdue', 'payment_issue', 'churn_risk']
