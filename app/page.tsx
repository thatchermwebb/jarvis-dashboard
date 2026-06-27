import { createClient } from '@/lib/supabase/server'
import { sortClientsByPriority } from '@/lib/scoring'
import { DailyBriefing, type BriefingClientLists } from '@/components/dashboard/DailyBriefing'
import { StatCard, AlertRow } from '@/components/dashboard/AlertPanel'
import { CollapsibleQueue } from '@/components/dashboard/CollapsibleQueue'
import type { Client, DashboardStats } from '@/types'
import { localToday, daysUntil } from '@/lib/utils'

export const dynamic = 'force-dynamic'

export default async function CommandCenter() {
  const supabase = await createClient()

  const [{ data: clients }, { data: tasks }] = await Promise.all([
    supabase.from('clients').select('*').not('stage', 'eq', 'churned'),
    supabase.from('tasks').select('id').neq('status', 'done'),
  ])

  const allClients = (clients ?? []) as Client[]
  const todayStr = localToday()
  function addDayStr(days: number): string {
    const [y, m, d] = todayStr.split('-').map(Number)
    const ms = Date.UTC(y, m - 1, d) + days * 86_400_000
    const dt = new Date(ms)
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
  }
  const in48hStr = addDayStr(2)
  const in7dStr  = addDayStr(7)

  const trialStages = ['free_trial', 'free_trial_pending', 'trial_ending_soon']
  const trialClients = allClients.filter(c => trialStages.includes(c.stage))

  const stats: DashboardStats = {
    active_clients: allClients.filter(c => c.stage === 'active_client' || c.stage === 'won_back').length,
    free_trials: trialClients.length,
    trials_ending_today: trialClients.filter(c => c.trial_end === todayStr).length,
    trials_ending_this_week: trialClients.filter(c => {
      if (!c.trial_end) return false
      return c.trial_end > todayStr && c.trial_end <= in7dStr
    }).length,
    payment_issues: allClients.filter(c => c.payment_issue || c.stage === 'overdue' || c.stage === 'payment_issue').length,
    at_risk_clients: allClients.filter(c => c.stage === 'overdue' || c.stage === 'churn_risk' || (c.churn_risk_score ?? 0) >= 60).length,
    close_ready_trials: trialClients.filter(c => (c.trial_health_score ?? 0) >= 80 || c.last_client_sentiment === 'close_ready').length,
    thatcher_needed: allClients.filter(c => c.thatcher_needed).length,
    va_tasks_open: tasks?.length ?? 0,
    overdue_followups: allClients.filter(c => c.next_followup_date && c.next_followup_date < todayStr).length,
    monthly_recurring_revenue: allClients
      .filter(c => (c.stage === 'active_client' || c.stage === 'won_back') && c.monthly_retainer)
      .reduce((sum, c) => sum + (c.monthly_retainer ?? 0), 0),
    weekly_recurring_revenue: 0,
  }

  const thirtyDaysAgoStr = addDayStr(-30)
  const mrrThirtyDaysAgo = allClients
    .filter(c => (c.stage === 'active_client' || c.stage === 'won_back') && c.monthly_retainer && c.created_at.slice(0, 10) < thirtyDaysAgoStr)
    .reduce((sum, c) => sum + (c.monthly_retainer ?? 0), 0)
  const mrrChange = mrrThirtyDaysAgo > 0
    ? Math.round(((stats.monthly_recurring_revenue - mrrThirtyDaysAgo) / mrrThirtyDaysAgo) * 100)
    : null

  const prioritized = sortClientsByPriority(allClients)
    .filter(c => !['churned', 'free_trial_lost', 'trial_concluded'].includes(c.stage))
    .slice(0, 5)

  const trialsEndingSoon     = trialClients.filter(c => c.trial_end && c.trial_end <= in48hStr)
  const trialsEndingToday    = trialClients.filter(c => c.trial_end === todayStr)
  const paymentIssueClients  = allClients.filter(c => c.payment_issue || c.stage === 'overdue' || c.stage === 'payment_issue')
  const atRiskClients        = allClients.filter(c => c.stage === 'overdue' || c.stage === 'churn_risk' || (c.churn_risk_score ?? 0) >= 60)
  const overdueClients       = allClients.filter(c => c.next_followup_date && c.next_followup_date < todayStr)
  const thatcherClients      = allClients.filter(c => c.thatcher_needed)
  const closeReadyClients    = trialClients.filter(c => (c.trial_health_score ?? 0) >= 80 || c.last_client_sentiment === 'close_ready')

  const briefingLists: BriefingClientLists = {
    trials_ending: trialsEndingToday.length > 0 ? trialsEndingToday : trialsEndingSoon,
    payment_issues: paymentIssueClients,
    close_ready: closeReadyClients,
    at_risk: atRiskClients,
    thatcher: thatcherClients,
    overdue: overdueClients,
  }

  return (
    <div className="space-y-8 max-w-6xl mx-auto">
      <DailyBriefing stats={stats} clientLists={briefingLists} mrrChange={mrrChange} />

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
          label="Close-Ready"
          value={stats.close_ready_trials}
          color="amber"
          href={stats.close_ready_trials > 0 ? '/clients?filter=close_ready' : undefined}
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
          label="Total Managed"
          value={allClients.length}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Priority queue — collapsible */}
        <div className="lg:col-span-2 order-2 lg:order-1">
          <CollapsibleQueue clients={prioritized} />
        </div>

        {/* Alerts — shown first on mobile, visually prominent */}
        <div className="order-1 lg:order-2">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-xl font-bold">Alerts</h2>
            {[trialsEndingSoon, paymentIssueClients, atRiskClients, thatcherClients, overdueClients].some(a => a.length > 0) && (
              <span className="text-xs font-bold bg-red-500/20 text-red-400 border border-red-500/30 rounded-full px-2 py-0.5">
                {[trialsEndingSoon, paymentIssueClients, atRiskClients, thatcherClients, overdueClients].reduce((n, a) => n + a.length, 0)}
              </span>
            )}
          </div>
          {[trialsEndingSoon, paymentIssueClients, atRiskClients, thatcherClients, overdueClients].every(a => !a.length) ? (
            <div className="bg-card border border-border rounded-xl p-6 text-center text-muted-foreground text-sm">
              No urgent alerts right now.
            </div>
          ) : (
            <div className="space-y-3">
              <AlertRow clients={trialsEndingSoon}    type="trials_ending" />
              <AlertRow clients={paymentIssueClients} type="payment_issues" />
              <AlertRow clients={thatcherClients}     type="thatcher" />
              <AlertRow clients={atRiskClients}       type="at_risk" />
              <AlertRow clients={overdueClients}      type="overdue" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
