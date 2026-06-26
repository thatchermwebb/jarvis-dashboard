import { createClient } from '@/lib/supabase/server'
import { formatCurrency, formatDate } from '@/lib/utils'
import type { Client } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ReportsPage() {
  const supabase = await createClient()

  const { data: allClients } = await supabase.from('clients').select('*')
  const { data: allTasks } = await supabase.from('tasks').select('*')
  const { data: allLogs } = await supabase
    .from('communication_logs')
    .select('*')
    .gte('created_at', new Date(Date.now() - 7 * 86400000).toISOString())

  const clients = (allClients ?? []) as Client[]
  const activeClients = clients.filter((c) => c.stage === 'active_client')
  const trialClients = clients.filter((c) => c.stage === 'free_trial' || c.stage === 'trial_ending_soon')

  const mrr = activeClients.reduce((sum, c) => sum + (c.monthly_retainer ?? 0), 0)
  const wkr = activeClients
    .filter((c) => c.payment_frequency === 'weekly')
    .reduce((sum, c) => sum + ((c.monthly_retainer ?? 0) / 4), 0)

  const tasksOpen = (allTasks ?? []).filter((t) => t.status !== 'done').length
  const tasksDone = (allTasks ?? []).filter((t) => t.status === 'done').length

  const logsThisWeek = allLogs?.length ?? 0
  const callsThisWeek = allLogs?.filter((l) => l.log_type === 'call').length ?? 0

  const stageGroups = clients.reduce((acc, c) => {
    acc[c.stage] = (acc[c.stage] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Reports & Dashboard</h1>
        <p className="text-xs text-muted-foreground">Agency metrics and Diego's performance</p>
      </div>

      {/* Revenue */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Revenue</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-emerald-500/30 bg-emerald-500/5 rounded-xl px-4 py-3">
            <div className="text-2xl font-bold text-emerald-400">{formatCurrency(mrr)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Monthly MRR</div>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <div className="text-2xl font-bold text-blue-400">{formatCurrency(wkr)}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Weekly Revenue</div>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3">
            <div className="text-2xl font-bold text-foreground">{activeClients.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Active Clients</div>
          </div>
          <div className="bg-card border border-violet-500/30 bg-violet-500/5 rounded-xl px-4 py-3">
            <div className="text-2xl font-bold text-violet-400">{trialClients.length}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Active Trials</div>
          </div>
        </div>
      </div>

      {/* Diego Scoreboard */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Diego's Scoreboard (This Week)</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
            <div className="text-2xl font-bold text-foreground">{logsThisWeek}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Contacts Logged</div>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
            <div className="text-2xl font-bold text-foreground">{callsThisWeek}</div>
            <div className="text-xs text-muted-foreground mt-0.5">Calls Made</div>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
            <div className="text-2xl font-bold text-foreground">{tasksDone}</div>
            <div className="text-xs text-muted-foreground mt-0.5">VA Tasks Resolved</div>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
            <div className="text-2xl font-bold text-foreground">{tasksOpen}</div>
            <div className="text-xs text-muted-foreground mt-0.5">VA Tasks Open</div>
          </div>
        </div>
      </div>

      {/* Pipeline breakdown */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pipeline Breakdown</h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 text-xs text-muted-foreground">Stage</th>
                <th className="text-right px-4 py-2 text-xs text-muted-foreground">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Object.entries(stageGroups)
                .sort(([, a], [, b]) => b - a)
                .map(([stage, count]) => (
                  <tr key={stage} className="hover:bg-secondary/20">
                    <td className="px-4 py-2 capitalize">{stage.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2 text-right font-medium">{count}</td>
                  </tr>
                ))}
              <tr className="bg-secondary/20">
                <td className="px-4 py-2 font-medium">Total</td>
                <td className="px-4 py-2 text-right font-bold">{clients.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Top clients by retainer */}
      {activeClients.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active Client Revenue</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground">Retainer</th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground">Frequency</th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground">Market</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeClients
                  .sort((a, b) => (b.monthly_retainer ?? 0) - (a.monthly_retainer ?? 0))
                  .map((c) => (
                    <tr key={c.id} className="hover:bg-secondary/20">
                      <td className="px-4 py-2 font-medium">{c.name}</td>
                      <td className="px-4 py-2 text-emerald-400">{formatCurrency(c.monthly_retainer)}</td>
                      <td className="px-4 py-2 text-muted-foreground">{c.payment_frequency ?? 'monthly'}</td>
                      <td className="px-4 py-2 text-muted-foreground">{c.market_location ?? '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
