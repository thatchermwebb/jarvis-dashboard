'use client'

import { useState, useEffect, useCallback, useRef, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Search, AlertTriangle, Upload, LayoutGrid, List, Table2, ChevronLeft, ChevronDown, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown, Trash2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ClientForm } from '@/components/clients/ClientForm'
import { ImportClientsDialog } from '@/components/clients/ImportClientsDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useIsMobile } from '@/hooks/useIsMobile'
import { cn, sentimentEmoji, timeAgo, formatCurrency, localToday } from '@/lib/utils'
import { getTrialDaysLeft } from '@/lib/scoring'
import type { Client, ClientStage } from '@/types'

const LIST_GROUPS = [
  { label: 'Active',                stages: ['active_client', 'won_back'],           color: 'text-emerald-400', border: 'border-l-emerald-500', dot: 'bg-emerald-500' },
  { label: 'Free Trial (Complete)', stages: ['trial_concluded'],                      color: 'text-teal-400',    border: 'border-l-teal-500',    dot: 'bg-teal-500'    },
  { label: 'Free Trial (Active)',   stages: ['free_trial', 'trial_ending_soon'],      color: 'text-violet-400',  border: 'border-l-violet-500',  dot: 'bg-violet-500'  },
  { label: 'Free Trial (Pending)',  stages: ['free_trial_pending'],                   color: 'text-amber-400',   border: 'border-l-amber-500',   dot: 'bg-amber-500'   },
  { label: 'Onboarding',           stages: ['onboarding'],                            color: 'text-blue-400',    border: 'border-l-blue-500',    dot: 'bg-blue-500'    },
  { label: 'Overdue',              stages: ['overdue', 'payment_issue', 'churn_risk'],color: 'text-red-400',     border: 'border-l-red-500',     dot: 'bg-red-500'     },
  { label: 'Paused',               stages: ['paused'],                                color: 'text-slate-400',   border: 'border-l-slate-500',   dot: 'bg-slate-500'   },
  { label: 'Churned / Lost',       stages: ['churned', 'free_trial_lost'],            color: 'text-muted-foreground', border: 'border-l-border', dot: 'bg-muted-foreground' },
]

const KANBAN_COLUMNS: { stage: ClientStage; label: string; headerBg: string; dot: string }[] = [
  { stage: 'active_client',      label: 'Active',                headerBg: 'bg-emerald-500/15 border-emerald-500/30', dot: 'bg-emerald-400'      },
  { stage: 'trial_concluded',    label: 'Free Trial (Complete)', headerBg: 'bg-teal-500/15 border-teal-500/30',       dot: 'bg-teal-400'         },
  { stage: 'free_trial',         label: 'Free Trial (Active)',   headerBg: 'bg-violet-500/15 border-violet-500/30',   dot: 'bg-violet-400'       },
  { stage: 'free_trial_pending', label: 'Free Trial (Pending)',  headerBg: 'bg-amber-500/15 border-amber-500/30',     dot: 'bg-amber-400'        },
  { stage: 'onboarding',         label: 'Onboarding',            headerBg: 'bg-blue-500/15 border-blue-500/30',       dot: 'bg-blue-400'         },
  { stage: 'overdue',            label: 'Overdue',               headerBg: 'bg-red-500/15 border-red-500/30',         dot: 'bg-red-400'          },
  { stage: 'paused',             label: 'Paused',                headerBg: 'bg-slate-500/15 border-slate-500/30',     dot: 'bg-slate-400'        },
  { stage: 'churned',            label: 'Churned',               headerBg: 'bg-secondary/60 border-border',           dot: 'bg-muted-foreground' },
  { stage: 'free_trial_lost',    label: 'Free Trial (Lost)',     headerBg: 'bg-secondary/60 border-border',           dot: 'bg-muted-foreground' },
]

// URL ?filter= param → which stages to show
const URL_FILTER_STAGES: Record<string, string[]> = {
  free_trials:     ['free_trial', 'free_trial_pending', 'trial_ending_soon'],
  ending_today:    ['free_trial', 'free_trial_pending', 'trial_ending_soon'],
  payment_issues:  ['overdue', 'payment_issue', 'churn_risk'],
  close_ready:     ['trial_concluded', 'free_trial', 'trial_ending_soon'],
}

function isAtRisk(c: Client) {
  return !!(
    (c.churn_risk_score && c.churn_risk_score >= 60) ||
    c.urgency_level === 'critical' || c.urgency_level === 'high' ||
    c.payment_issue ||
    ['frustrated', 'angry', 'ghosting'].includes(c.last_client_sentiment ?? '')
  )
}

function atRiskReasons(c: Client): string[] {
  const reasons: string[] = []
  if (c.payment_issue) reasons.push('Payment issue flagged')
  if (c.urgency_level === 'critical') reasons.push('Urgency: critical')
  else if (c.urgency_level === 'high') reasons.push('Urgency: high')
  if (c.churn_risk_score && c.churn_risk_score >= 60) reasons.push(`Churn risk: ${c.churn_risk_score}%`)
  if (c.last_client_sentiment === 'frustrated') reasons.push('Sentiment: frustrated')
  else if (c.last_client_sentiment === 'angry') reasons.push('Sentiment: angry')
  else if (c.last_client_sentiment === 'ghosting') reasons.push('Client ghosting')
  return reasons
}

function RiskTooltip({ c }: { c: Client }) {
  const reasons = atRiskReasons(c)
  return (
    <span className="relative group/risk inline-flex">
      <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
      <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 z-50 hidden group-hover/risk:flex flex-col gap-0.5 bg-popover border border-border rounded-lg shadow-xl px-2.5 py-2 min-w-[160px] whitespace-nowrap">
        <span className="text-[10px] font-semibold text-red-400 mb-0.5">At risk</span>
        {reasons.map(r => (
          <span key={r} className="text-[11px] text-foreground/80">{r}</span>
        ))}
      </span>
    </span>
  )
}

function TrialTag({ c }: { c: Client }) {
  const isTrial = c.stage === 'free_trial' || c.stage === 'trial_ending_soon'
  if (!isTrial || !c.trial_end) return null
  const days = getTrialDaysLeft(c.trial_end)
  if (days === null) return null
  if (days <= 0) return <span className="text-[10px] leading-none px-1 py-0.5 rounded bg-red-950/60 text-red-400 border border-red-800/40 flex-shrink-0">🚨 ended</span>
  if (days <= 2) return <span className="text-[10px] leading-none px-1 py-0.5 rounded bg-amber-950/60 text-amber-400 border border-amber-800/40 flex-shrink-0">⏰ {days}d</span>
  return null
}

function ClientRow({ c, onClick, onDelete }: { c: Client; onClick: () => void; onDelete: (id: string) => void }) {
  const [confirm, setConfirm] = useState(false)
  const atRisk = isAtRisk(c)
  const today = localToday()
  const overdue = c.next_followup_date && c.next_followup_date < today
  const dueToday = c.next_followup_date === today
  return (
    <tr onClick={onClick} className="hover:bg-secondary/30 cursor-pointer transition-colors group">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-1.5">
          <span className="font-medium truncate max-w-[130px]">{c.name}</span>
          {atRisk && <RiskTooltip c={c} />}
          <TrialTag c={c} />
        </div>
        {c.business_name && <div className="text-xs text-muted-foreground truncate max-w-[130px]">{c.business_name}</div>}
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground truncate max-w-[100px]">{c.market_location || '—'}</td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{timeAgo(c.last_contact_date)}</td>
      <td className="px-3 py-2.5 text-xs whitespace-nowrap">
        {c.next_followup_date
          ? <span className={overdue ? 'text-red-400' : dueToday ? 'text-amber-400' : 'text-muted-foreground'}>{new Date(c.next_followup_date + 'T00:00:00').toLocaleDateString()}</span>
          : <span className="text-muted-foreground">—</span>}
      </td>
      <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">{c.monthly_retainer ? formatCurrency(c.monthly_retainer) : '—'}</td>
      <td className="px-3 py-2.5 text-base">{sentimentEmoji(c.last_client_sentiment)}</td>
      <td className="px-3 py-2.5 text-right" onClick={e => e.stopPropagation()}>
        {confirm ? (
          <div className="flex items-center justify-end gap-1">
            <span className="text-[10px] text-red-400">Sure?</span>
            <button onClick={() => onDelete(c.id)} className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 px-2 py-0.5 rounded-md transition-all">Yes</button>
            <button onClick={() => setConfirm(false)} className="text-[10px] text-muted-foreground hover:text-foreground px-1 py-0.5">No</button>
          </div>
        ) : (
          <button
            onClick={() => setConfirm(true)}
            className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-red-400 transition-all p-1 rounded hover:bg-red-950/20"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </td>
    </tr>
  )
}

function ClientCardMobile({ c, onClick, onDelete }: { c: Client; onClick: () => void; onDelete: (id: string) => void }) {
  const [confirm, setConfirm] = useState(false)
  const atRisk = isAtRisk(c)
  const today = localToday()
  const overdue = c.next_followup_date && c.next_followup_date < today
  const dueToday = c.next_followup_date === today
  return (
    <div onClick={onClick} className="px-3.5 py-3 active:bg-secondary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-sm truncate">{c.name}</span>
            {atRisk && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
            <TrialTag c={c} />
          </div>
          {c.business_name && <div className="text-xs text-muted-foreground truncate">{c.business_name}</div>}
          <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground flex-wrap">
            {c.market_location && <span>{c.market_location}</span>}
            {c.last_contact_date && <span>· {timeAgo(c.last_contact_date)}</span>}
            {c.monthly_retainer && <span className="text-emerald-400 font-medium">{formatCurrency(c.monthly_retainer)}</span>}
          </div>
          {c.next_followup_date && (
            <div className={cn('text-[11px] mt-1', overdue ? 'text-red-400' : dueToday ? 'text-amber-400' : 'text-muted-foreground')}>
              Follow-up: {new Date(c.next_followup_date + 'T00:00:00').toLocaleDateString()}{overdue && ' (overdue)'}
            </div>
          )}
        </div>
        <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
          <span className="text-lg">{sentimentEmoji(c.last_client_sentiment)}</span>
          {confirm ? (
            <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
              <button onClick={() => onDelete(c.id)} className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/40 px-1.5 py-0.5 rounded-md">Yes</button>
              <button onClick={() => setConfirm(false)} className="text-[10px] text-muted-foreground px-1 py-0.5">No</button>
            </div>
          ) : (
            <button onClick={e => { e.stopPropagation(); setConfirm(true) }} className="text-muted-foreground/40 p-1">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function KanbanCard({
  c,
  onClick,
  onDragStart,
}: {
  c: Client
  onClick: () => void
  onDragStart: (e: React.DragEvent, id: string) => void
}) {
  const atRisk = isAtRisk(c)
  const today = localToday()
  const overdue = c.next_followup_date && c.next_followup_date < today
  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, c.id)}
      onClick={onClick}
      className="bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 hover:bg-secondary/20 transition-all space-y-1.5 select-none"
    >
      <div className="flex items-start justify-between gap-1">
        <div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-sm leading-tight">{c.name}</span>
            {atRisk && <RiskTooltip c={c} />}
          </div>
          {c.business_name && <div className="text-xs text-muted-foreground leading-tight mt-0.5">{c.business_name}</div>}
        </div>
        <span className="text-base flex-shrink-0">{sentimentEmoji(c.last_client_sentiment)}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground">
        {c.market_location && <span>{c.market_location}</span>}
        {c.monthly_retainer && <span className="text-emerald-400 font-medium">{formatCurrency(c.monthly_retainer)}</span>}
      </div>
      {c.next_followup_date && (
        <div className={cn('text-[11px]', overdue ? 'text-red-400' : c.next_followup_date === today ? 'text-amber-400' : 'text-muted-foreground')}>
          📅 {new Date(c.next_followup_date + 'T00:00:00').toLocaleDateString()}{overdue && ' (overdue)'}
        </div>
      )}
      {c.last_contact_date && <div className="text-[11px] text-muted-foreground">Last: {timeAgo(c.last_contact_date)}</div>}
    </div>
  )
}

function KanbanColumn({
  col,
  clients,
  onClientClick,
  onDragStart,
  onDrop,
  onAddClient,
}: {
  col: typeof KANBAN_COLUMNS[0]
  clients: Client[]
  onClientClick: (id: string) => void
  onDragStart: (e: React.DragEvent, id: string) => void
  onDrop: (stage: ClientStage) => void
  onAddClient: () => void
}) {
  const [collapsed, setCollapsed] = useState(false)
  const [dragOver, setDragOver] = useState(false)

  return (
    <div className={cn('flex-shrink-0 transition-all duration-200', collapsed ? 'w-12' : 'w-64')}>
      {/* Header */}
      <div
        className={cn('flex items-center gap-2 px-3 py-2.5 rounded-xl border mb-2 cursor-pointer select-none', col.headerBg)}
        onClick={() => setCollapsed(c => !c)}
      >
        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', col.dot)} />
        {!collapsed ? (
          <>
            <span className="text-xs font-semibold flex-1 truncate">{col.label}</span>
            <span className="text-xs text-muted-foreground font-normal">{clients.length}</span>
          </>
        ) : (
          <ChevronLeft className="w-3 h-3 text-muted-foreground rotate-180" />
        )}
      </div>

      {/* Drop zone */}
      {!collapsed && (
        <div
          className={cn(
            'min-h-[80px] rounded-xl transition-all space-y-2 p-1',
            dragOver && 'bg-primary/5 ring-2 ring-primary/30 ring-dashed'
          )}
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); onDrop(col.stage) }}
        >
          {clients.length === 0 ? (
            <div className={cn(
              'text-[11px] text-muted-foreground text-center py-6 rounded-lg border border-dashed',
              dragOver ? 'border-primary/40 text-primary/60' : 'bg-secondary/10 border-border'
            )}>
              {dragOver ? 'Drop here' : 'Empty'}
            </div>
          ) : (
            clients.map(c => (
              <KanbanCard
                key={c.id}
                c={c}
                onClick={() => onClientClick(c.id)}
                onDragStart={onDragStart}
              />
            ))
          )}
          {/* Add new client in this column */}
          <button
            onClick={onAddClient}
            className="w-full flex items-center gap-1.5 px-2 py-1.5 mt-1 rounded-lg text-[11px] text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors"
          >
            <Plus className="w-3 h-3" /> New client
          </button>
        </div>
      )}
    </div>
  )
}

function stageBadge(stage: ClientStage): { label: string; cls: string } {
  const map: Partial<Record<ClientStage, { label: string; cls: string }>> = {
    active_client:      { label: 'Active',         cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    won_back:           { label: 'Won Back',        cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
    free_trial:         { label: 'Free Trial',      cls: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
    trial_ending_soon:  { label: 'Trial Ending',    cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    trial_concluded:    { label: 'Trial Complete',  cls: 'bg-teal-500/15 text-teal-400 border-teal-500/30' },
    free_trial_pending: { label: 'Trial Pending',   cls: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30' },
    onboarding:         { label: 'Onboarding',      cls: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
    overdue:            { label: 'Overdue',         cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
    payment_issue:      { label: 'Payment Issue',   cls: 'bg-red-500/15 text-red-400 border-red-500/30' },
    churn_risk:         { label: 'Churn Risk',      cls: 'bg-orange-500/15 text-orange-400 border-orange-500/30' },
    paused:             { label: 'Paused',          cls: 'bg-slate-500/15 text-slate-400 border-slate-500/30' },
    churned:            { label: 'Churned',         cls: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30' },
    free_trial_lost:    { label: 'Trial Lost',      cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  }
  return map[stage] ?? { label: stage.replace(/_/g, ' '), cls: 'bg-secondary text-muted-foreground border-border' }
}

function SpreadsheetRow({ c, onClick }: { c: Client; onClick: () => void }) {
  const today = localToday()
  const badge = stageBadge(c.stage)
  const followupOverdue = c.next_followup_date && c.next_followup_date < today

  function fmtDate(d?: string | null) {
    if (!d) return '—'
    return new Date(d.slice(0, 10) + 'T00:00:00').toLocaleDateString()
  }
  function fmtDateTime(d?: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString()
  }

  const tdBase = 'px-3 py-2 text-xs whitespace-nowrap border-r border-border/40 last:border-r-0'
  const tdMuted = cn(tdBase, 'text-muted-foreground')

  return (
    <tr onClick={onClick} className="hover:bg-secondary/30 cursor-pointer transition-colors border-b border-border/50 group">
      {/* Name — sticky */}
      <td className={cn(tdBase, 'sticky left-0 z-10 bg-card group-hover:bg-secondary/30 font-medium min-w-[140px]')}>
        <div className="flex items-center gap-1.5">
          {c.name}
          {isAtRisk(c) && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
        </div>
      </td>
      <td className={tdMuted} style={{ minWidth: 160 }}>{c.business_name || '—'}</td>
      <td className={cn(tdBase, 'min-w-[120px]')}>
        <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-semibold border', badge.cls)}>
          {badge.label}
        </span>
      </td>
      <td className={cn(tdBase, 'text-emerald-400 font-medium min-w-[100px]')}>{c.monthly_retainer ? formatCurrency(c.monthly_retainer) : '—'}</td>
      <td className={tdMuted} style={{ minWidth: 130 }}>{c.phone || '—'}</td>
      <td className={tdMuted} style={{ minWidth: 200 }}>{c.email || '—'}</td>
      <td className={tdMuted} style={{ minWidth: 140 }}>{c.market_location || '—'}</td>
      <td className={tdMuted} style={{ minWidth: 100 }}>{c.payment_frequency || '—'}</td>
      <td className={tdMuted} style={{ minWidth: 100 }}>{c.payment_status || '—'}</td>
      <td className={tdMuted} style={{ minWidth: 180 }}>{c.advertised_package || '—'}</td>
      <td className={tdMuted} style={{ minWidth: 90 }}>{c.timezone || '—'}</td>
      <td className={tdMuted} style={{ minWidth: 110 }}>{c.assigned_va || '—'}</td>
      <td className={cn(tdBase, 'min-w-[110px]', followupOverdue ? 'text-red-400' : 'text-muted-foreground')}>
        {c.next_followup_date ? fmtDate(c.next_followup_date) : '—'}
      </td>
      <td className={tdMuted} style={{ minWidth: 110 }}>{c.last_contact_date ? fmtDate(c.last_contact_date) : '—'}</td>
      <td className={cn(tdBase, 'text-base min-w-[60px]')}>{sentimentEmoji(c.last_client_sentiment)}</td>
      <td className={tdMuted} style={{ minWidth: 100 }}>{c.trial_start ? fmtDate(c.trial_start) : '—'}</td>
      <td className={tdMuted} style={{ minWidth: 100 }}>{c.trial_end ? fmtDate(c.trial_end) : '—'}</td>
      <td className={tdMuted} style={{ minWidth: 90 }}>{c.signed_at ? fmtDate(c.signed_at) : '—'}</td>
      <td className={tdMuted} style={{ minWidth: 110 }}>{c.ad_status || '—'}</td>
      <td className={tdMuted} style={{ minWidth: 80 }}>{c.budget ? formatCurrency(c.budget) : '—'}</td>
      <td className={tdMuted} style={{ minWidth: 80 }}>{c.spend ? formatCurrency(c.spend) : '—'}</td>
      <td className={tdMuted} style={{ minWidth: 70 }}>{c.cpl ? `$${c.cpl}` : '—'}</td>
      <td className={cn(tdBase, 'min-w-[80px]')}>
        <div className="flex items-center gap-1.5">
          {c.ghl_location_link && (
            <a href={c.ghl_location_link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="text-[10px] px-1.5 py-0.5 rounded bg-violet-500/15 text-violet-400 border border-violet-500/30 hover:bg-violet-500/25 inline-flex items-center gap-0.5">
              GHL <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
          {c.campaign_link && (
            <a href={c.campaign_link} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
              className="text-[10px] px-1.5 py-0.5 rounded bg-blue-500/15 text-blue-400 border border-blue-500/30 hover:bg-blue-500/25 inline-flex items-center gap-0.5">
              Ads <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
          {!c.ghl_location_link && !c.campaign_link && <span className="text-muted-foreground">—</span>}
        </div>
      </td>
      <td className={tdMuted} style={{ minWidth: 110 }}>{fmtDateTime(c.created_at)}</td>
    </tr>
  )
}

type TableSortField =
  | 'name' | 'business_name' | 'stage' | 'monthly_retainer'
  | 'market_location' | 'payment_frequency' | 'payment_status'
  | 'advertised_package' | 'timezone' | 'assigned_va'
  | 'next_followup_date' | 'last_contact_date' | 'last_client_sentiment'
  | 'trial_start' | 'trial_end' | 'signed_at'
  | 'ad_status' | 'budget' | 'spend' | 'cpl' | 'created_at'

const SPREADSHEET_HEADERS: { label: string; sticky?: boolean; sortKey?: TableSortField }[] = [
  { label: 'Name',              sticky: true, sortKey: 'name' },
  { label: 'Business',                        sortKey: 'business_name' },
  { label: 'Status',                          sortKey: 'stage' },
  { label: 'Monthly ($)',                     sortKey: 'monthly_retainer' },
  { label: 'Phone' },
  { label: 'Email' },
  { label: 'Location',                        sortKey: 'market_location' },
  { label: 'Payment Freq',                    sortKey: 'payment_frequency' },
  { label: 'Payment Status',                  sortKey: 'payment_status' },
  { label: 'Package / Services',              sortKey: 'advertised_package' },
  { label: 'Timezone',                        sortKey: 'timezone' },
  { label: 'Assigned VA',                     sortKey: 'assigned_va' },
  { label: 'Next Follow-Up',                  sortKey: 'next_followup_date' },
  { label: 'Last Contact',                    sortKey: 'last_contact_date' },
  { label: 'Mood',                            sortKey: 'last_client_sentiment' },
  { label: 'Trial Start',                     sortKey: 'trial_start' },
  { label: 'Trial End',                       sortKey: 'trial_end' },
  { label: 'Signed / Live',                   sortKey: 'signed_at' },
  { label: 'Ad Status',                       sortKey: 'ad_status' },
  { label: 'Budget',                          sortKey: 'budget' },
  { label: 'Spend',                           sortKey: 'spend' },
  { label: 'CPL',                             sortKey: 'cpl' },
  { label: 'Links' },
  { label: 'Created',                         sortKey: 'created_at' },
]

function sortSpreadsheet(list: Client[], field: TableSortField, dir: 'asc' | 'desc'): Client[] {
  return [...list].sort((a, b) => {
    const av = (a as Record<string, unknown>)[field] ?? ''
    const bv = (b as Record<string, unknown>)[field] ?? ''
    let cmp: number
    if (typeof av === 'number' && typeof bv === 'number') {
      cmp = av - bv
    } else {
      cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: 'base' })
    }
    return dir === 'asc' ? cmp : -cmp
  })
}

function SpreadsheetView({
  clients,
  onClientClick,
  sortField,
  sortDir,
  onSort,
}: {
  clients: Client[]
  onClientClick: (id: string) => void
  sortField: TableSortField | null
  sortDir: 'asc' | 'desc'
  onSort: (field: TableSortField) => void
}) {
  const sorted = sortField ? sortSpreadsheet(clients, sortField, sortDir) : clients
  const thBase = 'px-3 py-2.5 text-left text-[10px] font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap border-r border-border/40 last:border-r-0'

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/20">
              {SPREADSHEET_HEADERS.map(h => (
                <th key={h.label} className={cn(thBase, h.sticky && 'sticky left-0 z-20 bg-secondary/20')}>
                  {h.sortKey ? (
                    <button
                      onClick={() => onSort(h.sortKey!)}
                      className="flex items-center gap-1 hover:text-foreground transition-colors"
                    >
                      {h.label}
                      {sortField === h.sortKey
                        ? sortDir === 'desc'
                          ? <ArrowDown className="w-3 h-3 text-primary" />
                          : <ArrowUp className="w-3 h-3 text-primary" />
                        : <ArrowUpDown className="w-3 h-3 opacity-30" />}
                    </button>
                  ) : h.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(c => (
              <SpreadsheetRow key={c.id} c={c} onClick={() => onClientClick(c.id)} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

type SortField = 'last_contact' | 'followup' | 'retainer' | 'mood'
type SortDir = 'asc' | 'desc'

const MOOD_ORDER: Record<string, number> = {
  close_ready: 0, happy: 1, neutral: 2, frustrated: 3, angry: 4, ghosting: 5,
}

function ClientsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user } = useAuth()
  const isVA = user?.userType === 'va'
  const isMobile = useIsMobile()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [formOpen, setFormOpen] = useState(false)
  const [formDefaultStage, setFormDefaultStage] = useState<ClientStage | undefined>()
  const [importOpen, setImportOpen] = useState(false)
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [tableSortField, setTableSortField] = useState<TableSortField | null>(null)
  const [tableSortDir, setTableSortDir] = useState<'asc' | 'desc'>('asc')
  const dragId = useRef<string | null>(null)

  function cycleTableSort(field: TableSortField) {
    if (tableSortField !== field) { setTableSortField(field); setTableSortDir('asc') }
    else if (tableSortDir === 'asc') setTableSortDir('desc')
    else { setTableSortField(null); setTableSortDir('asc') }
  }

  function toggleGroup(label: string) {
    setCollapsedGroups(prev => {
      const next = new Set(prev)
      next.has(label) ? next.delete(label) : next.add(label)
      return next
    })
  }

  function cycleSort(field: SortField) {
    if (sortField !== field) { setSortField(field); setSortDir('desc') }
    else if (sortDir === 'desc') setSortDir('asc')
    else { setSortField(null); setSortDir('desc') }
  }

  function sortClients(list: Client[]): Client[] {
    if (!sortField) return list
    return [...list].sort((a, b) => {
      let av: number, bv: number
      if (sortField === 'retainer') {
        av = a.monthly_retainer ?? 0; bv = b.monthly_retainer ?? 0
      } else if (sortField === 'last_contact') {
        av = a.last_contact_date ? new Date(a.last_contact_date).getTime() : 0
        bv = b.last_contact_date ? new Date(b.last_contact_date).getTime() : 0
      } else if (sortField === 'followup') {
        av = a.next_followup_date ? new Date(a.next_followup_date).getTime() : Infinity
        bv = b.next_followup_date ? new Date(b.next_followup_date).getTime() : Infinity
      } else {
        av = MOOD_ORDER[a.last_client_sentiment ?? ''] ?? 99
        bv = MOOD_ORDER[b.last_client_sentiment ?? ''] ?? 99
      }
      return sortDir === 'desc' ? bv - av : av - bv
    })
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 opacity-40" />
    return sortDir === 'desc' ? <ArrowDown className="w-3 h-3 text-primary" /> : <ArrowUp className="w-3 h-3 text-primary" />
  }

  const urlFilter = searchParams.get('filter') ?? ''
  const urlStage  = searchParams.get('stage') ?? ''
  const view = (searchParams.get('view') ?? 'list') as 'list' | 'kanban' | 'table'

  function setView(v: 'list' | 'kanban' | 'table') {
    const params = new URLSearchParams(searchParams.toString())
    params.set('view', v)
    router.replace(`/clients?${params}`)
  }

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    const res = await fetch(`/api/clients?${params}`)
    const data = await res.json()
    setClients(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [search])

  useEffect(() => { load() }, [load])

  function handleDragStart(e: React.DragEvent, id: string) {
    dragId.current = id
    e.dataTransfer.effectAllowed = 'move'
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/clients/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setClients(prev => prev.filter(c => c.id !== id))
      toast.success('Client deleted')
    } catch {
      toast.error('Failed to delete client')
    }
  }

  async function handleDrop(targetStage: ClientStage) {
    const id = dragId.current
    dragId.current = null
    if (!id) return
    const client = clients.find(c => c.id === id)
    if (!client || client.stage === targetStage) return

    // Optimistic update
    setClients(prev => prev.map(c => c.id === id ? { ...c, stage: targetStage } : c))

    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: targetStage }),
      })
      if (!res.ok) throw new Error()
    } catch {
      // Revert on failure
      setClients(prev => prev.map(c => c.id === id ? { ...c, stage: client.stage } : c))
      toast.error('Failed to update stage')
    }
  }

  function applyFilter(all: Client[]): Client[] {
    if (urlFilter && URL_FILTER_STAGES[urlFilter]) {
      let filtered = all.filter(c => URL_FILTER_STAGES[urlFilter].includes(c.stage))
      if (urlFilter === 'ending_today') {
        const todayStr = localToday()
        filtered = filtered.filter(c => c.trial_end && c.trial_end.slice(0, 10) === todayStr)
      }
      if (urlFilter === 'close_ready') {
        filtered = filtered.filter(c => (c.trial_health_score ?? 0) >= 80 || c.last_client_sentiment === 'close_ready')
      }
      return filtered
    }
    if (urlStage) return all.filter(c => c.stage === urlStage)
    return all
  }

  const visible = applyFilter(clients)

  const filterLabel =
    urlFilter === 'free_trials'    ? 'Free Trials' :
    urlFilter === 'ending_today'   ? 'Ending Today' :
    urlFilter === 'payment_issues' ? 'Overdue / Payment Issues' :
    urlFilter === 'close_ready'    ? 'Close-Ready' :
    urlStage                       ? urlStage.replace(/_/g, ' ') :
    null

  const visibleGroups = LIST_GROUPS.map(g => ({
    ...g,
    clients: visible.filter(c => g.stages.includes(c.stage ?? '')),
  })).filter(g => g.clients.length > 0)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className={cn('flex gap-3', isMobile ? 'flex-col px-1' : 'items-center justify-between')}>
        <div>
          <h1 className={cn('font-bold tracking-tight', isMobile ? 'text-xl' : 'text-2xl')}>
            {filterLabel ?? 'All Clients'}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {visible.length} clients
            {filterLabel && (
              <button className="ml-2 underline hover:text-foreground transition-colors" onClick={() => router.push('/clients')}>
                Clear filter
              </button>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center bg-secondary/50 rounded-lg border border-border p-0.5">
            <button onClick={() => setView('list')} className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all', view === 'list' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <List className="w-3.5 h-3.5" /> List
            </button>
            <button onClick={() => setView('kanban')} className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all', view === 'kanban' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <LayoutGrid className="w-3.5 h-3.5" /> Board
            </button>
            <button onClick={() => setView('table')} className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition-all', view === 'table' ? 'bg-card shadow text-foreground' : 'text-muted-foreground hover:text-foreground')}>
              <Table2 className="w-3.5 h-3.5" /> Table
            </button>
          </div>
          {!isVA && (
            <>
              {!isMobile && (
                <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setImportOpen(true)}>
                  <Upload className="w-3.5 h-3.5" /> Import CSV
                </Button>
              )}
              <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setFormOpen(true)}>
                <Plus className="w-3.5 h-3.5" /> Add Client
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Search */}
      <div className={cn('relative', isMobile ? 'px-1' : 'max-w-sm')}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, phone, email..." className="pl-9 h-9 bg-secondary/50" />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => <div key={i} className="bg-card border border-border rounded-xl h-24 animate-pulse" />)}
        </div>
      ) : visible.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground mb-3">No clients found.</p>
          {!isVA && <Button size="sm" onClick={() => setFormOpen(true)}>Add First Client</Button>}
        </div>
      ) : view === 'table' ? (
        <SpreadsheetView
          clients={visible}
          onClientClick={id => router.push(`/clients/${id}`)}
          sortField={tableSortField}
          sortDir={tableSortDir}
          onSort={cycleTableSort}
        />
      ) : view === 'list' ? (
        <div className="space-y-4">
          {visibleGroups.map(group => {
            const collapsed = collapsedGroups.has(group.label)
            const sorted = sortClients(group.clients)
            return (
              <div key={group.label}>
                {/* Group header — clickable to collapse */}
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={cn('flex items-center gap-2 mb-2 w-full text-left group', group.color)}
                >
                  {collapsed
                    ? <ChevronRight className="w-3.5 h-3.5 flex-shrink-0 transition-transform" />
                    : <ChevronDown className="w-3.5 h-3.5 flex-shrink-0 transition-transform" />}
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', group.dot)} />
                  <span className="text-xs font-semibold uppercase tracking-wider">{group.label}</span>
                  <span className="text-xs text-muted-foreground">({group.clients.length})</span>
                </button>

                {!collapsed && isMobile ? (
                  <div className={cn('bg-card border border-border rounded-xl overflow-hidden border-l-2 divide-y divide-border/60', group.border)}>
                    {sorted.map(c => (
                      <ClientCardMobile key={c.id} c={c} onClick={() => router.push(`/clients/${c.id}`)} onDelete={handleDelete} />
                    ))}
                  </div>
                ) : !collapsed && (
                  <div className={cn('bg-card border border-border rounded-xl overflow-hidden border-l-2', group.border)}>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm" style={{ minWidth: 560 }}>
                        <colgroup>
                          <col style={{ width: '28%' }} />
                          <col style={{ width: '18%' }} />
                          <col style={{ width: '15%' }} />
                          <col style={{ width: '15%' }} />
                          <col style={{ width: '13%' }} />
                          <col style={{ width: '7%' }} />
                          <col style={{ width: '4%' }} />
                        </colgroup>
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Client</th>
                            <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">Location</th>
                            <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">
                              <button onClick={() => cycleSort('last_contact')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                                Last Contact <SortIcon field="last_contact" />
                              </button>
                            </th>
                            <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">
                              <button onClick={() => cycleSort('followup')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                                Follow-Up <SortIcon field="followup" />
                              </button>
                            </th>
                            <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">
                              <button onClick={() => cycleSort('retainer')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                                Retainer <SortIcon field="retainer" />
                              </button>
                            </th>
                            <th className="text-left px-3 py-2 text-xs text-muted-foreground font-medium">
                              <button onClick={() => cycleSort('mood')} className="flex items-center gap-1 hover:text-foreground transition-colors">
                                Mood <SortIcon field="mood" />
                              </button>
                            </th>
                            <th className="px-3 py-2 w-9" />
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {sorted.map(c => <ClientRow key={c.id} c={c} onClick={() => router.push(`/clients/${c.id}`)} onDelete={handleDelete} />)}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-3 min-w-max">
            {KANBAN_COLUMNS.map(col => (
              <KanbanColumn
                key={col.stage}
                col={col}
                clients={visible.filter(c => {
                  if (col.stage === 'active_client') return c.stage === 'active_client' || c.stage === 'won_back'
                  if (col.stage === 'free_trial')    return c.stage === 'free_trial' || c.stage === 'trial_ending_soon'
                  if (col.stage === 'overdue')       return c.stage === 'overdue' || c.stage === 'payment_issue' || c.stage === 'churn_risk'
                  return c.stage === col.stage
                })}
                onClientClick={id => router.push(`/clients/${id}`)}
                onDragStart={handleDragStart}
                onDrop={handleDrop}
                onAddClient={() => { setFormDefaultStage(col.stage); setFormOpen(true) }}
              />
            ))}
          </div>
        </div>
      )}

      <ClientForm open={formOpen} onClose={() => { setFormOpen(false); setFormDefaultStage(undefined) }} defaultStage={formDefaultStage} onSaved={load} />
      <ImportClientsDialog open={importOpen} onClose={() => setImportOpen(false)} onImported={load} />
    </div>
  )
}

export default function ClientsPage() {
  return (
    <Suspense>
      <ClientsContent />
    </Suspense>
  )
}
