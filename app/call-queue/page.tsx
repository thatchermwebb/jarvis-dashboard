'use client'

import { useState, useEffect, useCallback } from 'react'
import { CallQueueCard } from '@/components/call-queue/CallQueueCard'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { Client, ClientStage } from '@/types'

const STAGE_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Stages' },
  { value: 'free_trial', label: 'Free Trials' },
  { value: 'trial_ending_soon', label: 'Trial Ending Soon' },
  { value: 'active_client', label: 'Active Clients' },
  { value: 'churn_risk', label: 'Churn Risk' },
  { value: 'payment_issue', label: 'Payment Issue' },
]

export default function CallQueuePage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [stage, setStage] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ prioritized: 'true' })
    if (stage !== 'all') params.set('stage', stage)
    if (search) params.set('search', search)
    const res = await fetch(`/api/clients?${params}`)
    const data = await res.json()
    setClients(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [stage, search])

  useEffect(() => { load() }, [load])

  const filtered = clients.filter(
    (c) => !['churned', 'trial_concluded', 'onboarding'].includes(c.stage)
  )

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Call Queue</h1>
          <p className="text-xs text-muted-foreground">Ranked by priority score — highest urgency first</p>
        </div>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs" onClick={load}>
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search clients..."
            className="pl-9 h-8 text-sm bg-secondary/50"
          />
        </div>
        <Select value={stage} onValueChange={(v) => v && setStage(v)}>
          <SelectTrigger className="w-44 h-8 text-xs bg-secondary/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGE_FILTERS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-36 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground">
          No clients found. Add clients to build your call queue.
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <CallQueueCard key={c.id} client={c} onUpdated={load} />
          ))}
        </div>
      )}
    </div>
  )
}
