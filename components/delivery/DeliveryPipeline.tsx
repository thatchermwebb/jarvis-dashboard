'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { RefreshCw } from 'lucide-react'
import { OnboardingCard } from './OnboardingCard'
import type { Client, AdProduction } from '@/types'
import type { AppUser } from '@/lib/auth'
import { localToday } from '@/lib/utils'

interface ClientWithAds extends Client {
  adProductions: AdProduction[]
}

function getColumn(client: ClientWithAds): 'new' | 'in_progress' | 'completed' {
  if (client.stage === 'free_trial') return 'completed'
  const ads = client.adProductions
  if (ads.length === 0 || ads.every(a => a.status === 'not_started')) return 'new'
  return 'in_progress'
}

const COLUMN_CONFIG = [
  {
    id: 'new' as const,
    label: 'New Onboarding',
    sublabel: 'Ready to start',
    dot: 'bg-blue-400',
    headerColor: 'text-blue-400',
    border: 'border-blue-500/20',
    bg: 'bg-blue-500/5',
  },
  {
    id: 'in_progress' as const,
    label: 'In Progress',
    sublabel: 'Work underway',
    dot: 'bg-amber-400',
    headerColor: 'text-amber-400',
    border: 'border-amber-500/20',
    bg: 'bg-amber-500/5',
  },
  {
    id: 'completed' as const,
    label: 'Completed',
    sublabel: 'Onboarding done',
    dot: 'bg-emerald-400',
    headerColor: 'text-emerald-400',
    border: 'border-emerald-500/20',
    bg: 'bg-emerald-500/5',
  },
]

export function DeliveryPipeline({ user }: { user: AppUser }) {
  const [clients, setClients] = useState<ClientWithAds[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [clientsRes, adsRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/ad-productions'),
      ])
      const [allClients, allAds]: [Client[], AdProduction[]] = await Promise.all([
        clientsRes.json(),
        adsRes.json(),
      ])

      const fourteenDaysAgo = new Date()
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
      const cutoff = fourteenDaysAgo.toISOString()

      const pipeline = allClients
        .filter(c =>
          c.stage === 'onboarding' ||
          (c.stage === 'free_trial' && c.updated_at >= cutoff)
        )
        .map(c => ({
          ...c,
          adProductions: (Array.isArray(allAds) ? allAds : []).filter(a => a.client_id === c.id),
        }))
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

      setClients(pipeline)
    } catch {
      toast.error('Failed to load pipeline')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleStartCore(client: ClientWithAds, message?: string) {
    const name = client.business_name || client.name

    // Optimistic update — move card to In Progress immediately
    setClients(prev => prev.map(c => c.id !== client.id ? c : {
      ...c,
      adProductions: c.adProductions.length > 0
        ? c.adProductions.map((a, i) => i === 0 ? { ...a, status: 'in_progress' as const } : a)
        : [{ id: 'temp', client_id: c.id, status: 'in_progress' as const, ad_name: '', assigned_to: user.name, priority: 'high', created_at: new Date().toISOString(), updated_at: new Date().toISOString() } as any],
    }))

    try {
      if (client.adProductions.length === 0) {
        const res = await fetch('/api/ad-productions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            client_id: client.id,
            ad_name: `${name.replace(/\s+/g, '_')}_Onboarding`,
            status: 'in_progress',
            assigned_to: user.name,
            priority: 'high',
          }),
        })
        if (!res.ok) throw new Error('Failed to create ad production')
      } else {
        const res = await fetch(`/api/ad-productions/${client.adProductions[0].id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'in_progress' }),
        })
        if (!res.ok) throw new Error('Failed to update ad production')
      }

      if (message) {
        fetch('/api/slack', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        }).catch(() => {})
        toast.success('Started — Slack notified')
      } else {
        toast.success('Moved to In Progress')
      }
      load()
    } catch {
      toast.error('Failed to start — please try again')
      // Revert optimistic update
      load()
    }
  }

  function handleStartClick(client: ClientWithAds) {
    const name = client.business_name || client.name
    const defaultMessage = [
      `<!channel>`,
      `🚀 *New Onboarding Started — ${name}*`,
      client.market_location ? `Market: ${client.market_location}` : '',
      client.trial_start && client.trial_end
        ? `Trial: ${client.trial_start} – ${client.trial_end}`
        : '',
      `Assigned: ${user.name}`,
    ].filter(Boolean).join('\n')
    handleStartCore(client, defaultMessage)
  }

  async function handleComplete(client: ClientWithAds) {
    setClients(prev => prev.map(c => c.id !== client.id ? c : {
      ...c,
      stage: 'free_trial' as const,
    }))

    await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'free_trial' }),
    })

    await Promise.all(
      client.adProductions.map(ad =>
        fetch(`/api/ad-productions/${ad.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'done' }),
        })
      )
    )

    toast.success('Onboarding marked complete')
    load()
  }

  async function handleMoveBackToNew(client: ClientWithAds) {
    setClients(prev => prev.map(c => c.id !== client.id ? c : {
      ...c,
      adProductions: c.adProductions.map(a => ({ ...a, status: 'not_started' as const })),
    }))
    try {
      await Promise.all(
        client.adProductions.map(ad =>
          fetch(`/api/ad-productions/${ad.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'not_started' }),
          })
        )
      )
      toast.success('Moved back to New')
      load()
    } catch {
      toast.error('Failed to move — please try again')
      load()
    }
  }

  async function handleMoveBackToInProgress(client: ClientWithAds) {
    setClients(prev => prev.map(c => c.id !== client.id ? c : {
      ...c,
      stage: 'onboarding' as const,
      adProductions: c.adProductions.map((a, i) => i === 0 ? { ...a, status: 'in_progress' as const } : a),
    }))
    try {
      await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ stage: 'onboarding' }),
      })
      await Promise.all(
        client.adProductions.map(ad =>
          fetch(`/api/ad-productions/${ad.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'in_progress' }),
          })
        )
      )
      toast.success('Moved back to In Progress')
      load()
    } catch {
      toast.error('Failed to move — please try again')
      load()
    }
  }

  async function handleFlag(client: ClientWithAds) {
    const name = client.business_name || client.name
    const taskType = user.id === 'wilson' ? 'build_ads' : 'fix_crm'

    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: `Onboarding issue — ${name}`,
        task_type: taskType,
        client_id: client.id,
        assigned_to: 'Diego',
        status: 'open',
        priority: 'urgent',
        notes: `Flagged by ${user.name} during onboarding.`,
      }),
    })

    const slackText = [
      `⚠️ *Onboarding Issue — ${name}*`,
      `Flagged by: ${user.name}`,
      `An urgent task has been created for Diego to review.`,
    ].join('\n')

    await fetch('/api/slack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: slackText }),
    })

    toast.success('Issue flagged — Diego notified')
  }

  const columns = COLUMN_CONFIG.map(col => ({
    ...col,
    cards: clients.filter(c => getColumn(c) === col.id),
  }))

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Fulfillment</h1>
            <p className="text-sm text-muted-foreground mt-1">Onboarding pipeline — {user.name}</p>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground text-sm">
            Loading pipeline...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {columns.map(col => (
              <div
                key={col.id}
                className="space-y-3"
              >
                {/* Column header */}
                <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border ${col.border} ${col.bg}`}>
                  <span className={`w-2 h-2 rounded-full ${col.dot} flex-shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <div className={`text-sm font-semibold ${col.headerColor}`}>{col.label}</div>
                    <div className="text-[10px] text-muted-foreground/60">{col.sublabel}</div>
                  </div>
                  <span className="text-xs font-bold text-muted-foreground/50 tabular-nums">
                    {col.cards.length}
                  </span>
                </div>

                {/* Cards */}
                <div className="space-y-3">
                  {col.cards.length === 0 ? (
                    <div className="text-center py-8 text-xs text-muted-foreground/40">
                      Nothing here
                    </div>
                  ) : (
                    col.cards.map(client => (
                      <OnboardingCard
                        key={client.id}
                        client={client}
                        column={col.id}
                        user={user}
                        onStart={handleStartClick}
                        onComplete={handleComplete}
                        onFlag={handleFlag}
                        onMoveLeft={
                          col.id === 'in_progress' ? () => handleMoveBackToNew(client) :
                          col.id === 'completed' ? () => handleMoveBackToInProgress(client) :
                          undefined
                        }
                        onMoveRight={
                          col.id === 'new' ? () => handleStartCore(client) :
                          col.id === 'in_progress' ? () => handleComplete(client) :
                          undefined
                        }
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

    </>
  )
}
