import type { Client } from '@/types'
import { localToday, daysUntil } from './utils'

// ─── Priority model ──────────────────────────────────────────────────────────
// Calls are hard-separated into lifecycle BINS, then sorted by urgency WITHIN
// each bin. Bin order (most → least attention-demanding for the daily call list):
//   Clients  →  Onboarding  →  Trials  →  Inactive
// Within a bin the score is a cumulation of urgency factors only — billing,
// churn/sentiment/attention flags, trial timing. Performance results (bookings,
// CPL, ad status) are deliberately NOT part of priority.

export type PriorityBin = 'client' | 'onboarding' | 'trial' | 'other'
/** Most-urgent unpaid payment state for a client (from the payments ledger). */
export type PaymentDueState = 'overdue' | 'today' | 'soon' | null

const CLIENT_STAGES = new Set(['active_client', 'won_back', 'overdue', 'payment_issue', 'churn_risk', 'paused'])
const TRIAL_STAGES = new Set(['free_trial', 'free_trial_pending', 'trial_ending_soon'])

export function priorityBin(c: Pick<Client, 'stage'>): PriorityBin {
  if (c.stage === 'onboarding') return 'onboarding'
  if (TRIAL_STAGES.has(c.stage)) return 'trial'
  if (CLIENT_STAGES.has(c.stage)) return 'client'
  return 'other' // churned, free_trial_lost, trial_concluded, etc.
}

/** Higher rank sorts first. Guarantees hard separation between bins. */
export function binRank(bin: PriorityBin): number {
  return bin === 'client' ? 3 : bin === 'onboarding' ? 2 : bin === 'trial' ? 1 : 0
}

export function binLabel(bin: PriorityBin): string {
  return bin === 'client' ? 'Client' : bin === 'onboarding' ? 'Onboarding' : bin === 'trial' ? 'Trial' : 'Inactive'
}

interface Factor { label: string; points: number }

// Single source of truth: the same factors drive the score AND the breakdown,
// so the number always matches the reasons shown on the profile.
function priorityFactors(c: Client, paymentDue: PaymentDueState): { bin: PriorityBin; factors: Factor[] } {
  const bin = priorityBin(c)
  const f: Factor[] = []
  const s = c.last_client_sentiment
  const today = localToday()
  const push = (label: string, points: number) => { if (points) f.push({ label, points }) }

  // Follow-up timing applies in every bin (a small tiebreaker).
  if (c.next_followup_date) {
    const d = c.next_followup_date
    if (d < today) push('Follow-up overdue', 90)
    else if (d === today) push('Follow-up due today', 80)
    else if ((daysUntil(d) ?? 99) <= 3) push('Follow-up due soon', 40)
  }

  if (bin === 'client') {
    // Tier 1 — billing (dominant: any today/overdue payment outranks the rest).
    if (paymentDue === 'overdue') push('Payment overdue', 800)
    else if (paymentDue === 'today') push('Payment due today', 700)
    else if (c.stage === 'overdue' || c.payment_status === 'failed') push('Payment overdue', 800)
    else if (paymentDue === 'soon') push('Payment due soon', 150)
    else if (c.payment_issue) push('Payment issue flagged', 400)
    // Tier 2 — retention / attention.
    if (c.stage === 'churn_risk' || (c.churn_risk_score ?? 0) >= 70) push('Churn risk', 280)
    if (s === 'angry') push('Sentiment: angry', 260)
    else if (s === 'frustrated') push('Sentiment: frustrated', 230)
    else if (s === 'ghosting') push('Client ghosting', 200)
    else if (s === 'concerned') push('Sentiment: concerned', 150)
    else if (s === 'confused') push('Sentiment: confused', 90)
    if (c.urgency_level === 'critical') push('Urgency: critical', 180)
    else if (c.urgency_level === 'high') push('Urgency: high', 100)
    if (c.thatcher_needed) push('Needs Thatcher', 130)
    if (c.trepp_needed) push('Needs Trepp', 90)
    if (c.va_needed) push('Needs coaching', 70)
    // Tier 3 — nothing pressing.
    if (f.length === 0 && s === 'happy') push('Happy — no action needed', 10)
  } else if (bin === 'onboarding') {
    push('Onboarding in progress', 40)
    if (c.thatcher_needed) push('Needs Thatcher', 130)
    if (c.trepp_needed) push('Needs Trepp', 90)
    if (c.va_needed) push('Needs coaching', 70)
    if (s === 'angry' || s === 'frustrated') push(`Sentiment: ${s}`, 150)
    else if (s === 'concerned' || s === 'confused') push(`Sentiment: ${s}`, 90)
    if (c.urgency_level === 'critical') push('Urgency: critical', 120)
    else if (c.urgency_level === 'high') push('Urgency: high', 70)
    if (c.payment_issue) push('Payment issue flagged', 120)
  } else if (bin === 'trial') {
    // Ending soonest first.
    const dte = c.trial_end ? daysUntil(c.trial_end) : null
    if (dte !== null) {
      if (dte <= 0) push('Trial ended', 500)
      else if (dte === 1) push('Trial ends tomorrow', 440)
      else if (dte <= 3) push(`Trial ends in ${dte} days`, 340)
      else if (dte <= 7) push(`Trial ends in ${dte} days`, 200)
      else push(`Trial ends in ${dte} days`, 80)
    }
    if ((c.trial_health_score ?? 0) >= 80) push('Close-ready (health ≥ 80)', 150)
    else if (s === 'close_ready') push('Sentiment: close-ready', 150)
    if (s === 'angry' || s === 'frustrated') push(`Sentiment: ${s}`, 130)
    else if (s === 'concerned' || s === 'confused' || s === 'ghosting') push(`Sentiment: ${s}`, 80)
    if (c.urgency_level === 'critical') push('Urgency: critical', 120)
    else if (c.urgency_level === 'high') push('Urgency: high', 70)
    if (c.thatcher_needed) push('Needs Thatcher', 100)
    if (c.trepp_needed) push('Needs Trepp', 70)
    if (c.payment_issue) push('Payment issue flagged', 120)
  }

  return { bin, factors: f.sort((a, b) => b.points - a.points) }
}

/** Within-bin urgency score (0…~1400). Higher = call sooner. */
export function calculatePriorityScore(c: Client, paymentDue: PaymentDueState = null): number {
  return priorityFactors(c, paymentDue).factors.reduce((sum, x) => sum + x.points, 0)
}

/** The factors that made up the score, lifecycle-appropriate, most first. */
export function getScoreBreakdown(c: Client, paymentDue: PaymentDueState = null): Factor[] {
  return priorityFactors(c, paymentDue).factors
}

export function getTrialDaysLeft(trialEnd?: string): number | null {
  if (!trialEnd) return null
  return daysUntil(trialEnd)
}

export function getTrialHealthLabel(score?: number): string {
  if (!score) return 'Unknown'
  if (score >= 80) return 'Close-Ready'
  if (score >= 60) return 'Good'
  if (score >= 40) return 'Needs Help'
  return 'At Risk'
}

export function getChurnRiskLabel(score?: number): string {
  if (!score) return 'Unknown'
  if (score >= 80) return 'Critical'
  if (score >= 60) return 'High'
  if (score >= 40) return 'Medium'
  return 'Low'
}

export function getCPLStatus(cpl?: number): 'good' | 'okay' | 'bad' | 'emergency' | null {
  if (!cpl) return null
  if (cpl < 5) return 'good'
  if (cpl < 10) return 'okay'
  if (cpl < 15) return 'bad'
  return 'emergency'
}

/**
 * Sort clients most → least urgent: hard bin separation first
 * (Clients → Onboarding → Trials → Inactive), then within-bin urgency.
 * Pass `paymentDueMap` (client id → state) to fold ledger billing urgency in;
 * without it, billing falls back to the client's own flags.
 */
export function sortClientsByPriority(clients: Client[], paymentDueMap?: Record<string, PaymentDueState>): Client[] {
  return clients
    .map((c) => ({
      ...c,
      priority_score: calculatePriorityScore(c, paymentDueMap?.[c.id] ?? null),
      trial_days_left: getTrialDaysLeft(c.trial_end) ?? undefined,
    }))
    .sort((a, b) => {
      const byBin = binRank(priorityBin(b)) - binRank(priorityBin(a))
      if (byBin !== 0) return byBin
      return (b.priority_score ?? 0) - (a.priority_score ?? 0)
    })
}
