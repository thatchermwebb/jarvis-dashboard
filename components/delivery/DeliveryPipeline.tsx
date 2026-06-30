'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
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
  const [dragOverCol, setDragOverCol] = useState<string | null>(null)
  const dragClient = useRef<{ id: string; col: 'new' | 'in_progress' | 'completed' } | null>(null)

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

      const todayStr = localToday()
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

  async function handleStart(client: ClientWithAds) {
    const name = client.business_name || client.name

    const lines = [
      `<!channel>`,
      `New Onboarding`,
      client.name,
      client.market_location || '',
    ].filter(Boolean).join('\n')

    // Create an in_progress ad production if none exists
    if (client.adProductions.length === 0) {
      await fetch('/api/ad-productions', {
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
    } else {
      // Move first ad to in_progress
      await fetch(`/api/ad-productions/${client.adProductions[0].id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'in_progress' }),
      })
    }

    await fetch('/api/slack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lines }),
    })

    toast.success('Started — Slack notified')
    load()
  }

  async function handleComplete(client: ClientWithAds) {
    const name = client.business_name || client.name

    await fetch(`/api/clients/${client.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage: 'free_trial' }),
    })

    // Mark all ads done
    await Promise.all(
      client.adProductions.map(ad =>
        fetch(`/api/ad-productions/${ad.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'done' }),
        })
      )
    )

    const slackText = [
      `✅ *Onboarding Complete — ${name}*`,
      `Completed by: ${user.name}`,
      `Client is now in Free Trial.`,
    ].join('\n')

    await fetch('/api/slack', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: slackText }),
    })

    toast.success('Onboarding marked complete')
    load()
  }

  async function handleDrop(targetCol: 'new' | 'in_progress' | 'completed') {
    setDragOverCol(null)
    const drag = dragClient.current
    if (!drag || drag.col === targetCol) return
    const client = clients.find(c => c.id === drag.id)
    if (!client) return
    if (drag.col === 'new' && targetCol === 'in_progress') await handleStart(client)
    else if (drag.col === 'in_progress' && targetCol === 'completed') await handleComplete(client)
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
      body: JSON.stringify({ text: slackText }),
    })

    toast.success('Issue flagged — Diego notified')
  }

  const columns = COLUMN_CONFIG.map(col => ({
    ...col,
    cards: clients.filter(c => getColumn(c) === col.id),
  }))

  return (
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
              onDragOver={e => { e.preventDefault(); setDragOverCol(col.id) }}
              onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOverCol(null) }}
              onDrop={() => handleDrop(col.id as 'new' | 'in_progress' | 'completed')}
            >
              {/* Column header */}
              <div className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-colors ${dragOverCol === col.id ? `${col.border} ${col.bg} ring-2 ring-inset ring-current opacity-80` : `${col.border} ${col.bg}`}`}>
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
                      onStart={handleStart}
                      onComplete={handleComplete}
                      onFlag={handleFlag}
                      onDragStart={() => { dragClient.current = { id: client.id, col: col.id } }}
                    />
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
