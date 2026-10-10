'use client'

import { useRouter } from 'next/navigation'
import { Clock, Plus, ExternalLink, ChevronRight } from 'lucide-react'
import { cn, formatCurrency, formatDate, daysUntil, timeAgo, localToday, stageLabel } from '@/lib/utils'
import type { MediaAccountLog, Client } from '@/types'

export type MediaAccountRow = Client & {
  latest?: MediaAccountLog | null
  last_checked?: string | null
  next_followup?: string | null
  log_count?: number
}

function stageCls(stage?: string | null) {
  if (stage === 'active_client' || stage === 'won_back') return 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
  if (stage === 'overdue' || stage === 'payment_issue' || stage === 'churn_risk') return 'bg-red-500/10 text-red-300 border-red-500/20'
  if (stage === 'paused') return 'bg-slate-500/10 text-slate-300 border-slate-500/20'
  return 'bg-secondary/50 text-muted-foreground border-border'
}

function followupChip(date?: string | null) {
  if (!date) return { label: 'No follow-up', cls: 'bg-secondary/60 text-muted-foreground border-border/40' }
  const d = daysUntil(date)
  const t = localToday()
  const short = formatDate(date).replace(/,?\s*\d{4}$/, '')
  if (date < t) return { label: `Follow-up overdue · ${short}`, cls: 'bg-red-500/15 text-red-400 border-red-500/25' }
  if (date === t) return { label: 'Follow-up today', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' }
  if (d === 1) return { label: 'Follow-up tomorrow', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' }
  return { label: `Follow-up ${short}`, cls: 'bg-secondary/60 text-muted-foreground border-border/40' }
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null
  return <span><span className="text-foreground/80 font-medium tabular-nums">{value}</span> <span className="text-muted-foreground/60">{label}</span></span>
}

// A Media Buying account card — same visual language as the calls-list card,
// but with ad-review data and a "Log Review" action (no call actions).
export function MediaAccountCard({ account: a, onLog }: { account: MediaAccountRow; onLog: () => void }) {
  const router = useRouter()
  const l = a.latest
  const chip = followupChip(a.next_followup)
  const open = () => router.push(`/media-buying/${a.id}`)
  const short = (d?: string | null) => (d ? formatDate(d).replace(/,?\s*\d{4}$/, '') : '')

  return (
    <div className="bg-card rounded-2xl overflow-hidden border border-border/40">
      {/* Status strip */}
      <div className="flex items-center gap-3 px-6 py-2.5 bg-secondary/25 border-b border-border/40 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          {a.last_checked ? `Reviewed ${timeAgo(a.last_checked)}` : <span className="text-amber-400/90">Never reviewed</span>}
          {a.log_count ? <span className="text-muted-foreground/50"> · {a.log_count} log{a.log_count > 1 ? 's' : ''}</span> : null}
        </span>
        <span className={cn('ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap', chip.cls)}>{chip.label}</span>
      </div>

      {/* Main row */}
      <div className="flex items-start gap-6 px-6 py-5">
        <div className="flex-1 min-w-0">
          <button onClick={open} className="text-lg font-semibold text-foreground hover:text-primary transition-colors text-left">
            {a.name}
          </button>
          {(a.business_name || a.market_location) && (
            <div className="text-sm text-muted-foreground mt-0.5">
              {[a.business_name, a.market_location].filter(Boolean).join(' · ')}
            </div>
          )}
          {l?.creatives && (
            <div className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border bg-secondary/50 text-foreground/80 border-border/50">
              🎬 {l.creatives}
            </div>
          )}
        </div>

        <div className="flex-shrink-0 text-right hidden sm:block">
          <span className={cn('inline-block text-xs font-medium px-2.5 py-1 rounded-full border', stageCls(a.stage))}>
            {stageLabel(a.stage ?? '')}
          </span>
        </div>

        {l?.cpl != null && (
          <div className="flex-shrink-0 text-right">
            <div className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-0.5">CPL</div>
            <div className="text-sm font-semibold text-foreground/80 tabular-nums">{formatCurrency(l.cpl)}</div>
          </div>
        )}
      </div>

      {/* Metrics row */}
      {l && (l.leads != null || l.numbers_submitted != null || l.booked != null || l.spend != null || l.revenue != null || l.period_start) && (
        <div className="px-6 pb-3 flex items-center gap-x-5 gap-y-1 flex-wrap text-sm text-muted-foreground -mt-1">
          <Metric label="leads" value={l.leads} />
          <Metric label="numbers" value={l.numbers_submitted} />
          <Metric label="booked" value={l.booked} />
          <Metric label="spend" value={l.spend != null ? formatCurrency(l.spend) : null} />
          <Metric label="revenue" value={l.revenue != null ? formatCurrency(l.revenue) : null} />
          {l.period_start && l.period_end && (
            <span className="text-muted-foreground/50">{short(l.period_start)}–{short(l.period_end)}</span>
          )}
        </div>
      )}

      {/* Latest verdict / situation preview */}
      {(l?.verdict || l?.situation) && (
        <div className="px-6 pb-3">
          <p className="text-sm text-foreground/70 line-clamp-2">
            {l.verdict ? <><span className="text-muted-foreground text-xs uppercase tracking-wider mr-1.5">Verdict</span>{l.verdict}</> : l.situation}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="px-6 py-3 flex items-center gap-2 flex-wrap border-t border-border/40">
        <button onClick={onLog} className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
          <Plus className="w-4 h-4" /> Log Review
        </button>
        {a.ad_account_link && (
          <a href={a.ad_account_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border/50 text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> Ad account
          </a>
        )}
        <button onClick={open} className="ml-auto inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors">
          View account <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
