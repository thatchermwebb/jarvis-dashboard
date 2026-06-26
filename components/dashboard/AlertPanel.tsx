'use client'

import { useRouter } from 'next/navigation'
import { cn, stageLabel, formatDate } from '@/lib/utils'
import type { Client, DashboardStats } from '@/types'

interface StatCardProps {
  label: string
  value: number | string
  sub?: string
  color?: 'default' | 'red' | 'amber' | 'green' | 'violet'
  onClick?: () => void
}

export function StatCard({ label, value, sub, color = 'default', onClick }: StatCardProps) {
  const colors = {
    default: 'border-border',
    red: 'border-red-500/30 bg-red-500/5',
    amber: 'border-amber-500/30 bg-amber-500/5',
    green: 'border-emerald-500/30 bg-emerald-500/5',
    violet: 'border-violet-500/30 bg-violet-500/5',
  }
  const valueColors = {
    default: 'text-foreground',
    red: 'text-red-400',
    amber: 'text-amber-400',
    green: 'text-emerald-400',
    violet: 'text-violet-400',
  }

  return (
    <button
      onClick={onClick}
      className={cn(
        'bg-card border rounded-xl px-4 py-3 text-left transition-all hover:scale-[1.01] active:scale-[0.99] w-full',
        colors[color]
      )}
    >
      <div className={cn('text-2xl font-bold tabular-nums', valueColors[color])}>{value}</div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
      {sub && <div className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</div>}
    </button>
  )
}

interface AlertRowProps {
  clients: Client[]
  type: 'trials_ending' | 'payment_issues' | 'at_risk' | 'overdue' | 'thatcher'
}

export function AlertRow({ clients, type }: AlertRowProps) {
  const router = useRouter()

  const configs = {
    trials_ending: { label: '⏰ Trials Ending Soon', color: 'text-amber-400', bg: 'bg-amber-500/10 border-amber-500/20' },
    payment_issues: { label: '💳 Payment Issues', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    at_risk: { label: '⚠️ Churn Risk', color: 'text-red-400', bg: 'bg-red-500/10 border-red-500/20' },
    overdue: { label: '📅 Overdue Follow-Ups', color: 'text-orange-400', bg: 'bg-orange-500/10 border-orange-500/20' },
    thatcher: { label: '⭐ Needs Thatcher', color: 'text-violet-400', bg: 'bg-violet-500/10 border-violet-500/20' },
  }

  const cfg = configs[type]
  if (!clients.length) return null

  return (
    <div className={cn('border rounded-xl p-4', cfg.bg)}>
      <div className={cn('text-xs font-medium mb-2', cfg.color)}>{cfg.label}</div>
      <div className="space-y-1.5">
        {clients.slice(0, 5).map((c) => (
          <button
            key={c.id}
            onClick={() => router.push(`/clients/${c.id}`)}
            className="w-full text-left flex items-center justify-between hover:bg-white/5 rounded-md px-2 py-1 transition-colors"
          >
            <span className="text-sm text-foreground">{c.name}</span>
            <span className="text-xs text-muted-foreground">
              {type === 'trials_ending' && c.trial_end ? `ends ${formatDate(c.trial_end)}` : ''}
              {type === 'payment_issues' ? 'payment failed' : ''}
              {type === 'at_risk' ? stageLabel(c.stage) : ''}
              {type === 'overdue' && c.next_followup_date ? formatDate(c.next_followup_date) : ''}
              {type === 'thatcher' ? (c.stage === 'free_trial' ? 'close call' : 'save call') : ''}
            </span>
          </button>
        ))}
        {clients.length > 5 && (
          <div className="text-xs text-muted-foreground px-2">+{clients.length - 5} more</div>
        )}
      </div>
    </div>
  )
}
