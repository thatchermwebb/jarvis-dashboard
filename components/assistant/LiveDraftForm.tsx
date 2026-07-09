'use client'

import { cn, formatDate, formatTime, sentimentEmoji } from '@/lib/utils'
import type { LogDraft, WizardStep } from '@/lib/voice/logCallMachine'
import type { ClientSentiment } from '@/types'

// The live draft that fills in as JARVIS walks through the call-log questions.
// The field currently being asked glows.

const FIELD_FOR_STEP: Record<string, string> = {
  client: 'client',
  log_type: 'log_type',
  outcome: 'outcome',
  summary: 'summary',
  followup: 'followup',
  sentiment: 'sentiment',
  next_step: 'next_step',
  promises: 'promises_made',
}

export function LiveDraftForm({ draft, step }: { draft: LogDraft; step: WizardStep }) {
  const activeField = FIELD_FOR_STEP[step]

  const rows: { key: string; label: string; value: string | null }[] = [
    { key: 'client', label: 'Client', value: draft.client_name },
    { key: 'log_type', label: 'Type', value: draft.log_type },
    { key: 'outcome', label: 'Outcome', value: draft.outcome?.replace(/_/g, ' ') ?? null },
    { key: 'summary', label: 'Summary', value: draft.summary },
    {
      key: 'followup', label: 'Follow-up',
      value: draft.followup_date
        ? `${formatDate(draft.followup_date)}${draft.followup_time ? ` at ${formatTime(draft.followup_time)}` : ''}`
        : null,
    },
    {
      key: 'sentiment', label: 'Sentiment',
      value: draft.sentiment ? `${sentimentEmoji(draft.sentiment as ClientSentiment)} ${draft.sentiment.replace(/_/g, ' ')}` : null,
    },
    { key: 'next_step', label: 'Next Steps', value: draft.next_step },
    { key: 'promises_made', label: 'Action Items', value: draft.promises_made },
  ]

  return (
    <div className="rounded-xl border border-primary/25 bg-primary/[0.04] overflow-hidden">
      <div className="px-3 py-2 border-b border-primary/15 flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-primary">Logging Call</span>
        {step === 'confirm' && <span className="text-[10px] text-muted-foreground animate-pulse">awaiting confirmation…</span>}
        {step === 'status_flags' && <span className="text-[10px] text-emerald-400">saved ✓</span>}
      </div>
      <div className="divide-y divide-border/30">
        {rows.map(row => {
          const isActive = row.key === activeField
          return (
            <div
              key={row.key}
              className={cn(
                'flex items-start gap-3 px-3 py-1.5 transition-colors duration-300',
                isActive && 'bg-primary/10',
              )}
            >
              <span className={cn(
                'text-[10px] uppercase tracking-wider w-20 flex-shrink-0 pt-0.5',
                isActive ? 'text-primary font-semibold' : 'text-muted-foreground/60',
              )}>
                {row.label}
              </span>
              <span className={cn(
                'text-xs flex-1 min-w-0 break-words',
                row.value ? 'text-foreground' : 'text-muted-foreground/30',
              )}>
                {row.value ?? (isActive ? <span className="animate-pulse text-primary/70">listening…</span> : '—')}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
