'use client'

import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  ChevronLeft, ChevronRight, ChevronDown, Calendar, List, CheckCircle, Circle,
  Trophy, TrendingUp, Users, Pencil, Check, X, Wallet, Handshake,
} from 'lucide-react'
import { cn, formatCurrency, localToday } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useIsMobile } from '@/hooks/useIsMobile'
import { toast } from 'sonner'
import type { AffiliateCommissionData, CommissionLine, CommissionStatus, Affiliate } from '@/types'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

const STATUS_META: Record<CommissionStatus, { label: string; badge: string; dot: string; calBg: string; order: number }> = {
  overdue: { label: 'Overdue', badge: 'bg-red-500/15 text-red-400 border-red-500/30',           dot: 'bg-red-400',     calBg: 'bg-red-500/10 border-red-500/25',     order: 0 },
  open:    { label: 'Open',    badge: 'bg-amber-500/15 text-amber-300 border-amber-500/30',      dot: 'bg-amber-400',   calBg: 'bg-amber-500/10 border-amber-500/25',  order: 1 },
  paid:    { label: 'Paid',    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400', calBg: 'bg-emerald-500/10 border-emerald-500/25', order: 2 },
}

function monthKey(dateStr: string) { return dateStr.slice(0, 7) }

function plusDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00'); d.setDate(d.getDate() + n)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function monthLabel(ym: string) {
  const [y, m] = ym.split('-')
  return `${MONTH_NAMES[Number(m) - 1]} ${y}`
}

// Upcoming (Open) commissions filter. Open lines are already due today-or-later.
function matchUpcoming(due: string, range: string, today: string): boolean {
  if (range === 'all') return true
  if (range === '30d') return due <= plusDays(today, 30)
  if (range === 'month') return monthKey(due) === monthKey(today)
  if (range.startsWith('m:')) return monthKey(due) === range.slice(2)
  return true
}

export default function AffiliatesPage() {
  const router = useRouter()
  const { user } = useAuth()
  const isMobile = useIsMobile()
  const isAdmin = user?.userType === 'admin'

  const [data, setData] = useState<AffiliateCommissionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string>('')
  const [view, setView] = useState<'list' | 'calendar'>('list')
  const now = new Date()
  const [month, setMonth] = useState({ year: now.getFullYear(), month: now.getMonth() })
  const [editingRate, setEditingRate] = useState(false)
  const [rateDraft, setRateDraft] = useState('')
  const [upcoming, setUpcoming] = useState<string>('month') // 'month' | '30d' | 'all' | 'm:YYYY-MM'

  const load = useCallback(async (affiliateId?: string) => {
    const qs = affiliateId ? `?affiliate_id=${affiliateId}` : ''
    const res = await fetch(`/api/affiliate-commissions${qs}`)
    if (!res.ok) { setLoading(false); return }
    const json: AffiliateCommissionData = await res.json()
    setData(json)
    if (json.affiliate) setSelectedId(json.affiliate.id)
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const lines = data?.lines ?? []
  const rate = data?.affiliate?.commission_rate ?? 0
  const thisMonth = localToday().slice(0, 7)

  // ── Aggregates ──────────────────────────────────────────────────────────────
  // Everything the affiliate sees is scoped to THIS MONTH: commission due,
  // collected, still open, and overdue — all on payments due in the current month.
  const stats = useMemo(() => {
    let collectedThisMonth = 0
    let monthTotal = 0, monthPaid = 0, monthOpen = 0, monthOverdue = 0
    for (const l of lines) {
      if (l.status === 'paid' && l.commission_paid_date && monthKey(l.commission_paid_date) === thisMonth) {
        collectedThisMonth += l.commission
      }
      if (monthKey(l.due_date) === thisMonth) {
        monthTotal += l.commission
        if (l.status === 'paid') monthPaid += l.commission
        else if (l.status === 'open') monthOpen += l.commission
        else monthOverdue += l.commission
      }
    }
    return { collectedThisMonth, monthTotal, monthPaid, monthOpen, monthOverdue }
  }, [lines, thisMonth])

  const pctCollected = stats.monthTotal > 0 ? Math.round((stats.monthPaid / stats.monthTotal) * 100) : 0

  // Distinct months that have upcoming (open) commissions, for the date filter.
  const monthOptions = useMemo(() => {
    const set = new Set(lines.filter(l => l.status === 'open').map(l => monthKey(l.due_date)))
    return [...set].sort()
  }, [lines])

  // ── Mark paid / unpaid ────────────────────────────────────────────────────────
  async function togglePaid(l: CommissionLine) {
    const nextPaid = l.status !== 'paid'
    // optimistic
    setData(prev => prev && ({
      ...prev,
      lines: prev.lines.map(x => x.payment_id === l.payment_id
        ? { ...x, status: nextPaid ? 'paid' : (x.due_date >= localToday() ? 'open' : 'overdue'), commission_paid_date: nextPaid ? localToday() : null }
        : x),
    }))
    const res = await fetch('/api/affiliate-commissions', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: l.payment_id, paid: nextPaid }),
    })
    if (!res.ok) { toast.error('Could not update commission'); load(selectedId); return }
    if (nextPaid) toast.success(`Commission paid — ${formatCurrency(l.commission)} 🎉`)
  }

  async function saveRate() {
    const v = Number(rateDraft)
    if (!Number.isFinite(v) || v < 0 || v > 100) { toast.error('Rate must be 0–100'); return }
    setEditingRate(false)
    const res = await fetch('/api/affiliates', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: selectedId, commission_rate: v }),
    })
    if (!res.ok) { toast.error('Could not save rate'); return }
    toast.success('Commission rate updated')
    load(selectedId)
  }

  if (loading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading affiliate portal…</div>
  }
  if (!data?.affiliate) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold mb-2">Affiliate Portal</h1>
        <p className="text-sm text-muted-foreground">No affiliates yet. Add one on a client record to get started.</p>
      </div>
    )
  }

  const aff = data.affiliate
  const roster: Affiliate[] = data.affiliates ?? []

  return (
    <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Handshake className="w-6 h-6 text-primary" /> Affiliate Portal
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin ? 'Commissions by affiliate — track what’s paid, open, and overdue.' : 'Your commissions — watch them pile up.'}
          </p>
        </div>

        {/* Admin affiliate switcher */}
        {isAdmin && roster.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {roster.map(a => (
              <button
                key={a.id}
                onClick={() => { setSelectedId(a.id); setLoading(true); load(a.id) }}
                className={cn(
                  'flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-sm font-medium transition-all',
                  a.id === selectedId
                    ? 'bg-primary/15 border-primary/40 text-foreground'
                    : 'bg-secondary/40 border-border/50 text-muted-foreground hover:text-foreground hover:border-border',
                )}
              >
                <span className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0',
                  a.id === selectedId ? 'bg-primary/30 text-primary' : 'bg-secondary text-muted-foreground',
                )}>{a.initials}</span>
                {a.name}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5 items-start">
        {/* ── Main column ─────────────────────────────────────────────────────── */}
        <div className="space-y-5 min-w-0">
          {/* Summary tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Tile label="Total MRR" value={formatCurrency(data.mrr)} icon={<TrendingUp className="w-4 h-4" />} />
            <Tile label="Commission (mo)" value={formatCurrency(stats.monthTotal)} icon={<Wallet className="w-4 h-4" />} hint="Commission due this month" />
            <Tile label="Clients" value={String(data.client_count)} icon={<Users className="w-4 h-4" />} />
            <div className="bg-card border border-border rounded-xl p-3.5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-muted-foreground">
                <span className="text-[10px] uppercase tracking-widest">Commission</span>
                {isAdmin && !editingRate && (
                  <button onClick={() => { setEditingRate(true); setRateDraft(String(rate)) }} className="text-muted-foreground/50 hover:text-foreground transition-colors">
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </div>
              {editingRate ? (
                <div className="flex items-center gap-1 mt-1">
                  <input
                    autoFocus type="number" value={rateDraft}
                    onChange={e => setRateDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') saveRate(); if (e.key === 'Escape') setEditingRate(false) }}
                    className="w-14 bg-secondary/60 border border-border rounded px-1.5 py-0.5 text-lg font-bold tabular-nums"
                  />
                  <span className="text-lg font-bold">%</span>
                  <button onClick={saveRate} className="ml-auto text-emerald-400 hover:text-emerald-300"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingRate(false)} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="text-2xl font-bold tabular-nums">{rate}<span className="text-base text-muted-foreground">%</span></div>
              )}
            </div>
          </div>

          {/* View toggle */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-muted-foreground">
              {lines.length} commission{lines.length === 1 ? '' : 's'}
            </div>
            <div className="flex items-center gap-1 bg-secondary/40 border border-border/50 rounded-lg p-0.5">
              <button onClick={() => setView('list')} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors', view === 'list' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                <List className="w-4 h-4" /> List
              </button>
              <button onClick={() => setView('calendar')} className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors', view === 'calendar' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                <Calendar className="w-4 h-4" /> Calendar
              </button>
            </div>
          </div>

          {view === 'list'
            ? <CommissionList lines={lines} onToggle={togglePaid} onClient={id => router.push(`/clients/${id}`)}
                upcoming={upcoming} onUpcomingChange={setUpcoming} monthOptions={monthOptions} today={localToday()} />
            : <CommissionCalendar lines={lines} month={month} onMonthChange={setMonth} onToggle={togglePaid} isMobile={isMobile} />}
        </div>

        {/* ── Gamified sidebar ────────────────────────────────────────────────── */}
        <aside className="space-y-4 lg:sticky lg:top-4">
          {/* Hero — collected this month */}
          <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-500/20 via-emerald-500/5 to-transparent p-5">
            <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full bg-emerald-400/10 blur-2xl" />
            <div className="relative">
              <div className="flex items-center gap-1.5 text-emerald-300/80 text-[11px] font-semibold uppercase tracking-widest mb-2">
                <Trophy className="w-3.5 h-3.5" /> Collected this month
              </div>
              <div className="text-4xl font-black tabular-nums text-emerald-300">
                {formatCurrency(stats.collectedThisMonth)}
              </div>
              <div className="text-xs text-muted-foreground mt-1">{MONTH_NAMES[now.getMonth()]} payouts banked</div>
            </div>
          </div>

          {/* Due this month + progress */}
          <div className="rounded-2xl border border-border bg-card p-5">
            <div className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground mb-1">Due this month</div>
            <div className="text-3xl font-bold tabular-nums">{formatCurrency(stats.monthTotal)}</div>
            <div className="text-xs text-muted-foreground mb-3">{MONTH_NAMES[now.getMonth()]} commissions — collected + still open</div>

            {/* Progress bar */}
            <div className="h-2.5 rounded-full bg-secondary/60 overflow-hidden">
              <div className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-300 transition-all duration-700" style={{ width: `${pctCollected}%` }} />
            </div>
            <div className="flex justify-between text-[11px] text-muted-foreground mt-1.5">
              <span>{pctCollected}% collected</span>
              <span className="tabular-nums">{formatCurrency(stats.monthPaid)} / {formatCurrency(stats.monthTotal)}</span>
            </div>
          </div>

          {/* Breakdown — this month */}
          <div className="rounded-2xl border border-border bg-card p-5 space-y-3">
            <BreakdownRow color="bg-emerald-400" label="Paid out" value={formatCurrency(stats.monthPaid)} />
            <BreakdownRow color="bg-amber-400" label="Open" value={formatCurrency(stats.monthOpen)} />
            <BreakdownRow color="bg-red-400" label="Overdue" value={formatCurrency(stats.monthOverdue)} />
          </div>
        </aside>
      </div>
    </div>
  )
}

// ── Small pieces ────────────────────────────────────────────────────────────────

function Tile({ label, value, icon, hint }: { label: string; value: string; icon: React.ReactNode; hint?: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-3.5">
      <div className="flex items-center justify-between text-muted-foreground mb-1">
        <span className="text-[10px] uppercase tracking-widest">{label}</span>
        <span className="text-muted-foreground/50">{icon}</span>
      </div>
      <div className="text-2xl font-bold tabular-nums">{value}</div>
      {hint && <div className="text-[10px] text-muted-foreground/60 mt-0.5">{hint}</div>}
    </div>
  )
}

function BreakdownRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', color)} />
      <span className="text-sm text-muted-foreground flex-1">{label}</span>
      <span className="text-sm font-bold tabular-nums">{value}</span>
    </div>
  )
}

function CommissionList({ lines, onToggle, onClient, upcoming, onUpcomingChange, monthOptions, today }: {
  lines: CommissionLine[]
  onToggle: (l: CommissionLine) => void
  onClient: (id: string) => void
  upcoming: string
  onUpcomingChange: (v: string) => void
  monthOptions: string[]
  today: string
}) {
  const groups: { status: CommissionStatus; items: CommissionLine[] }[] = (['overdue', 'open', 'paid'] as CommissionStatus[])
    .map(status => {
      let items = lines.filter(l => l.status === status)
      if (status === 'open') items = items.filter(l => matchUpcoming(l.due_date, upcoming, today))
      return {
        status,
        items: items.sort((a, b) =>
          status === 'paid' ? b.due_date.localeCompare(a.due_date) : a.due_date.localeCompare(b.due_date)),
      }
    })
    // Always render the Open group (so its filter stays reachable even when the
    // chosen range is empty); hide other groups when empty.
    .filter(g => g.status === 'open' || g.items.length > 0)

  if (lines.length === 0) {
    return <div className="bg-card border border-border rounded-2xl p-10 text-center text-sm text-muted-foreground">No commissions yet for this affiliate.</div>
  }

  return (
    <div className="space-y-5">
      {groups.map(({ status, items }) => {
        const meta = STATUS_META[status]
        const total = items.reduce((s, l) => s + l.commission, 0)
        return (
          <div key={status}>
            <div className="flex items-center gap-2 mb-2 px-1">
              <span className={cn('w-2 h-2 rounded-full', meta.dot)} />
              <span className="text-sm font-semibold">{meta.label}</span>
              <span className="text-xs text-muted-foreground">({items.length})</span>
              {status === 'open' && <UpcomingFilter value={upcoming} onChange={onUpcomingChange} monthOptions={monthOptions} />}
              <span className="ml-auto text-sm font-bold tabular-nums text-muted-foreground">{formatCurrency(total)}</span>
            </div>
            {items.length === 0 ? (
              <div className="bg-card border border-border rounded-2xl p-6 text-center text-sm text-muted-foreground">
                No upcoming commissions in this range.
              </div>
            ) : (
            <div className="bg-card border border-border rounded-2xl divide-y divide-border/50 overflow-hidden">
              {items.map(l => (
                <div key={l.payment_id} className="flex items-center gap-3 px-4 py-3 hover:bg-secondary/20 transition-colors">
                  <button
                    onClick={() => onToggle(l)}
                    title={l.status === 'paid' ? 'Mark unpaid' : 'Mark commission paid'}
                    className={cn('flex-shrink-0 transition-colors', l.status === 'paid' ? 'text-emerald-400 hover:text-emerald-300' : 'text-muted-foreground/40 hover:text-emerald-400')}
                  >
                    {l.status === 'paid' ? <CheckCircle className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => onClient(l.client_id)} className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate block text-left">
                      {l.client_name}
                    </button>
                    <div className="text-[11px] text-muted-foreground">
                      {new Date(l.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {' · '}on {formatCurrency(l.payment_amount)}
                      {l.status === 'paid' && l.commission_paid_date && ` · paid ${new Date(l.commission_paid_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-sm font-bold tabular-nums">{formatCurrency(l.commission)}</div>
                    <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border', meta.badge)}>{meta.label}</span>
                  </div>
                </div>
              ))}
            </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function UpcomingFilter({ value, onChange, monthOptions }: {
  value: string
  onChange: (v: string) => void
  monthOptions: string[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const label = value === 'month' ? 'This month'
    : value === '30d' ? 'Next 30 days'
    : value === 'all' ? 'All upcoming'
    : value.startsWith('m:') ? monthLabel(value.slice(2))
    : 'This month'

  const presets: { v: string; label: string }[] = [
    { v: 'month', label: 'This month' },
    { v: '30d', label: 'Next 30 days' },
    { v: 'all', label: 'All upcoming' },
  ]

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1 text-[11px] font-medium text-amber-300/90 hover:text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-full px-2 py-0.5 transition-colors"
      >
        <Calendar className="w-3 h-3" /> {label}
        <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden w-44 p-1 max-h-72 overflow-y-auto">
          {presets.map(p => (
            <button
              key={p.v}
              onClick={() => { onChange(p.v); setOpen(false) }}
              className={cn('w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors', value === p.v ? 'bg-secondary/60 text-foreground' : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground')}
            >
              {p.label}
            </button>
          ))}
          {monthOptions.length > 0 && <div className="border-t border-border/60 my-1" />}
          {monthOptions.map(ym => {
            const v = `m:${ym}`
            return (
              <button
                key={ym}
                onClick={() => { onChange(v); setOpen(false) }}
                className={cn('w-full text-left px-2.5 py-1.5 rounded-lg text-sm transition-colors', value === v ? 'bg-secondary/60 text-foreground' : 'text-muted-foreground hover:bg-secondary/40 hover:text-foreground')}
              >
                {monthLabel(ym)}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function CommissionCalendar({ lines, month, onMonthChange, onToggle, isMobile }: {
  lines: CommissionLine[]
  month: { year: number; month: number }
  onMonthChange: (m: { year: number; month: number }) => void
  onToggle: (l: CommissionLine) => void
  isMobile: boolean
}) {
  const { year, month: mo } = month
  const today = localToday()
  const firstDay = new Date(year, mo, 1).getDay()
  const daysInMonth = new Date(year, mo + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const dateStr = (day: number) => `${year}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  const onDay = (day: number) => lines.filter(l => l.due_date === dateStr(day))

  const prev = () => onMonthChange(mo === 0 ? { year: year - 1, month: 11 } : { year, month: mo - 1 })
  const next = () => onMonthChange(mo === 11 ? { year: year + 1, month: 0 } : { year, month: mo + 1 })

  const Nav = (
    <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
      <button onClick={prev} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground"><ChevronLeft className="w-5 h-5" /></button>
      <div className="text-base font-semibold">{MONTH_NAMES[mo]} {year}</div>
      <button onClick={next} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground"><ChevronRight className="w-5 h-5" /></button>
    </div>
  )

  if (isMobile) {
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1).map(d => ({ d, items: onDay(d) })).filter(x => x.items.length)
    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        {Nav}
        {days.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">No commissions this month</div> : (
          <div className="divide-y divide-border/40">
            {days.map(({ d, items }) => (
              <div key={d} className="px-4 py-3">
                <div className="text-xs font-semibold text-muted-foreground mb-2">{MONTH_NAMES[mo].slice(0, 3)} {d}</div>
                <div className="space-y-1.5">
                  {items.map(l => <CalItem key={l.payment_id} l={l} onToggle={onToggle} />)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {Nav}
      <div className="grid grid-cols-7 border-b border-border bg-background/30">
        {DAY_NAMES.map(d => <div key={d} className="py-2.5 text-center text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">{d}</div>)}
      </div>
      <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(120px, auto)' }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`e${idx}`} className={cn('border-r border-b border-border/20 bg-background/10', idx % 7 === 6 && 'border-r-0')} />
          const items = onDay(day)
          const isToday = dateStr(day) === today
          return (
            <div key={day} className={cn('border-r border-b border-border/20 p-1.5 overflow-hidden', idx % 7 === 6 && 'border-r-0')}>
              <div className={cn('text-[11px] font-semibold mb-1 w-5 h-5 flex items-center justify-center rounded-full', isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}>{day}</div>
              <div className="space-y-1">
                {items.map(l => <CalItem key={l.payment_id} l={l} onToggle={onToggle} />)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function CalItem({ l, onToggle }: { l: CommissionLine; onToggle: (l: CommissionLine) => void }) {
  const meta = STATUS_META[l.status]
  return (
    <button
      onClick={() => onToggle(l)}
      title={`${l.client_name} — ${l.status === 'paid' ? 'paid' : 'mark paid'}`}
      className={cn('w-full text-left rounded-md border px-1.5 py-1 transition-all hover:brightness-125', meta.calBg)}
    >
      <div className="flex items-center gap-1">
        {l.status === 'paid' && <CheckCircle className="w-3 h-3 text-emerald-400 flex-shrink-0" />}
        <span className="text-[11px] font-bold tabular-nums">{formatCurrency(l.commission)}</span>
      </div>
      <div className="text-[10px] text-muted-foreground truncate">{l.client_name}</div>
    </button>
  )
}
