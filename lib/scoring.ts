import { differenceInDays } from 'date-fns'
import type { Client } from '@/types'

export function calculatePriorityScore(client: Client): number {
  let score = 0
  const today = new Date()

  const trialEnd = client.trial_end ? new Date(client.trial_end) : null
  const daysUntilTrialEnd = trialEnd ? differenceInDays(trialEnd, today) : null

  const daysSinceContact = client.last_contact_date
    ? differenceInDays(today, new Date(client.last_contact_date))
    : 999

  const isActivePaying = client.stage === 'active_client' || client.stage === 'won_back'
  const isTrial = client.stage === 'free_trial' || client.stage === 'trial_ending_soon'
  const sentiment = client.last_client_sentiment
  const todayStr = today.toISOString().slice(0, 10)

  // --- Tier 1: About to pay or end trial (highest urgency) ---
  if (daysUntilTrialEnd !== null && daysUntilTrialEnd <= 0) score += 80
  if (daysUntilTrialEnd === 1) score += 70
  if (daysUntilTrialEnd !== null && daysUntilTrialEnd <= 3) score += 50

  // Close-ready trials
  if (isTrial && client.trial_health_score && client.trial_health_score >= 80) score += 60
  if (isTrial && sentiment === 'close_ready') score += 55

  // --- Tier 2: Payment issues ---
  if (client.payment_issue) score += 65
  if (client.stage === 'payment_issue') score += 20
  if (client.payment_status === 'failed') score += 30

  // --- Tier 3: Active client sentiment (nuanced — happy ≠ urgent) ---
  if (isActivePaying) {
    if (sentiment === 'angry') score += 60
    else if (sentiment === 'frustrated') score += 50
    else if (sentiment === 'ghosting') score += 45
    else if (sentiment === 'concerned') score += 35
    else if (sentiment === 'confused') score += 20
    else if (sentiment === 'neutral') score += 5
    // happy = 0 (no urgency boost — they're fine)
  }

  // Churn risk on active clients
  if (isActivePaying && (client.stage === 'churn_risk' || (client.churn_risk_score && client.churn_risk_score >= 70))) score += 50

  // --- Tier 4: General signals ---
  if (!isActivePaying && (sentiment === 'angry' || sentiment === 'frustrated')) score += 35
  if (sentiment === 'ghosting' && !isActivePaying) score += 25
  if (client.thatcher_needed) score += 40

  // --- Tier 5: Follow-up due date (primary queue driver) ---
  if (client.next_followup_date) {
    if (client.next_followup_date < todayStr) score += 40         // overdue
    else if (client.next_followup_date === todayStr) score += 35  // due today
    else {
      const daysUntil = differenceInDays(new Date(client.next_followup_date + 'T00:00:00'), today)
      if (daysUntil <= 2) score += 15                             // due in 1-2 days
    }
  }
  if (daysSinceContact >= 2) score += 20
  if (client.urgency_level === 'critical') score += 30
  if (client.urgency_level === 'high') score += 15

  // --- Operational issues ---
  if (client.ad_status === 'off') score += 25
  if (client.cpl && client.cpl > 10) score += 20
  if (!client.bookings) score += 15

  return score
}

export function getTrialDaysLeft(trialEnd?: string): number | null {
  if (!trialEnd) return null
  return differenceInDays(new Date(trialEnd), new Date())
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

export function sortClientsByPriority(clients: Client[]): Client[] {
  return clients
    .map((c) => ({
      ...c,
      priority_score: calculatePriorityScore(c),
      trial_days_left: getTrialDaysLeft(c.trial_end) ?? undefined,
    }))
    .sort((a, b) => (b.priority_score ?? 0) - (a.priority_score ?? 0))
}
