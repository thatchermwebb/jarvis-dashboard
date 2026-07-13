'use client'

import { CheckCircle2, XCircle, Trash2, Zap, Timer } from 'lucide-react'
import { cn } from '@/lib/utils'
import { workedHours, kpiHit, kpiCountable, kpiEligible, responseSeconds, turnaroundSeconds, type VaConfig } from '@/lib/team'
import type { TeamTimeEntry } from '@/types'

function fmtTime(iso?: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function fmtDur(secs: number | null): string {
  if (secs == null) return '—'
  const m = Math.floor(secs / 60)
  const s = secs % 60
  if (m < 60) return s === 0 ? `${m}m` : `${m}m ${s}s`
  const h = Math.floor(m / 60)
  return `${h}h ${m % 60}m`
}

// A finished task: time in/out (browser-local tz), worked hours as decimals,
// standard badge, and a KPI hit/miss stamp.
export function CompletedCard({ entry, cfg, onDelete }: {
  entry: TeamTimeEntry
  cfg: VaConfig
  onDelete?: () => void
}) {
  const hrs = workedHours(entry)
  const standard = entry.is_standard
  const eligible = kpiEligible(entry)
  const hit = kpiHit(entry, cfg)
  const countable = kpiCountable(entry)
  const response = responseSeconds(entry)
  const turnaround = turnaroundSeconds(entry)
  const hasAssignment = !!entry.assigned_at

  return (
    <div className={cn(
      'group relative rounded-xl border px-4 py-3 transition-colors',
      countable
        ? hit
          ? 'border-emerald-500/30 bg-emerald-500/[0.06]'
          : 'border-amber-500/30 bg-amber-500/[0.05]'
        : 'border-border bg-card',
    )}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">
              {entry.description || 'Untitled task'}
            </span>
            {standard && (
              <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/15 text-primary border border-primary/25">
                {cfg.standardLabel}
              </span>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {fmtTime(entry.started_at)} → {fmtTime(entry.completed_at)}
            <span className="mx-1.5 text-muted-foreground/40">·</span>
            <span className="font-semibold text-foreground/80 tabular-nums">{hrs.toFixed(2)} hrs</span>
          </div>
          {/* Turnaround + response — the metrics that matter */}
          {hasAssignment && (
            <div className="mt-1.5 flex items-center gap-2 flex-wrap">
              <span className={cn('inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded',
                hit ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400')}>
                <Timer className="w-3 h-3" /> {fmtDur(turnaround)} turnaround
              </span>
              {response != null && (
                <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground/70">
                  <Zap className="w-3 h-3" /> started {fmtDur(response)} after assigned
                </span>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          {countable ? (
            hit ? (
              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                <CheckCircle2 className="w-3.5 h-3.5" /> KPI
              </span>
            ) : (
              <span className="flex items-center gap-1 text-[10px] font-bold text-amber-400">
                <XCircle className="w-3.5 h-3.5" /> MISS
              </span>
            )
          ) : standard && hasAssignment && !eligible ? (
            <span className="text-[9px] text-muted-foreground/60 uppercase tracking-wide">off-hours</span>
          ) : null}
          {onDelete && (
            <button onClick={onDelete} className="opacity-0 group-hover:opacity-100 text-muted-foreground/30 hover:text-red-400 transition-all">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
