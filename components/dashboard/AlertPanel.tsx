'use client'

import { useRouter } from 'next/navigation'
import { cn, stageLabel, formatDate } from '@/lib/utils'
import type { Client } from '@/types'

interface StatCardProps {
  label: string
  value: number | string
  sub?: string
  color?: 'default' | 'red' | 'amber' | 'green' | 'violet'
  href?: string
}

export function StatCard({ label, value, sub, color = 'default', href }: StatCardProps) {
  const router = useRouter()
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
      onClick={() => href && router.push(href)}
      className={cn(
        'bg-card border rounded-2xl px-5 py-4 text-left transition-all w-full',
        href && 'hover:scale-[1.02] active:scale-[0.98] cursor-pointer hover:shadow-md',
        !href && 'cursor-default',
        colors[color]
      )}
    >
      <div className={cn('text-3xl font-bold tabular-nums', valueColors[color])}>{value}</div>
      <div className="text-sm text-muted-foreground mt-1">{label}</div>
      {sub && <div className="text-xs text-muted-foreground/70 mt-0.5">{sub}</div>}
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
    <div className={cn('border rounded-2xl p-5', cfg.bg)}>
      <div className={cn('text-sm font-semibold mb-3 tracking-wide', cfg.color)}>{cfg.label}</div>
      <div className="space-y-2">
        {clients.slice(0, 5).map((c) => (
          <button
            key={c.id}
            onClick={() => router.push(`/clients/${c.id}`)}
            className="w-full text-left flex items-center justify-between hover:bg-white/5 rounded-lg px-2 py-1.5 transition-colors group"
          >
            <span className="text-sm text-foreground group-hover:text-primary transition-colors">{c.name}</span>
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
