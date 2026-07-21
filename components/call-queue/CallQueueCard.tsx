'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { ChevronDown, ChevronUp, Check } from 'lucide-react'
import { LogCallDialog } from '@/components/clients/LogCallDialog'
import {
  cn,
  stageLabel,
  sentimentEmoji,
  sentimentColor,
  cplStatusColor,
  timeAgo,
  formatCurrency,
  localToday,
  daysUntil,
  formatTime,
} from '@/lib/utils'
import type { Client } from '@/types'

export type PaymentDueFlag = 'overdue' | 'today' | 'tomorrow'

/** Rich payment info surfaced on the call card (amount + plan + timing). */
export interface PaymentDueInfo {
  flag: PaymentDueFlag
  amount: number
  dueDate: string
  /** Human plan label, e.g. "Retainer (Bi-weekly)" or "Deposit". */
  typeLabel: string
}

/** @deprecated use PaymentDueInfo. Kept for any external importers. */
export type PaymentDue = PaymentDueFlag

const PAYMENT_DUE_CONFIG: Record<PaymentDueFlag, { label: string; cls: string }> = {
  overdue:  { label: 'Overdue',     cls: 'bg-red-500/20 text-red-300 border-red-500/40' },
  today:    { label: 'Due Today',   cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  tomorrow: { label: 'Due Tomorrow', cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
}

/** Ready-to-close signal (mirrors the definition used across the app). */
function isCloseReady(client: Client): boolean {
  return client.last_client_sentiment === 'close_ready' || (client.trial_health_score ?? 0) >= 80
}

interface Props {
  client: Client
  onUpdated?: () => void
  /** Most-urgent unpaid payment surfaced on the card (amount + plan + timing). */
  paymentDue?: PaymentDueInfo | null
  /** Multi-select mode: show a checkbox instead of navigating on the whole card. */
  selectable?: boolean
  selected?: boolean
  onToggleSelect?: (id: string) => void
}

export function CallQueueCard({ client, onUpdated, paymentDue, selectable, selected, onToggleSelect }: Props) {
  const router = useRouter()
  const [logOpen, setLogOpen] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [updating, setUpdating] = useState(false)

  const score = client.priority_score ?? 0
  const daysLeft = client.trial_days_left

  async function quickAction(field: Partial<Client>) {
    setUpdating(true)
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(field),
      })
      if (!res.ok) throw new Error()
      toast.success('Updated')
      onUpdated?.()
    } catch {
      toast.error('Failed to update')
    } finally {
      setUpdating(false)
    }
  }

  // Stage as plain text label (e.g. "Free Trial · Active")
  function stagePlainText(stage: string) {
    const map: Record<string, string> = {
      onboarding: 'Onboarding',
      free_trial: 'Free Trial · Active',
      free_trial_pending: 'Free Trial · Pending',
      trial_concluded: 'Free Trial · Complete',
      active_client: 'Active Client',
      overdue: 'Overdue',
      paused: 'Paused',
      churn_risk: 'Churn Risk',
      churned: 'Churned',
      free_trial_lost: 'Free Trial · Lost',
    }
    return map[stage] ?? stage
  }

  return (
    <>
      <div className="bg-card rounded-2xl overflow-hidden border border-border/40">
        {/* Main row */}
        <div className="flex items-start gap-6 px-6 py-5">
          {/* Optional multi-select checkbox */}
          {selectable && (
            <button
              onClick={() => onToggleSelect?.(client.id)}
              aria-label={selected ? 'Deselect' : 'Select'}
              className={cn(
                'flex-shrink-0 mt-1 w-5 h-5 rounded-md border flex items-center justify-center transition-colors',
                selected ? 'bg-primary border-primary text-primary-foreground' : 'border-border/70 hover:border-primary/60'
              )}
            >
              {selected && <Check className="w-3.5 h-3.5" />}
            </button>
          )}
          {/* Left: name + business */}
          <div className="flex-1 min-w-0">
            <button
              onClick={() => router.push(`/clients/${client.id}`)}
              className="text-lg font-semibold text-foreground hover:text-primary transition-colors text-left"
            >
              {client.name}
            </button>
            {(client.business_name || client.market_location) && (
              <div className="text-sm text-muted-foreground mt-0.5">
                {[client.business_name, client.market_location].filter(Boolean).join(' · ')}
              </div>
            )}
            <div className="flex items-center gap-1.5 flex-wrap mt-2">
              {paymentDue && (
                <span
                  title={`${paymentDue.typeLabel} · ${formatCurrency(paymentDue.amount)} · ${PAYMENT_DUE_CONFIG[paymentDue.flag].label} (${paymentDue.dueDate})`}
                  className={cn(
                    'inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border',
                    PAYMENT_DUE_CONFIG[paymentDue.flag].cls,
                  )}
                >
                  💳 {formatCurrency(paymentDue.amount)} {PAYMENT_DUE_CONFIG[paymentDue.flag].label}
                  <span className="font-normal opacity-70">· {paymentDue.typeLabel}</span>
                </span>
              )}
              {isCloseReady(client) && !client.close_call_booked && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                  🎯 Close Ready
                </span>
              )}
              {client.close_call_booked && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border bg-teal-500/15 text-teal-300 border-teal-500/30">
                  📅 Closing Call Booked
                </span>
              )}
            </div>
          </div>

          {/* Center: stage badge */}
          <div className="flex-shrink-0 text-right hidden sm:block">
            <span className={cn(
              'inline-block text-xs font-medium px-2.5 py-1 rounded-full border',
              client.stage === 'active_client' || client.stage === 'won_back'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                : client.stage === 'free_trial' || client.stage === 'trial_ending_soon'
                ? 'bg-violet-500/10 text-violet-300 border-violet-500/20'
                : client.stage === 'free_trial_pending'
                ? 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                : client.stage === 'trial_concluded'
                ? 'bg-teal-500/10 text-teal-300 border-teal-500/20'
                : client.stage === 'overdue' || client.stage === 'payment_issue' || client.stage === 'churn_risk'
                ? 'bg-red-500/10 text-red-300 border-red-500/20'
                : client.stage === 'paused'
                ? 'bg-slate-500/10 text-slate-300 border-slate-500/20'
                : 'bg-secondary/50 text-muted-foreground border-border'
            )}>
              {stagePlainText(client.stage)}
            </span>
          </div>

          {/* Right: priority score — small, unobtrusive */}
          <div className="flex-shrink-0 text-right">
            <div className="text-[10px] text-muted-foreground/40 uppercase tracking-wider mb-0.5">Score</div>
            <div className="text-sm font-semibold text-muted-foreground/60 tabular-nums">{score}</div>
          </div>
        </div>

        {/* Metrics row */}
        <div className="px-6 pb-3 flex items-center gap-5 flex-wrap text-sm text-muted-foreground">
          {/* Follow-up due date chip */}
          {client.next_followup_date && (() => {
            const today = localToday()
            const d = client.next_followup_date!
            const diff = daysUntil(d)
            const t = (client as { next_followup_time?: string }).next_followup_time
            const timeSuffix = t ? ` · ${formatTime(t)}` : ''
            if (d < today) return <span className="text-[11px] font-medium bg-red-500/15 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">Overdue · {d}{timeSuffix}</span>
            if (d === today) return <span className="text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">Due today{timeSuffix}</span>
            if (diff === 1) return <span className="text-[11px] font-medium bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">Due tomorrow{timeSuffix}</span>
            return <span className="text-[11px] font-medium bg-secondary/60 text-muted-foreground border border-border/40 px-2 py-0.5 rounded-full">Due {d}{timeSuffix}</span>
          })()}
          {daysLeft !== null && daysLeft !== undefined && (client.stage === 'free_trial' || client.stage === 'trial_ending_soon' || client.stage === 'free_trial_pending') && (
            <span className={cn(
              'font-medium',
              daysLeft <= 0 ? 'text-red-400' : daysLeft <= 1 ? 'text-orange-400' : daysLeft <= 3 ? 'text-amber-400' : 'text-muted-foreground'
            )}>
              {daysLeft <= 0 ? '🚨 Trial ended' : daysLeft === 1 ? '⏰ Ends tomorrow' : daysLeft <= 2 ? `⏰ Ends in ${daysLeft}d` : `Trial ends in ${daysLeft}d`}
            </span>
          )}
          {client.last_contact_date && (
            <span>Last contact: <span className="text-foreground/70">{timeAgo(client.last_contact_date)}</span></span>
          )}
          {client.last_client_sentiment && (
            <span className={sentimentColor(client.last_client_sentiment)}>
              {sentimentEmoji(client.last_client_sentiment)} {client.last_client_sentiment}
            </span>
          )}
          {client.leads != null && (
            <span>{client.leads} <span className="text-muted-foreground/60 text-xs">leads</span></span>
          )}
          {client.phone_numbers_collected != null && (
            <span>{client.phone_numbers_collected} <span className="text-muted-foreground/60 text-xs">numbers</span></span>
          )}
          {client.bookings != null && (
            <span>{client.bookings} <span className="text-muted-foreground/60 text-xs">booked</span></span>
          )}
          {client.cpl != null && (
            <span className={cplStatusColor(client.cpl)}>${client.cpl} CPL</span>
          )}
        </div>

        {/* Call summary */}
        {client.last_call_summary && (
          <div className="px-6 pb-3 text-sm text-muted-foreground/80 line-clamp-1">
            {client.last_call_summary}
          </div>
        )}

        {/* Suggested message (collapsible) */}
        {client.suggested_message && (
          <div className="px-6 pb-3">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-primary/70 hover:text-primary"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Suggested message
            </button>
            {expanded && (
              <div className="mt-1.5 text-sm text-muted-foreground bg-primary/5 border border-primary/10 rounded-lg px-4 py-2.5 italic">
                "{client.suggested_message}"
              </div>
            )}
          </div>
        )}

        {/* Action buttons */}
        <div className="border-t border-border/40 px-6 py-3 flex items-center gap-2 flex-wrap bg-background/30">
          <button
            onClick={() => setLogOpen(true)}
            className="px-4 py-1.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Log Call
          </button>
          <button
            onClick={() => quickAction({ thatcher_needed: !client.thatcher_needed })}
            disabled={updating}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm transition-colors border',
              client.thatcher_needed
                ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
                : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            Thatcher
          </button>
          <button
            onClick={() => quickAction({ trepp_needed: !client.trepp_needed })}
            disabled={updating}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm transition-colors border',
              client.trepp_needed
                ? 'border-orange-500/40 bg-orange-500/10 text-orange-300'
                : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            Trepp
          </button>
          <button
            onClick={() => quickAction({ va_needed: !client.va_needed })}
            disabled={updating}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm transition-colors border',
              client.va_needed
                ? 'border-blue-500/40 bg-blue-500/10 text-blue-300'
                : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            Coaching
          </button>
          {(isCloseReady(client) || client.close_call_booked) && (
            <button
              onClick={() => quickAction({ close_call_booked: !client.close_call_booked })}
              disabled={updating}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm transition-colors border',
                client.close_call_booked
                  ? 'border-teal-500/40 bg-teal-500/10 text-teal-300'
                  : 'border-emerald-500/40 text-emerald-300/80 hover:text-emerald-300 hover:border-emerald-500/60'
              )}
            >
              {client.close_call_booked ? 'Booked ✓' : 'Book Closing'}
            </button>
          )}
          <button
            onClick={() => quickAction({ payment_issue: !client.payment_issue })}
            disabled={updating}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm transition-colors border',
              client.payment_issue
                ? 'border-red-500/40 bg-red-500/10 text-red-300'
                : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            Payment
          </button>
          <button
            onClick={() => quickAction({ stage: client.stage === 'churn_risk' ? 'active_client' : 'churn_risk' })}
            disabled={updating}
            className={cn(
              'px-3 py-1.5 rounded-lg text-sm transition-colors border',
              client.stage === 'churn_risk'
                ? 'border-red-500/40 bg-red-500/10 text-red-300'
                : 'border-primary/30 text-primary/70 hover:text-primary hover:border-primary/50'
            )}
          >
            Churn Risk
          </button>
          <button
            onClick={() => router.push(`/clients/${client.id}`)}
            className="ml-auto text-xs text-muted-foreground/60 hover:text-muted-foreground transition-colors"
          >
            Details →
          </button>
        </div>
      </div>

      <LogCallDialog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        client={client}
        onLogged={onUpdated}
      />
    </>
  )
}
