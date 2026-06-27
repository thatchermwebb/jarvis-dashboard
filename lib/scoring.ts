import { differenceInDays } from 'date-fns'
import type { Client } from '@/types'
import { localToday, daysUntil, daysBetween } from './utils'

export function calculatePriorityScore(client: Client): number {
  let score = 0
  const todayStr = localToday()

  const daysUntilTrialEnd = client.trial_end ? daysUntil(client.trial_end) : null

  const daysSinceContact = client.last_contact_date
    ? Math.abs(daysUntil(client.last_contact_date.slice(0, 10))) // last_contact_date may be full ISO
    : 999

  const isActivePaying = client.stage === 'active_client' || client.stage === 'won_back'
  const isTrial = client.stage === 'free_trial' || client.stage === 'trial_ending_soon'
  const sentiment = client.last_client_sentiment

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

  // --- Tier 3: Active client sentiment ---
  if (isActivePaying) {
    if (sentiment === 'angry') score += 60
    else if (sentiment === 'frustrated') score += 50
    else if (sentiment === 'ghosting') score += 45
    else if (sentiment === 'concerned') score += 35
    else if (sentiment === 'confused') score += 20
    else if (sentiment === 'neutral') score += 5
  }

  if (isActivePaying && (client.stage === 'churn_risk' || (client.churn_risk_score && client.churn_risk_score >= 70))) score += 50

  // --- Tier 4: General signals ---
  if (!isActivePaying && (sentiment === 'angry' || sentiment === 'frustrated')) score += 35
  if (sentiment === 'ghosting' && !isActivePaying) score += 25
  if (client.thatcher_needed) score += 40

  // --- Tier 5: Follow-up due date ---
  if (client.next_followup_date) {
    const d = client.next_followup_date
    if (d < todayStr) score += 40          // overdue
    else if (d === todayStr) score += 35   // due today
    else if (daysUntil(d) <= 2) score += 15 // due in 1-2 days
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

export function getScoreBreakdown(client: Client): { label: string; points: number }[] {
  const factors: { label: string; points: number }[] = []
  const todayStr = localToday()
  const daysUntilTrialEnd = client.trial_end ? daysUntil(client.trial_end) : null
  const daysSinceContact = client.last_contact_date
    ? Math.abs(daysUntil(client.last_contact_date.slice(0, 10)))
    : 999
  const isActivePaying = client.stage === 'active_client' || client.stage === 'won_back'
  const isTrial = client.stage === 'free_trial' || client.stage === 'trial_ending_soon'
  const sentiment = client.last_client_sentiment

  if (daysUntilTrialEnd !== null && daysUntilTrialEnd <= 0)
    factors.push({ label: 'Trial ended', points: 80 })
  if (daysUntilTrialEnd === 1)
    factors.push({ label: 'Trial ends tomorrow', points: 70 })
  if (daysUntilTrialEnd !== null && daysUntilTrialEnd > 1 && daysUntilTrialEnd <= 3)
    factors.push({ label: `Trial ends in ${daysUntilTrialEnd} days`, points: 50 })
  if (isTrial && (client.trial_health_score ?? 0) >= 80)
    factors.push({ label: `Trial health ${client.trial_health_score}/100 (close-ready)`, points: 60 })
  if (isTrial && sentiment === 'close_ready')
    factors.push({ label: 'Sentiment: close-ready', points: 55 })
  if (client.payment_issue)
    factors.push({ label: 'Payment issue flagged', points: 65 })
  if (client.stage === 'payment_issue')
    factors.push({ label: 'Stage: payment issue', points: 20 })
  if (client.payment_status === 'failed')
    factors.push({ label: 'Payment status: failed', points: 30 })
  if (isActivePaying) {
    if (sentiment === 'angry')       factors.push({ label: 'Sentiment: angry', points: 60 })
    else if (sentiment === 'frustrated') factors.push({ label: 'Sentiment: frustrated', points: 50 })
    else if (sentiment === 'ghosting')   factors.push({ label: 'Client ghosting', points: 45 })
    else if (sentiment === 'concerned')  factors.push({ label: 'Sentiment: concerned', points: 35 })
    else if (sentiment === 'confused')   factors.push({ label: 'Sentiment: confused', points: 20 })
    else if (sentiment === 'neutral')    factors.push({ label: 'Sentiment: neutral', points: 5 })
  }
  if (isActivePaying && (client.stage === 'churn_risk' || (client.churn_risk_score ?? 0) >= 70))
    factors.push({ label: 'Churn risk (active client)', points: 50 })
  if (!isActivePaying && (sentiment === 'angry' || sentiment === 'frustrated'))
    factors.push({ label: `Sentiment: ${sentiment}`, points: 35 })
  if (sentiment === 'ghosting' && !isActivePaying)
    factors.push({ label: 'Client ghosting', points: 25 })
  if (client.thatcher_needed)
    factors.push({ label: 'Needs Thatcher', points: 40 })
  if (client.next_followup_date) {
    const d = client.next_followup_date
    if (d < todayStr)         factors.push({ label: 'Follow-up overdue', points: 40 })
    else if (d === todayStr)  factors.push({ label: 'Follow-up due today', points: 35 })
    else if ((daysUntil(d) ?? 99) <= 2) factors.push({ label: 'Follow-up due soon', points: 15 })
  }
  if (daysSinceContact >= 2)
    factors.push({ label: `No contact in ${daysSinceContact === 999 ? 'a long time' : `${daysSinceContact} days`}`, points: 20 })
  if (client.urgency_level === 'critical')
    factors.push({ label: 'Urgency: critical', points: 30 })
  if (client.urgency_level === 'high')
    factors.push({ label: 'Urgency: high', points: 15 })
  if (client.ad_status === 'off')
    factors.push({ label: 'Ads are off', points: 25 })
  if (client.cpl && client.cpl > 10)
    factors.push({ label: `High CPL: $${client.cpl}`, points: 20 })
  if (!client.bookings)
    factors.push({ label: 'No bookings recorded', points: 15 })

  return factors.sort((a, b) => b.points - a.points)
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
