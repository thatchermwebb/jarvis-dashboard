import { createClient } from '@/lib/supabase/server'
import { sortClientsByPriority } from '@/lib/scoring'
import { DailyBriefing } from '@/components/dashboard/DailyBriefing'
import { StatCard, AlertRow } from '@/components/dashboard/AlertPanel'
import { CollapsibleQueue } from '@/components/dashboard/CollapsibleQueue'
import { isAfter, isBefore, addDays, startOfDay } from 'date-fns'
import type { Client, DashboardStats } from '@/types'

export const dynamic = 'force-dynamic'

export default async function CommandCenter() {
  const supabase = await createClient()

  const [{ data: clients }, { data: tasks }] = await Promise.all([
    supabase.from('clients').select('*').not('stage', 'eq', 'churned'),
    supabase.from('tasks').select('id').neq('status', 'done'),
  ])

  const allClients = (clients ?? []) as Client[]
  const today = startOfDay(new Date())
  const in48h  = addDays(today, 2)
  const in7d   = addDays(today, 7)

  const trialStages = ['free_trial', 'free_trial_pending', 'trial_ending_soon']
  const trialClients = allClients.filter(c => trialStages.includes(c.stage))

  const stats: DashboardStats = {
    active_clients: allClients.filter(c => c.stage === 'active_client' || c.stage === 'won_back').length,
    free_trials: trialClients.length,
    trials_ending_today: trialClients.filter(c => {
      if (!c.trial_end) return false
      return startOfDay(new Date(c.trial_end)).getTime() === today.getTime()
    }).length,
    trials_ending_this_week: trialClients.filter(c => {
      if (!c.trial_end) return false
      const end = new Date(c.trial_end)
      return isAfter(end, today) && isBefore(end, in7d)
    }).length,
    payment_issues: allClients.filter(c => c.payment_issue || c.stage === 'overdue' || c.stage === 'payment_issue').length,
    at_risk_clients: allClients.filter(c => c.stage === 'overdue' || c.stage === 'churn_risk' || (c.churn_risk_score ?? 0) >= 60).length,
    close_ready_trials: trialClients.filter(c => (c.trial_health_score ?? 0) >= 80 || c.last_client_sentiment === 'close_ready').length,
    thatcher_needed: allClients.filter(c => c.thatcher_needed).length,
    va_tasks_open: tasks?.length ?? 0,
    overdue_followups: allClients.filter(c => c.next_followup_date && isBefore(new Date(c.next_followup_date), today)).length,
    monthly_recurring_revenue: allClients
      .filter(c => (c.stage === 'active_client' || c.stage === 'won_back') && c.monthly_retainer)
      .reduce((sum, c) => sum + (c.monthly_retainer ?? 0), 0),
    weekly_recurring_revenue: 0,
  }

  const prioritized = sortClientsByPriority(allClients)
    .filter(c => !['churned', 'free_trial_lost', 'trial_concluded'].includes(c.stage))
    .slice(0, 5)

  const trialsEndingSoon     = trialClients.filter(c => c.trial_end && isBefore(new Date(c.trial_end), in48h))
  const paymentIssueClients  = allClients.filter(c => c.payment_issue || c.stage === 'overdue' || c.stage === 'payment_issue')
  const atRiskClients        = allClients.filter(c => c.stage === 'overdue' || c.stage === 'churn_risk' || (c.churn_risk_score ?? 0) >= 60)
  const overdueClients       = allClients.filter(c => c.next_followup_date && isBefore(new Date(c.next_followup_date), today))
  const thatcherClients      = allClients.filter(c => c.thatcher_needed)

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <DailyBriefing stats={stats} />

      {/* Stat cards — clickable, bigger */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Active Clients"
          value={stats.active_clients}
          color="green"
          href="/clients?stage=active_client"
        />
        <StatCard
          label="Free Trials"
          value={stats.free_trials}
          color="violet"
          href="/clients?filter=free_trials"
        />
        <StatCard
          label="Ending Today"
          value={stats.trials_ending_today}
          color={stats.trials_ending_today > 0 ? 'red' : 'default'}
          href={stats.trials_ending_today > 0 ? '/clients?filter=ending_today' : undefined}
        />
        <StatCard
          label="Payment Issues"
          value={stats.payment_issues}
          color={stats.payment_issues > 0 ? 'red' : 'default'}
          href={stats.payment_issues > 0 ? '/clients?filter=payment_issues' : undefined}
        />
        <StatCard
          label="Close-Ready"
          value={stats.close_ready_trials}
          color="amber"
          href={stats.close_ready_trials > 0 ? '/clients?filter=close_ready' : undefined}
        />
        <StatCard
          label="VA Tasks Open"
          value={stats.va_tasks_open}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Priority queue — collapsible */}
        <div className="lg:col-span-2">
          <CollapsibleQueue clients={prioritized} />
        </div>

        {/* Alerts */}
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">Alerts</h2>
          {[trialsEndingSoon, paymentIssueClients, atRiskClients, thatcherClients, overdueClients].every(a => !a.length) ? (
            <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
              No urgent alerts right now.
            </div>
          ) : (
            <>
              <AlertRow clients={trialsEndingSoon}    type="trials_ending" />
              <AlertRow clients={paymentIssueClients} type="payment_issues" />
              <AlertRow clients={thatcherClients}     type="thatcher" />
              <AlertRow clients={atRiskClients}       type="at_risk" />
              <AlertRow clients={overdueClients}      type="overdue" />
            </>
          )}
        </div>
      </div>
    </div>
  )
}
