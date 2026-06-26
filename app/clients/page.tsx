'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Suspense } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ClientForm } from '@/components/clients/ClientForm'
import { cn, stageLabel, stageColor, sentimentEmoji, timeAgo, formatCurrency } from '@/lib/utils'
import type { Client, ClientStage } from '@/types'

const STAGES: { value: string; label: string }[] = [
  { value: 'all', label: 'All Stages' },
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'free_trial', label: 'Free Trial' },
  { value: 'trial_ending_soon', label: 'Trial Ending Soon' },
  { value: 'trial_concluded', label: 'Trial Concluded' },
  { value: 'active_client', label: 'Active Client' },
  { value: 'payment_issue', label: 'Payment Issue' },
  { value: 'paused', label: 'Paused' },
  { value: 'churn_risk', label: 'Churn Risk' },
  { value: 'churned', label: 'Churned' },
  { value: 'won_back', label: 'Won Back' },
]

function ClientsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [stage, setStage] = useState('all')
  const [formOpen, setFormOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (stage !== 'all') params.set('stage', stage)
    if (search) params.set('search', search)
    const res = await fetch(`/api/clients?${params}`)
    const data = await res.json()
    setClients(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [stage, search])

  useEffect(() => { load() }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">All Clients</h1>
          <p className="text-xs text-muted-foreground">{clients.length} clients</p>
        </div>
        <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setFormOpen(true)}>
          <Plus className="w-3.5 h-3.5" /> Add Client
        </Button>
      </div>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, phone, email..."
            className="pl-9 h-8 text-sm bg-secondary/50"
          />
        </div>
        <Select value={stage} onValueChange={(v) => v && setStage(v)}>
          <SelectTrigger className="w-48 h-8 text-xs bg-secondary/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STAGES.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl p-4 h-16 animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground mb-3">No clients found.</p>
          <Button size="sm" onClick={() => setFormOpen(true)}>Add First Client</Button>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Client</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Stage</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Last Contact</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Follow-Up</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Retainer</th>
                <th className="text-left px-4 py-3 text-xs text-muted-foreground font-medium">Mood</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clients.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => router.push(`/clients/${c.id}`)}
                  className="hover:bg-secondary/30 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium text-foreground">{c.name}</div>
                    {c.business_name && (
                      <div className="text-xs text-muted-foreground">{c.business_name}</div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant="outline" className={cn('text-[10px]', stageColor(c.stage))}>
                      {stageLabel(c.stage)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {timeAgo(c.last_contact_date)}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {c.next_followup_date ? (
                      <span className={
                        new Date(c.next_followup_date) < new Date()
                          ? 'text-red-400'
                          : 'text-muted-foreground'
                      }>
                        {new Date(c.next_followup_date).toLocaleDateString()}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {c.monthly_retainer ? formatCurrency(c.monthly_retainer) : '—'}
                  </td>
                  <td className="px-4 py-3 text-base">
                    {sentimentEmoji(c.last_client_sentiment)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClientForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
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
