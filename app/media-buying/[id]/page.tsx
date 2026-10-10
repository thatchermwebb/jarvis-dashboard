'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft, ExternalLink, Plus, Loader2, Clock, User } from 'lucide-react'
import { cn, formatDate, formatCurrency, daysUntil, timeAgo, localToday } from '@/lib/utils'
import { AccountLogDialog } from '@/components/media/AccountLogDialog'
import type { MediaAccount, MediaAccountLog, Client } from '@/types'

function followupChip(date?: string | null) {
  if (!date) return { label: 'No follow-up set', cls: 'bg-secondary/50 text-muted-foreground border-border/40' }
  const d = daysUntil(date)
  const t = localToday()
  const short = formatDate(date).replace(/,?\s*\d{4}$/, '')
  if (date < t) return { label: `Follow-up overdue · ${short}`, cls: 'bg-red-500/15 text-red-400 border-red-500/25' }
  if (date === t) return { label: 'Follow-up today', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' }
  if (d === 1) return { label: 'Follow-up tomorrow', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' }
  return { label: `Follow-up ${short}`, cls: 'bg-secondary/60 text-muted-foreground border-border/40' }
}

export default function MediaAccountPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [logs, setLogs] = useState<MediaAccountLog[]>([])
  const [loading, setLoading] = useState(true)
  const [logOpen, setLogOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [cRes, lRes] = await Promise.all([
        fetch(`/api/clients/${id}`),
        fetch(`/api/media/account-logs?client_id=${id}`),
      ])
      if (cRes.ok) setClient(await cRes.json())
      setLogs(lRes.ok ? await lRes.json() : [])
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  const latest = logs[0] ?? null
  const chip = followupChip(latest?.follow_up_date)
  const account: MediaAccount | null = client ? {
    id: client.id, name: client.name, business_name: client.business_name,
    market_location: client.market_location, latest,
  } : null

  return (
    <div className="max-w-3xl mx-auto">
      <Link href="/media-buying" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="w-4 h-4" /> Accounts
      </Link>

      {loading && !client ? (
        <div className="h-24 bg-card border border-border rounded-xl animate-pulse" />
      ) : !client ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center text-sm text-muted-foreground">Account not found.</div>
      ) : (
        <>
          {/* Header */}
          <div className="bg-card border border-border rounded-2xl p-5 mb-4">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <h1 className="text-xl font-bold text-foreground">{client.name}</h1>
                <div className="text-sm text-muted-foreground">
                  {[client.business_name, client.market_location].filter(Boolean).join(' · ') || '—'}
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs">
                  <Link href={`/clients/${client.id}`} className="inline-flex items-center gap-1 text-muted-foreground hover:text-foreground">
                    <User className="w-3 h-3" /> Client profile
                  </Link>
                  {client.ad_account_link && (
                    <a href={client.ad_account_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                      <ExternalLink className="w-3 h-3" /> Ad account
                    </a>
                  )}
                  <span className="inline-flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {latest ? `Last reviewed ${timeAgo(latest.created_at)}` : 'Never reviewed'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={cn('text-[11px] font-medium px-2.5 py-1 rounded-full border whitespace-nowrap', chip.cls)}>{chip.label}</span>
                <button onClick={() => setLogOpen(true)} className="inline-flex items-center gap-1.5 text-sm font-medium px-3.5 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors">
                  <Plus className="w-4 h-4" /> Log Review
                </button>
              </div>
            </div>
          </div>

          {/* History */}
          <div className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mb-2 px-1">
            Review history {logs.length > 0 && `(${logs.length})`}
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
          ) : logs.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center">
              <div className="text-sm font-medium text-foreground">No reviews yet</div>
              <div className="text-xs text-muted-foreground mt-1">Click “Log Review” to record the first one.</div>
            </div>
          ) : (
            <div className="space-y-3">
              {logs.map(l => <LogCard key={l.id} log={l} />)}
            </div>
          )}
        </>
      )}

      {logOpen && account && <AccountLogDialog account={account} onClose={() => setLogOpen(false)} onSaved={load} />}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  )
}

function LogCard({ log: l }: { log: MediaAccountLog }) {
  const short = (d?: string | null) => (d ? formatDate(d).replace(/,?\s*\d{4}$/, '') : '')
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="text-sm font-semibold text-foreground">
          {l.period_start && l.period_end ? `${short(l.period_start)} – ${short(l.period_end)}` : 'Review'}
        </div>
        <div className="text-[11px] text-muted-foreground">
          {timeAgo(l.created_at)}{l.created_by ? ` · ${l.created_by}` : ''}
        </div>
      </div>
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-3">
        <Stat label="Creatives" value={l.creatives} />
        <Stat label="Leads" value={l.leads} />
        <Stat label="CPL" value={l.cpl != null ? formatCurrency(l.cpl) : null} />
        <Stat label="Numbers" value={l.numbers_submitted} />
        <Stat label="Booked" value={l.booked} />
        <Stat label="Spend" value={l.spend != null ? formatCurrency(l.spend) : null} />
        <Stat label="Revenue" value={l.revenue != null ? formatCurrency(l.revenue) : null} />
      </div>
      {l.situation && <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-1.5"><span className="text-muted-foreground text-xs uppercase tracking-wider mr-1">Situation</span>{l.situation}</p>}
      {l.verdict && <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-1.5"><span className="text-muted-foreground text-xs uppercase tracking-wider mr-1">Verdict</span>{l.verdict}</p>}
      {l.changes && <p className="text-sm text-foreground/80 whitespace-pre-wrap mb-1.5"><span className="text-muted-foreground text-xs uppercase tracking-wider mr-1">Changes</span>{l.changes}</p>}
      {l.follow_up_date && <div className="text-[11px] text-muted-foreground mt-2 pt-2 border-t border-border/40">Next look: {formatDate(l.follow_up_date)}</div>}
    </div>
  )
}
