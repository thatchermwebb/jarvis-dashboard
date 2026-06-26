'use client'

import { format } from 'date-fns'
import { formatCurrency } from '@/lib/utils'
import type { DashboardStats } from '@/types'

interface Props {
  stats: DashboardStats
}

export function DailyBriefing({ stats }: Props) {
  const today = format(new Date(), 'EEEE, MMMM d')

  const lines: string[] = []
  if (stats.trials_ending_today > 0)
    lines.push(`🔥 ${stats.trials_ending_today} trial${stats.trials_ending_today > 1 ? 's' : ''} end${stats.trials_ending_today === 1 ? 's' : ''} today`)
  if (stats.overdue_followups > 0)
    lines.push(`📅 ${stats.overdue_followups} overdue follow-up${stats.overdue_followups > 1 ? 's' : ''}`)
  if (stats.payment_issues > 0)
    lines.push(`💳 ${stats.payment_issues} payment issue${stats.payment_issues > 1 ? 's' : ''} to resolve`)
  if (stats.close_ready_trials > 0)
    lines.push(`🎯 ${stats.close_ready_trials} trial${stats.close_ready_trials > 1 ? 's' : ''} close-ready — book Thatcher`)
  if (stats.thatcher_needed > 0)
    lines.push(`⭐ ${stats.thatcher_needed} client${stats.thatcher_needed > 1 ? 's' : ''} need${stats.thatcher_needed === 1 ? 's' : ''} Thatcher`)
  if (stats.at_risk_clients > 0)
    lines.push(`⚠️ ${stats.at_risk_clients} client${stats.at_risk_clients > 1 ? 's' : ''} at churn risk`)

  if (lines.length === 0)
    lines.push('✅ No critical items. Great shape today.')

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-muted-foreground uppercase tracking-widest mb-1">Daily Briefing</div>
          <div className="text-lg font-semibold text-foreground">{today}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted-foreground">MRR</div>
          <div className="text-xl font-bold text-emerald-400">{formatCurrency(stats.monthly_recurring_revenue)}</div>
          <div className="text-xs text-muted-foreground">{stats.active_clients} active clients</div>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        {lines.map((line, i) => (
          <div key={i} className="text-sm text-foreground/90">
            {line}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-border grid grid-cols-4 gap-3 text-center">
        <div>
          <div className="text-lg font-bold text-violet-400">{stats.free_trials}</div>
          <div className="text-[10px] text-muted-foreground">Active Trials</div>
        </div>
        <div>
          <div className="text-lg font-bold text-amber-400">{stats.trials_ending_this_week}</div>
          <div className="text-[10px] text-muted-foreground">Ending This Week</div>
        </div>
        <div>
          <div className="text-lg font-bold text-blue-400">{stats.va_tasks_open}</div>
          <div className="text-[10px] text-muted-foreground">VA Tasks Open</div>
        </div>
        <div>
          <div className="text-lg font-bold text-foreground">{stats.active_clients + stats.free_trials}</div>
          <div className="text-[10px] text-muted-foreground">Total Managed</div>
        </div>
      </div>
    </div>
  )
}
