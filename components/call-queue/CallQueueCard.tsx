'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Phone,
  MessageSquare,
  Voicemail,
  Calendar,
  Star,
  Wrench,
  CreditCard,
  TrendingDown,
  ExternalLink,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { LogCallDialog } from '@/components/clients/LogCallDialog'
import {
  cn,
  stageLabel,
  stageColor,
  sentimentEmoji,
  sentimentColor,
  cplStatusColor,
  timeAgo,
  formatDate,
  formatCurrency,
} from '@/lib/utils'
import type { Client } from '@/types'

interface Props {
  client: Client
  onUpdated?: () => void
}

export function CallQueueCard({ client, onUpdated }: Props) {
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

  const isHighPriority = score >= 70
  const isCritical = score >= 100

  return (
    <>
      <div
        className={cn(
          'bg-card border rounded-xl p-4 transition-all',
          isCritical
            ? 'border-red-500/40 priority-critical'
            : isHighPriority
            ? 'border-violet-500/30'
            : 'border-border hover:border-border/80'
        )}
      >
        {/* Header row */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => router.push(`/clients/${client.id}`)}
                className="font-semibold text-foreground hover:text-primary transition-colors text-base"
              >
                {client.name}
              </button>
              <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', stageColor(client.stage))}>
                {stageLabel(client.stage)}
              </Badge>
              {client.payment_issue && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-red-500/20 text-red-300 border-red-500/30">
                  💳 Payment Issue
                </Badge>
              )}
              {client.thatcher_needed && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-amber-500/20 text-amber-300 border-amber-500/30">
                  ⭐ Needs Thatcher
                </Badge>
              )}
            </div>
            {client.business_name && (
              <div className="text-xs text-muted-foreground mt-0.5">{client.business_name} · {client.market_location}</div>
            )}
          </div>

          {/* Priority score */}
          <div className={cn(
            'flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-sm font-bold',
            isCritical ? 'bg-red-500/20 text-red-300' : isHighPriority ? 'bg-violet-500/20 text-violet-300' : 'bg-secondary text-muted-foreground'
          )}>
            {score}
          </div>
        </div>

        {/* Metrics row */}
        <div className="mt-3 flex items-center gap-4 text-xs flex-wrap">
          {client.last_contact_date && (
            <span className="text-muted-foreground">
              Last contact: <span className="text-foreground">{timeAgo(client.last_contact_date)}</span>
            </span>
          )}
          {client.last_client_sentiment && (
            <span className={sentimentColor(client.last_client_sentiment)}>
              {sentimentEmoji(client.last_client_sentiment)} {client.last_client_sentiment}
            </span>
          )}
          {daysLeft !== null && daysLeft !== undefined && (
            <span className={cn(
              'font-medium',
              daysLeft <= 0 ? 'text-red-400' : daysLeft <= 1 ? 'text-orange-400' : daysLeft <= 3 ? 'text-amber-400' : 'text-muted-foreground'
            )}>
              {daysLeft <= 0 ? '🔥 Trial ended' : daysLeft === 1 ? '⚡ Trial ends tomorrow' : `Trial ends in ${daysLeft}d`}
            </span>
          )}
          {client.cpl != null && (
            <span className={cplStatusColor(client.cpl)}>
              ${client.cpl} CPL
            </span>
          )}
          {client.leads != null && <span className="text-muted-foreground">{client.leads} leads</span>}
          {client.phone_numbers_collected != null && (
            <span className="text-muted-foreground">{client.phone_numbers_collected} numbers</span>
          )}
          {client.bookings != null && <span className="text-muted-foreground">{client.bookings} booked</span>}
        </div>

        {/* Last summary */}
        {client.last_call_summary && (
          <div className="mt-2 text-xs text-muted-foreground bg-secondary/30 rounded-md px-3 py-2 line-clamp-2">
            {client.last_call_summary}
          </div>
        )}

        {/* Next step */}
        {client.followup_reason && (
          <div className="mt-2 text-xs">
            <span className="text-muted-foreground">Next: </span>
            <span className="text-foreground">{client.followup_reason}</span>
          </div>
        )}

        {/* Suggested message (collapsible) */}
        {client.suggested_message && (
          <div className="mt-2">
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-violet-400 hover:text-violet-300"
            >
              {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              Suggested message
            </button>
            {expanded && (
              <div className="mt-1.5 text-xs text-slate-300 bg-violet-500/10 border border-violet-500/20 rounded-md px-3 py-2 italic">
                "{client.suggested_message}"
              </div>
            )}
          </div>
        )}

        {/* Quick action buttons */}
        <div className="mt-3 flex items-center gap-1.5 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/10"
            onClick={() => setLogOpen(true)}
          >
            <Phone className="w-3 h-3" /> Answered
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-border"
            onClick={() => setLogOpen(true)}
          >
            <Voicemail className="w-3 h-3" /> Left VM
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-border"
            onClick={() => setLogOpen(true)}
          >
            <MessageSquare className="w-3 h-3" /> Texted
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs gap-1 border-border"
            onClick={() => setLogOpen(true)}
          >
            <Calendar className="w-3 h-3" /> Booked
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn('h-7 text-xs gap-1', client.thatcher_needed ? 'border-amber-500/40 bg-amber-500/10 text-amber-300' : 'border-border')}
            onClick={() => quickAction({ thatcher_needed: !client.thatcher_needed })}
            disabled={updating}
          >
            <Star className="w-3 h-3" /> Thatcher
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn('h-7 text-xs gap-1', client.va_needed ? 'border-blue-500/40 bg-blue-500/10 text-blue-300' : 'border-border')}
            onClick={() => quickAction({ va_needed: !client.va_needed })}
            disabled={updating}
          >
            <Wrench className="w-3 h-3" /> VA Needed
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn('h-7 text-xs gap-1', client.payment_issue ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-border')}
            onClick={() => quickAction({ payment_issue: !client.payment_issue })}
            disabled={updating}
          >
            <CreditCard className="w-3 h-3" /> Payment
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={cn('h-7 text-xs gap-1', client.stage === 'churn_risk' ? 'border-red-500/40 bg-red-500/10 text-red-300' : 'border-border')}
            onClick={() => quickAction({ stage: client.stage === 'churn_risk' ? 'active_client' : 'churn_risk' })}
            disabled={updating}
          >
            <TrendingDown className="w-3 h-3" /> Churn Risk
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs gap-1 ml-auto text-muted-foreground"
            onClick={() => router.push(`/clients/${client.id}`)}
          >
            <ExternalLink className="w-3 h-3" /> Details
          </Button>
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
