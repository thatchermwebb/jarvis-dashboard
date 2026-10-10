'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  Megaphone, CalendarRange, ClipboardList, Search, Plus, Clock, ExternalLink,
} from 'lucide-react'
import { cn, formatDate, formatCurrency, daysUntil, timeAgo, localToday, offsetStr } from '@/lib/utils'
import { AccountLogDialog } from '@/components/media/AccountLogDialog'
import { CallQueueCard } from '@/components/call-queue/CallQueueCard'
import type { MediaAccount, MediaAccountLog, Client } from '@/types'

// An account row = a full client (so we can render the calls-list card) plus its
// latest review + follow-up/last-checked derived on the server.
type AccountRow = Client & {
  latest?: MediaAccountLog | null
  last_checked?: string | null
  next_followup?: string | null
  log_count?: number
}

type RangeTab = 'today' | 'tomorrow' | 'this_week' | 'all'

function followupChip(date?: string | null) {
  if (!date) return { label: 'No follow-up', cls: 'bg-secondary/50 text-muted-foreground border-border/40' }
  const d = daysUntil(date)
  const t = localToday()
  const short = formatDate(date).replace(/,?\s*\d{4}$/, '')
  if (date < t) return { label: `Overdue · ${short}`, cls: 'bg-red-500/15 text-red-400 border-red-500/25' }
  if (date === t) return { label: 'Due today', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/25' }
  if (d === 1) return { label: 'Due tomorrow', cls: 'bg-blue-500/15 text-blue-400 border-blue-500/25' }
  return { label: `Due ${short}`, cls: 'bg-secondary/60 text-muted-foreground border-border/40' }
}

// Which range bucket an account falls into, by its next follow-up date.
function inRange(a: AccountRow, tab: RangeTab): boolean {
  if (tab === 'all') return true
  const t = localToday()
  const fu = a.next_followup
  if (tab === 'today') return !fu || fu <= t          // due / overdue / never reviewed
  if (tab === 'tomorrow') return fu === offsetStr(1)
  if (tab === 'this_week') return !!fu && fu > t && fu <= offsetStr(7)
  return true
}

export default function MediaBuyingPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<AccountRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<RangeTab>('today')
  const [logFor, setLogFor] = useState<MediaAccount | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/media/accounts')
      const data = await res.json()
      setAccounts(Array.isArray(data) ? data : [])
    } catch { setAccounts([]) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const counts = useMemo(() => ({
    today: accounts.filter(a => inRange(a, 'today')).length,
    tomorrow: accounts.filter(a => inRange(a, 'tomorrow')).length,
    this_week: accounts.filter(a => inRange(a, 'this_week')).length,
    all: accounts.length,
  }), [accounts])

  const q = search.trim().toLowerCase()
  const visible = accounts.filter(a =>
    inRange(a, tab) &&
    (!q || `${a.name} ${a.business_name ?? ''} ${a.market_location ?? ''}`.toLowerCase().includes(q)),
  )

  const TABS: { key: RangeTab; label: string }[] = [
    { key: 'today', label: 'Today' },
    { key: 'tomorrow', label: 'Tomorrow' },
    { key: 'this_week', label: 'This Week' },
    { key: 'all', label: 'All' },
  ]

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
      <p className="text-sm text-muted-foreground mb-4">
        Account reviews — rotate through accounts, log results, and set when to look again.
      </p>

      {/* Controls: tabs + search */}
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <div className="flex bg-secondary/40 border border-border/40 rounded-lg p-0.5">
          {TABS.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                tab === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
            >
              {label}
              {counts[key] > 0 && (
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded', tab === key ? 'bg-primary/15 text-primary' : 'bg-secondary/60 text-muted-foreground')}>
                  {counts[key]}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[180px] max-w-md">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search accounts…"
            className="w-full h-9 pl-9 pr-3 rounded-lg bg-card border border-border text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/40"
          />
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(6)].map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : visible.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center text-sm text-muted-foreground">
          {tab === 'today' ? 'Nothing due right now — nice.' : 'No accounts in this range.'}
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(a => {
            const chip = followupChip(a.next_followup)
            const l = a.latest
            const openLog = () => setLogFor({ id: a.id, name: a.name, business_name: a.business_name, market_location: a.market_location, latest: l })
            // Media-review strip pinned to the top of the (reused) calls-list card.
            const strip = (
              <div className="flex items-center gap-3 px-6 py-2.5 bg-secondary/25 border-b border-border/40 flex-wrap">
                <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <Clock className="w-3.5 h-3.5" />
                  {a.last_checked ? `Reviewed ${timeAgo(a.last_checked)}` : <span className="text-amber-400/90">Never reviewed</span>}
                </span>
                {l?.cpl != null && <span className="text-[11px] text-muted-foreground">· CPL {formatCurrency(l.cpl)}</span>}
                {l?.leads != null && <span className="text-[11px] text-muted-foreground">· {l.leads} leads</span>}
                {l?.booked != null && <span className="text-[11px] text-muted-foreground">· {l.booked} booked</span>}
                {l?.verdict && <span className="text-[11px] text-foreground/60 truncate max-w-[200px]">· “{l.verdict}”</span>}
                <span className={cn('ml-auto text-[11px] font-medium px-2 py-0.5 rounded-full border whitespace-nowrap', chip.cls)}>{chip.label}</span>
                <button onClick={() => router.push(`/media-buying/${a.id}`)} className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-foreground whitespace-nowrap">
                  <ExternalLink className="w-3 h-3" /> Open
                </button>
                <button onClick={openLog} className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 whitespace-nowrap">
                  <Plus className="w-3 h-3" /> Log Review
                </button>
              </div>
            )
            return <CallQueueCard key={a.id} client={a} onUpdated={load} paymentDue={null} topSlot={strip} />
          })}
        </div>
      )}

      {logFor && <AccountLogDialog account={logFor} onClose={() => setLogFor(null)} onSaved={load} />}
    </div>
  )
}
