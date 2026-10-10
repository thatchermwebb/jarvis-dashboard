'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Megaphone, CalendarRange, ClipboardList, Search, ChevronDown, ExternalLink,
  Loader2, Plus, Clock,
} from 'lucide-react'
import { cn, formatDate, formatCurrency, daysUntil, timeAgo, localToday } from '@/lib/utils'
import { AccountLogDialog } from '@/components/media/AccountLogDialog'
import type { MediaAccount, MediaAccountLog } from '@/types'

function followupChip(date?: string | null) {
  if (!date) return { label: 'No follow-up', cls: 'bg-secondary/50 text-muted-foreground border-border/40' }
  const d = daysUntil(date)
  const t = localToday()
  if (date < t) return { label: `Overdue · ${formatDate(date).replace(/,?\s*\d{4}$/, '')}`, cls: 'bg-red-500/15 text-red-400 border-red-500/25' }
  if (date === t) return { label: 'Due today', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' }
  if (d === 1) return { label: 'Due tomorrow', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' }
  return { label: `Due ${formatDate(date).replace(/,?\s*\d{4}$/, '')}`, cls: 'bg-secondary/60 text-muted-foreground border-border/40' }
}

export default function MediaBuyingPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<MediaAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [logFor, setLogFor] = useState<MediaAccount | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/media/accounts')
      const data = await res.json()
      setAccounts(Array.isArray(data) ? data : [])
    } catch { setAccounts([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const q = search.trim().toLowerCase()
  const visible = q
    ? accounts.filter(a => `${a.name} ${a.business_name ?? ''} ${a.market_location ?? ''}`.toLowerCase().includes(q))
    : accounts

  const dueCount = accounts.filter(a => !a.next_followup || a.next_followup <= localToday()).length

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1 flex-wrap">
        <Megaphone className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Media Buying</h1>
        <div className="ml-auto flex items-center gap-2">
          <Link href="/media-buying/review" className="inline-flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-lg bg-secondary/60 text-foreground hover:bg-secondary border border-border/40 transition-colors">
            <ClipboardList className="w-4 h-4" /> Ad Review
          </Link>
          <Link href="/media-buying/monthly" className="inline-flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-lg bg-secondary/60 text-foreground hover:bg-secondary border border-border/40 transition-colors">
            <CalendarRange className="w-4 h-4" /> Monthly Ad Update
          </Link>
        </div>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Account reviews — rotate through accounts, log results, and set when to look again.
        <span className="text-foreground/70"> {dueCount} due now.</span>
      </p>

      {/* Search */}
      <div className="relative mb-4 max-w-md">
        <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search accounts…"
          className="w-full h-10 pl-9 pr-3 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
        />
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : visible.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-sm text-muted-foreground">
          No ad accounts to review.
        </div>
      ) : (
        <div className="space-y-2">
          {visible.map(a => {
            const chip = followupChip(a.next_followup)
            const l = a.latest
            const isExpanded = expanded === a.id
            return (
              <div key={a.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  <button onClick={() => setExpanded(isExpanded ? null : a.id)} className="flex-1 min-w-0 text-left">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-foreground truncate">{a.name}</span>
                      {a.business_name && a.business_name !== a.name && <span className="text-xs text-muted-foreground truncate">{a.business_name}</span>}
                      {a.market_location && <span className="text-[11px] text-muted-foreground/50 truncate">· {a.market_location}</span>}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground flex-wrap">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {a.last_checked ? `Checked ${timeAgo(a.last_checked)}` : <span className="text-amber-400/90">Never reviewed</span>}
                      </span>
                      {l?.cpl != null && <span>· CPL {formatCurrency(l.cpl)}</span>}
                      {l?.leads != null && <span>· {l.leads} leads</span>}
                      {l?.booked != null && <span>· {l.booked} booked</span>}
                      {l?.verdict && <span className="truncate max-w-[220px] text-foreground/60">· “{l.verdict}”</span>}
                    </div>
                  </button>
                  <span className={cn('text-[11px] font-medium px-2 py-1 rounded-full border whitespace-nowrap', chip.cls)}>{chip.label}</span>
                  <button
                    onClick={() => setLogFor(a)}
                    className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
                  >
                    <Plus className="w-3.5 h-3.5" /> Log Review
                  </button>
                  <ChevronDown className={cn('w-4 h-4 text-muted-foreground/50 transition-transform', isExpanded && 'rotate-180')} onClick={() => setExpanded(isExpanded ? null : a.id)} />
                </div>

                {isExpanded && <AccountHistory account={a} onOpenLog={() => setLogFor(a)} onOpenClient={() => router.push(`/clients/${a.id}`)} />}
              </div>
            )
          })}
        </div>
      )}

      {logFor && <AccountLogDialog account={logFor} onClose={() => setLogFor(null)} onSaved={load} />}
    </div>
  )
}

// ─── Expanded: this account's review history ─────────────────────────────────

function Stat({ label, value }: { label: string; value: React.ReactNode }) {
  if (value == null || value === '') return null
  return (
    <div>
      <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
      <div className="text-sm text-foreground">{value}</div>
    </div>
  )
}

function AccountHistory({ account, onOpenLog, onOpenClient }: { account: MediaAccount; onOpenLog: () => void; onOpenClient: () => void }) {
  const [logs, setLogs] = useState<MediaAccountLog[] | null>(null)

  useEffect(() => {
    fetch(`/api/media/account-logs?client_id=${account.id}`)
      .then(r => (r.ok ? r.json() : []))
      .then(d => setLogs(Array.isArray(d) ? d : []))
      .catch(() => setLogs([]))
  }, [account.id])

  return (
    <div className="border-t border-border/40 bg-secondary/10 px-4 py-3 space-y-3">
      <div className="flex items-center gap-3 text-xs">
        {account.ad_account_link && (
          <a href={account.ad_account_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
            <ExternalLink className="w-3 h-3" /> Ad account
          </a>
        )}
        <button onClick={onOpenClient} className="text-muted-foreground hover:text-foreground">Client profile</button>
        <button onClick={onOpenLog} className="ml-auto inline-flex items-center gap-1 text-primary hover:underline">
          <Plus className="w-3 h-3" /> New review
        </button>
      </div>

      {logs == null ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-2"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</div>
      ) : logs.length === 0 ? (
        <div className="text-xs text-muted-foreground/60 py-2">No reviews logged yet. Click “Log Review” to add the first.</div>
      ) : (
        logs.map(l => (
          <div key={l.id} className="rounded-lg border border-border/50 bg-card/60 p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-medium text-foreground">
                {l.period_start && l.period_end
                  ? `${formatDate(l.period_start).replace(/,?\s*\d{4}$/, '')} – ${formatDate(l.period_end).replace(/,?\s*\d{4}$/, '')}`
                  : 'Review'}
              </div>
              <div className="text-[10px] text-muted-foreground">
                {timeAgo(l.created_at)}{l.created_by ? ` · ${l.created_by}` : ''}
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-2">
              <Stat label="Creatives" value={l.creatives} />
              <Stat label="Leads" value={l.leads} />
              <Stat label="CPL" value={l.cpl != null ? formatCurrency(l.cpl) : null} />
              <Stat label="Numbers" value={l.numbers_submitted} />
              <Stat label="Booked" value={l.booked} />
              <Stat label="Spend" value={l.spend != null ? formatCurrency(l.spend) : null} />
              <Stat label="Revenue" value={l.revenue != null ? formatCurrency(l.revenue) : null} />
            </div>
            {l.situation && <p className="text-xs text-foreground/80 whitespace-pre-wrap mb-1"><span className="text-muted-foreground">Situation: </span>{l.situation}</p>}
            {l.verdict && <p className="text-xs text-foreground/80 whitespace-pre-wrap mb-1"><span className="text-muted-foreground">Verdict: </span>{l.verdict}</p>}
            {l.changes && <p className="text-xs text-foreground/80 whitespace-pre-wrap mb-1"><span className="text-muted-foreground">Changes: </span>{l.changes}</p>}
            {l.follow_up_date && <p className="text-[11px] text-muted-foreground mt-1">Follow-up set: {formatDate(l.follow_up_date)}</p>}
          </div>
        ))
      )}
    </div>
  )
}
