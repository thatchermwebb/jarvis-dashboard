'use client'

import { useState, useEffect, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Plus, Search, AlertTriangle, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ClientForm } from '@/components/clients/ClientForm'
import { ImportClientsDialog } from '@/components/clients/ImportClientsDialog'
import { cn, sentimentEmoji, timeAgo, formatCurrency } from '@/lib/utils'
import type { Client } from '@/types'

const GROUPS: { label: string; stages: string[]; color: string; border: string; dot: string }[] = [
  {
    label: 'Active',
    stages: ['active_client', 'won_back'],
    color: 'text-emerald-400',
    border: 'border-l-emerald-500',
    dot: 'bg-emerald-500',
  },
  {
    label: 'Ready to Close',
    stages: ['trial_concluded'],
    color: 'text-yellow-400',
    border: 'border-l-yellow-500',
    dot: 'bg-yellow-500',
  },
  {
    label: 'Trial Active',
    stages: ['free_trial', 'trial_ending_soon'],
    color: 'text-purple-400',
    border: 'border-l-purple-500',
    dot: 'bg-purple-500',
  },
  {
    label: 'Onboarding',
    stages: ['onboarding'],
    color: 'text-blue-400',
    border: 'border-l-blue-500',
    dot: 'bg-blue-500',
  },
  {
    label: 'Payments',
    stages: ['payment_issue', 'paused'],
    color: 'text-orange-400',
    border: 'border-l-orange-500',
    dot: 'bg-orange-500',
  },
  {
    label: 'Churned',
    stages: ['churned', 'churn_risk'],
    color: 'text-muted-foreground',
    border: 'border-l-border',
    dot: 'bg-muted-foreground',
  },
]

function isAtRisk(c: Client): boolean {
  return !!(
    c.churn_risk_score && c.churn_risk_score >= 60 ||
    c.urgency_level === 'critical' ||
    c.urgency_level === 'high' ||
    c.payment_issue ||
    ['frustrated', 'angry', 'ghosting'].includes(c.last_client_sentiment ?? '')
  )
}

function ClientRow({ c, onClick }: { c: Client; onClick: () => void }) {
  const atRisk = isAtRisk(c)
  const overdue = c.next_followup_date && new Date(c.next_followup_date) < new Date()

  return (
    <tr
      onClick={onClick}
      className="hover:bg-secondary/30 cursor-pointer transition-colors group"
    >
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{c.name}</span>
          {atRisk && (
            <span title="AT RISK" className="relative group/tip cursor-default">
              <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-0.5 rounded bg-red-950 border border-red-800 text-red-300 text-[10px] whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity z-50">
                AT RISK
              </span>
            </span>
          )}
        </div>
        {c.business_name && (
          <div className="text-xs text-muted-foreground">{c.business_name}</div>
        )}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {c.market_location || '—'}
      </td>
      <td className="px-4 py-3 text-xs text-muted-foreground">
        {timeAgo(c.last_contact_date)}
      </td>
      <td className="px-4 py-3 text-xs">
        {c.next_followup_date ? (
          <span className={overdue ? 'text-red-400' : 'text-muted-foreground'}>
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
  )
}

function ClientsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(searchParams.get('search') ?? '')
  const [formOpen, setFormOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)

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

  const visibleGroups = GROUPS.map((g) => ({
    ...g,
    clients: clients.filter((c) => g.stages.includes(c.stage ?? '')),
  })).filter((g) => g.clients.length > 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">All Clients</h1>
          <p className="text-xs text-muted-foreground">{clients.length} total</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5 h-8 text-xs" onClick={() => setImportOpen(true)}>
            <Upload className="w-3.5 h-3.5" /> Import CSV
          </Button>
          <Button size="sm" className="gap-1.5 h-8 text-xs" onClick={() => setFormOpen(true)}>
            <Plus className="w-3.5 h-3.5" /> Add Client
          </Button>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, phone, email..."
          className="pl-9 h-9 bg-secondary/50 max-w-sm"
        />
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl h-24 animate-pulse" />
          ))}
        </div>
      ) : clients.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <p className="text-muted-foreground mb-3">No clients found.</p>
          <Button size="sm" onClick={() => setFormOpen(true)}>Add First Client</Button>
        </div>
      ) : (
        <div className="space-y-6">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <div className={cn('flex items-center gap-2 mb-2', group.color)}>
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0', group.dot)} />
                <span className="text-xs font-semibold uppercase tracking-wider">{group.label}</span>
                <span className="text-xs text-muted-foreground">({group.clients.length})</span>
              </div>
              <div className={cn('bg-card border border-border rounded-xl overflow-hidden border-l-2', group.border)}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Client</th>
                      <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Location</th>
                      <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Last Contact</th>
                      <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Follow-Up</th>
                      <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Retainer</th>
                      <th className="text-left px-4 py-2.5 text-xs text-muted-foreground font-medium">Mood</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {group.clients.map((c) => (
                      <ClientRow key={c.id} c={c} onClick={() => router.push(`/clients/${c.id}`)} />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}

      <ClientForm open={formOpen} onClose={() => setFormOpen(false)} onSaved={load} />
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
