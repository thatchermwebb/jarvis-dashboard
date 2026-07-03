'use client'

import Link from 'next/link'
import { ExternalLink, Play, CheckCircle2, AlertTriangle, User, MapPin, Calendar } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { Client, AdProduction } from '@/types'
import type { AppUser } from '@/lib/auth'
import { useState } from 'react'

interface ClientWithAds extends Client {
  adProductions: AdProduction[]
}

interface Props {
  client: ClientWithAds
  column: 'new' | 'in_progress' | 'completed'
  user: AppUser
  onStart: (client: ClientWithAds) => void
  onComplete: (client: ClientWithAds) => Promise<void>
  onFlag: (client: ClientWithAds) => Promise<void>
  onDragStart: () => void
}

export function OnboardingCard({ client, column, user, onStart, onComplete, onFlag, onDragStart }: Props) {
  const [busy, setBusy] = useState<'start' | 'complete' | 'flag' | null>(null)

  async function run(action: 'complete' | 'flag') {
    setBusy(action)
    try {
      if (action === 'complete') await onComplete(client)
      else await onFlag(client)
    } finally {
      setBusy(null)
    }
  }

  const businessName = client.business_name || client.name
  const hasGHL = !!client.ghl_location_link
  const hasCampaign = !!client.campaign_link
  const hasAdAccount = !!client.ad_account_link
  const trialRange = client.trial_start && client.trial_end
    ? `${formatDate(client.trial_start)} – ${formatDate(client.trial_end)}`
    : null

  return (
    <div
      draggable={column !== 'completed'}
      onDragStart={e => {
        // Only fire if the drag originates on the card itself, not a child link/button
        if ((e.target as HTMLElement).closest('a, button')) { e.preventDefault(); return }
        onDragStart()
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={cn(
        'bg-card border border-border rounded-xl p-4 space-y-3.5 transition-all hover:border-border/80',
        column !== 'completed' && 'cursor-grab active:cursor-grabbing active:opacity-60 active:scale-[0.98]',
        column === 'completed' && 'opacity-70'
      )}
    >
      {/* Name + link */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-foreground leading-tight truncate">{businessName}</div>
          {client.business_name && client.business_name !== client.name && (
            <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
              <User className="w-3 h-3" />
              {client.name}
            </div>
          )}
        </div>
        <Link
          href={`/clients/${client.id}`}
          draggable={false}
          className="text-muted-foreground/40 hover:text-primary transition-colors flex-shrink-0 mt-0.5"
          title="View profile"
        >
          <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Details */}
      <div className="space-y-1.5 text-xs text-muted-foreground">
        {client.market_location && (
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3 h-3 flex-shrink-0" />
            {client.market_location}
          </div>
        )}
        {trialRange && (
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3 h-3 flex-shrink-0" />
            {trialRange}
          </div>
        )}
      </div>

      {/* Links */}
      {(hasGHL || hasCampaign || hasAdAccount) && (
        <div className="flex flex-wrap gap-1.5">
          {hasGHL && (
            <a
              href={client.ghl_location_link!}
              target="_blank"
              rel="noopener noreferrer"
              draggable={false}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors"
            >
              <ExternalLink className="w-2.5 h-2.5" /> GHL
            </a>
          )}
          {hasCampaign && (
            <a
              href={client.campaign_link!}
              target="_blank"
              rel="noopener noreferrer"
              draggable={false}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
            >
              <ExternalLink className="w-2.5 h-2.5" /> Campaign
            </a>
          )}
          {hasAdAccount && (
            <a
              href={client.ad_account_link!}
              target="_blank"
              rel="noopener noreferrer"
              draggable={false}
              className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
            >
              <ExternalLink className="w-2.5 h-2.5" /> Ads
            </a>
          )}
        </div>
      )}

      {/* Ads count (in_progress column) */}
      {column === 'in_progress' && client.adProductions.length > 0 && (
        <div className="text-[10px] text-amber-400/80 bg-amber-500/10 border border-amber-500/20 rounded-lg px-2.5 py-1.5">
          {client.adProductions.filter(a => a.status === 'in_progress').length} ad{client.adProductions.length !== 1 ? 's' : ''} in progress
        </div>
      )}

      {/* Completed label */}
      {column === 'completed' && (
        <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
          <CheckCircle2 className="w-3 h-3" />
          Onboarding complete — in free trial
        </div>
      )}

      {/* Action buttons */}
      {column !== 'completed' && (
        <div className="flex gap-2 pt-0.5">
          {column === 'new' && (
            <button
              onClick={() => onStart(client)}
              disabled={!!busy}
              className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              <Play className="w-3 h-3" />
              Start + Notify Slack
            </button>
          )}
          {column === 'in_progress' && (
            <>
              <button
                onClick={() => run('complete')}
                disabled={!!busy}
                className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-semibold hover:bg-emerald-500/25 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-3 h-3" />
                {busy === 'complete' ? 'Completing...' : 'Mark Complete'}
              </button>
              <button
                onClick={() => run('flag')}
                disabled={!!busy}
                className="flex items-center justify-center gap-1.5 px-3 h-8 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-xs font-semibold hover:bg-red-500/20 transition-colors disabled:opacity-50"
                title="Flag an issue"
              >
                <AlertTriangle className="w-3 h-3" />
                {busy === 'flag' ? '...' : 'Flag'}
              </button>

            </>
          )}
        </div>
      )}
    </div>
  )
}
