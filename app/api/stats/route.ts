import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { localToday, daysBetween } from '@/lib/utils'
import type { Client, DashboardStats } from '@/types'

export async function GET() {
  const supabase = await createClient()

  const { data: clients } = await supabase.from('clients').select('*')
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id')
    .not('status', 'eq', 'done')

  const allClients = (clients ?? []) as Client[]
  // Use YYYY-MM-DD string arithmetic — no Date objects, no timezone shifts
  const todayStr = localToday()

  const trialClients = allClients.filter(
    (c) => c.stage === 'free_trial' || c.stage === 'trial_ending_soon'
  )

  const stats: DashboardStats = {
    active_clients: allClients.filter((c) => c.stage === 'active_client').length,
    free_trials: trialClients.length,
    trials_ending_today: trialClients.filter((c) =>
      c.trial_end && c.trial_end.slice(0, 10) === todayStr
    ).length,
    trials_ending_this_week: trialClients.filter((c) => {
      if (!c.trial_end) return false
      const d = daysBetween(todayStr, c.trial_end.slice(0, 10))
      return d > 0 && d <= 7
    }).length,
    payment_issues: allClients.filter((c) => c.payment_issue || c.stage === 'payment_issue').length,
    at_risk_clients: allClients.filter(
      (c) => c.stage === 'churn_risk' || (c.churn_risk_score ?? 0) >= 60
    ).length,
    close_ready_trials: trialClients.filter(
      (c) => (c.trial_health_score ?? 0) >= 80 || c.last_client_sentiment === 'close_ready'
    ).length,
    thatcher_needed: allClients.filter((c) => c.thatcher_needed).length,
    va_tasks_open: tasks?.length ?? 0,
    overdue_followups: allClients.filter(
      (c) =>
        c.next_followup_date &&
        c.next_followup_date.slice(0, 10) < todayStr &&
        !['churned'].includes(c.stage)
    ).length,
    monthly_recurring_revenue: allClients
      .filter((c) => c.stage === 'active_client' && c.monthly_retainer)
      .reduce((sum, c) => sum + (c.monthly_retainer ?? 0), 0),
    weekly_recurring_revenue: allClients
      .filter((c) => c.stage === 'active_client' && c.payment_frequency === 'weekly' && c.monthly_retainer)
      .reduce((sum, c) => sum + ((c.monthly_retainer ?? 0) / 4), 0),
  }

  // Trials ending in 48h (alert)
  const trialsEndingSoon = trialClients.filter((c) => {
    if (!c.trial_end) return false
    const d = daysBetween(todayStr, c.trial_end.slice(0, 10))
    return d > 0 && d <= 2
  })

  return NextResponse.json({ stats, trialsEndingSoon })
}
