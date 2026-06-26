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

  if (daysUntilTrialEnd === 0) score += 50
  if (daysUntilTrialEnd === 1) score += 40
  if (client.payment_issue) score += 50
  if (daysSinceContact >= 2) score += 20
  if (client.cpl && client.cpl > 10) score += 25
  if (client.trial_health_score && client.trial_health_score >= 80) score += 40
  if (client.last_client_sentiment === 'frustrated' || client.last_client_sentiment === 'angry') score += 35
  if (client.thatcher_needed) score += 30
  if (client.ad_status === 'off') score += 30
  if (!client.phone_numbers_collected) score += 20
  if (!client.bookings) score += 20
  if (client.urgency_level === 'critical') score += 25
  if (client.next_followup_date && new Date(client.next_followup_date) < today) score += 30

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
