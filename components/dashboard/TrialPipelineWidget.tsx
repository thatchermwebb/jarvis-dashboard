'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { cn, daysUntil, sentimentEmoji, sentimentColor } from '@/lib/utils'
import { getTrialHealthLabel } from '@/lib/scoring'
import type { Client } from '@/types'

interface Props {
  trials: Client[]
}

function daysChip(trialEnd?: string) {
  if (!trialEnd) return null
  const d = daysUntil(trialEnd)
  if (d <= 0) return <span className="text-[11px] font-medium bg-red-500/15 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full shrink-0">Ended</span>
  if (d === 1) return <span className="text-[11px] font-medium bg-orange-500/15 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full shrink-0">Ends tomorrow</span>
  if (d <= 2) return <span className="text-[11px] font-medium bg-orange-500/15 text-orange-400 border border-orange-500/20 px-2 py-0.5 rounded-full shrink-0">Ends in {d}d</span>
  if (d <= 5) return <span className="text-[11px] font-medium bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full shrink-0">Ends in {d}d</span>
  return <span className="text-[11px] font-medium bg-secondary/60 text-muted-foreground border border-border/40 px-2 py-0.5 rounded-full shrink-0">Ends in {d}d</span>
}

function healthColor(score?: number) {
  if (!score) return 'text-muted-foreground/40'
  if (score >= 80) return 'text-emerald-400'
  if (score >= 60) return 'text-yellow-400'
  if (score >= 40) return 'text-orange-400'
  return 'text-red-400'
}

export function TrialPipelineWidget({ trials }: Props) {
  const router = useRouter()

  const sorted = [...trials].sort((a, b) => {
    if (!a.trial_end && !b.trial_end) return 0
    if (!a.trial_end) return 1
    if (!b.trial_end) return -1
    return a.trial_end.localeCompare(b.trial_end)
  })

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Trial Pipeline</h2>
          {trials.length > 0 && (
            <span className="bg-violet-500/20 text-violet-300 text-xs font-bold px-2 py-0.5 rounded-full">
              {trials.length}
            </span>
          )}
        </div>
        <Link href="/clients?filter=free_trials" className="text-sm text-primary hover:underline">
          View all →
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden flex-1">
        {sorted.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No active trials</div>
        ) : (
          <div className="divide-y divide-border/30">
            {sorted.map(client => (
              <button
                key={client.id}
                onClick={() => router.push(`/clients/${client.id}`)}
                className="w-full text-left px-4 py-3 hover:bg-secondary/20 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{client.name}</div>
                    {client.business_name && (
                      <div className="text-[11px] text-muted-foreground truncate">{client.business_name}</div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                    {daysChip(client.trial_end)}
                  </div>
                </div>
                <div className="flex items-center gap-3 mt-1.5">
                  {client.last_client_sentiment && (
                    <span className={cn('text-[11px]', sentimentColor(client.last_client_sentiment))}>
                      {sentimentEmoji(client.last_client_sentiment)} {client.last_client_sentiment.replace('_', ' ')}
                    </span>
                  )}
                  {client.trial_health_score != null && (
                    <span className={cn('text-[11px] font-medium', healthColor(client.trial_health_score))}>
                      {getTrialHealthLabel(client.trial_health_score)} · {client.trial_health_score}
                    </span>
                  )}
                  {client.close_call_booked && (
                    <span className="text-[11px] text-violet-400">📅 Call booked</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
