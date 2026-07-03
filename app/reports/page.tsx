'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { X, ExternalLink } from 'lucide-react'
import { formatCurrency, parseLocalDate } from '@/lib/utils'
import Link from 'next/link'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Client {
  id: string
  name: string
  business_name?: string
  stage: string
  monthly_retainer?: number
  payment_frequency?: string
  market_location?: string
  updated_at: string
  created_at: string
  signed_at?: string
}

interface Payment {
  id: string
  client_id?: string
  amount: number
  paid_date?: string
  due_date?: string
  status: string
  payment_type?: string
}

type Range = '7d' | '30d' | '90d' | 'ytd' | 'all'

type DrillDown = {
  title: string
  subtitle: string
  type: 'payments' | 'clients' | 'churn'
  payments?: Payment[]
  clients?: Client[]
}

const RANGE_OPTIONS: { value: Range; label: string }[] = [
  { value: '7d',  label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: 'ytd', label: 'Year to Date' },
  { value: 'all', label: 'All Time' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRangeStart(range: Range): Date | null {
  const now = new Date()
  if (range === 'all') return null
  if (range === '7d') return new Date(now.getTime() - 7 * 86400000)
  if (range === '30d') return new Date(now.getTime() - 30 * 86400000)
  if (range === '90d') return new Date(now.getTime() - 90 * 86400000)
  if (range === 'ytd') return new Date(now.getFullYear(), 0, 1)
  return null
}

function fmtDay(dateStr: string) {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtWeek(dateStr: string) {
  return parseLocalDate(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label, isCurrency }: {
  active?: boolean; payload?: {value: number}[]; label?: string; isCurrency?: boolean
}) {
  if (!active || !payload?.length) return null
  const val = payload[0].value
  return (
    <div className="bg-[#111116] border border-white/10 rounded-xl px-3 py-2 text-sm shadow-xl">
      <div className="text-muted-foreground text-xs mb-0.5">{label}</div>
      <div className="font-bold text-foreground">{isCurrency ? formatCurrency(val) : val}</div>
      <div className="text-[10px] text-muted-foreground/50 mt-0.5">Click to see details</div>
    </div>
  )
}

// ─── Drill-down panel ─────────────────────────────────────────────────────────

function DrillDownPanel({
  drillDown,
  clients,
  onClose,
}: {
  drillDown: DrillDown
  clients: Client[]
  onClose: () => void
}) {
  const clientMap = useMemo(() => {
    const m: Record<string, Client> = {}
    for (const c of clients) m[c.id] = c
    return m
  }, [clients])

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-sm h-full bg-card border-l border-border shadow-2xl flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border flex-shrink-0">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">{drillDown.subtitle}</div>
            <div className="text-base font-semibold">{drillDown.title}</div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted/30 text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {drillDown.type === 'payments' && drillDown.payments && (
            drillDown.payments.length === 0
              ? <div className="text-sm text-muted-foreground text-center py-8">No payments on this day</div>
              : drillDown.payments.map(p => {
                  const c = p.client_id ? clientMap[p.client_id] : null
                  return (
                    <div key={p.id} className="flex items-center justify-between bg-background/40 border border-border/50 rounded-xl px-4 py-3">
                      <div className="min-w-0">
                        {c ? (
                          <Link href={`/clients/${c.id}`} className="text-sm font-medium hover:text-primary transition-colors flex items-center gap-1 group">
                            {c.business_name || c.name}
                            <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </Link>
                        ) : (
                          <div className="text-sm font-medium text-muted-foreground">Unknown client</div>
                        )}
                        <div className="text-xs text-muted-foreground mt-0.5 capitalize">
                          {p.payment_type?.replace(/_/g, ' ') ?? 'Payment'} · {p.status}
                        </div>
                      </div>
                      <div className="text-sm font-bold text-emerald-400 ml-3 flex-shrink-0">{formatCurrency(p.amount)}</div>
                    </div>
                  )
                })
          )}

          {(drillDown.type === 'clients' || drillDown.type === 'churn') && drillDown.clients && (
            drillDown.clients.length === 0
              ? <div className="text-sm text-muted-foreground text-center py-8">No clients on this day</div>
              : drillDown.clients.map(c => (
                  <Link
                    key={c.id}
                    href={`/clients/${c.id}`}
                    className="flex items-center justify-between bg-background/40 border border-border/50 rounded-xl px-4 py-3 hover:border-primary/30 transition-colors group"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium group-hover:text-primary transition-colors flex items-center gap-1">
                        {c.business_name || c.name}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {c.business_name && c.name !== c.business_name && (
                        <div className="text-xs text-muted-foreground">{c.name}</div>
                      )}
                      {c.market_location && (
                        <div className="text-xs text-muted-foreground mt-0.5">{c.market_location}</div>
                      )}
                    </div>
                    {c.monthly_retainer ? (
                      <div className="text-sm font-bold text-emerald-400 ml-3 flex-shrink-0">{formatCurrency(c.monthly_retainer)}/mo</div>
                    ) : null}
                  </Link>
                ))
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [range, setRange] = useState<Range>('30d')
  const [loading, setLoading] = useState(true)
  const [drillDown, setDrillDown] = useState<DrillDown | null>(null)

  useEffect(() => {
    async function load() {
      const [cRes, pRes] = await Promise.all([
        fetch('/api/clients'),
        fetch('/api/payments'),
      ])
      const cData = await cRes.json()
      const pData = await pRes.json()
      setClients(Array.isArray(cData) ? cData : (cData.clients ?? []))
      setPayments(Array.isArray(pData) ? pData : (pData.payments ?? []))
      setLoading(false)
    }
    load()
  }, [])

  const rangeStart = useMemo(() => getRangeStart(range), [range])

  function localDateStr(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
  }

  const rangeStartStr = useMemo(() => rangeStart ? localDateStr(rangeStart) : null, [rangeStart])
  const inRange = (dateStr: string) => !rangeStartStr || dateStr.slice(0, 10) >= rangeStartStr

  // ── Revenue metrics ──────────────────────────────────────────────────────────

  const activeClients = useMemo(() => clients.filter(c => c.stage === 'active_client'), [clients])
  const mrr = useMemo(() => activeClients.reduce((s, c) => s + (c.monthly_retainer ?? 0), 0), [activeClients])

  const paidInRange = useMemo(() =>
    payments.filter(p =>
      (p.status === 'paid' || p.status === 'paid_late') &&
      p.paid_date && inRange(p.paid_date)
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, range, rangeStartStr]
  )

  const totalCollected = useMemo(() => paidInRange.reduce((s, p) => s + p.amount, 0), [paidInRange])

  // ── Deal flow: use signed_at (set once on first conversion to active_client) ──

  const newDeals = useMemo(() =>
    clients.filter(c => c.stage === 'active_client' && inRange(c.signed_at ?? c.created_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, range, rangeStart]
  )

  const churned = useMemo(() =>
    clients.filter(c => (c.stage === 'churned' || c.stage === 'paused') && inRange(c.updated_at)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [clients, range, rangeStart]
  )

  const trialClients = useMemo(() =>
    clients.filter(c => c.stage === 'free_trial' || c.stage === 'free_trial_pending'),
    [clients]
  )

  // ── Day/week range helpers ────────────────────────────────────────────────────

  function getDaysInRange(start: Date, end: Date): string[] {
    const days: string[] = []
    const cur = new Date(start); cur.setHours(0,0,0,0)
    const endDay = new Date(end); endDay.setHours(0,0,0,0)
    while (cur <= endDay) {
      days.push(localDateStr(cur))
      cur.setDate(cur.getDate() + 1)
    }
    return days
  }

  function getWeeksInRange(start: Date, end: Date): string[] {
    const weeks: string[] = []
    const cur = new Date(start); cur.setHours(0,0,0,0)
    cur.setDate(cur.getDate() - cur.getDay())
    const endDay = new Date(end); endDay.setHours(0,0,0,0)
    while (cur <= endDay) {
      weeks.push(localDateStr(cur))
      cur.setDate(cur.getDate() + 7)
    }
    return weeks
  }

  // ── Chart data (each point carries its source items for drill-down) ───────────

  const dailyCashData = useMemo(() => {
    const byDay: Record<string, { amount: number; payments: Payment[] }> = {}
    for (const p of paidInRange) {
      if (!p.paid_date) continue
      const day = p.paid_date.slice(0, 10)
      if (!byDay[day]) byDay[day] = { amount: 0, payments: [] }
      byDay[day].amount += p.amount
      byDay[day].payments.push(p)
    }
    const earliestPaid = paidInRange.length > 0 ? parseLocalDate(paidInRange.map(p => p.paid_date!).sort()[0]) : null
    const start = rangeStart ?? earliestPaid
    if (!start) return []
    return getDaysInRange(start, new Date()).map(date => ({
      date, label: fmtDay(date),
      amount: byDay[date]?.amount ?? 0,
      payments: byDay[date]?.payments ?? [],
    }))
  }, [paidInRange, rangeStart])

  const weeklyCashData = useMemo(() => {
    const byWeek: Record<string, { amount: number; payments: Payment[] }> = {}
    for (const p of paidInRange) {
      if (!p.paid_date) continue
      const date = parseLocalDate(p.paid_date)
      const sun = new Date(date)
      sun.setDate(date.getDate() - date.getDay())
      const key = localDateStr(sun)
      if (!byWeek[key]) byWeek[key] = { amount: 0, payments: [] }
      byWeek[key].amount += p.amount
      byWeek[key].payments.push(p)
    }
    const earliestPaid = paidInRange.length > 0 ? parseLocalDate(paidInRange.map(p => p.paid_date!).sort()[0]) : null
    const start = rangeStart ?? earliestPaid
    if (!start) return []
    return getWeeksInRange(start, new Date()).map(date => ({
      date, label: fmtWeek(date),
      amount: byWeek[date]?.amount ?? 0,
      payments: byWeek[date]?.payments ?? [],
    }))
  }, [paidInRange, rangeStart])

  const dealFlowData = useMemo(() => {
    const byDay: Record<string, Client[]> = {}
    for (const c of newDeals) {
      const day = (c.signed_at ?? c.created_at).slice(0, 10)
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(c)
    }
    const start = rangeStart ?? (newDeals.length > 0
      ? new Date(Math.min(...newDeals.map(c => new Date(c.signed_at ?? c.created_at).getTime())))
      : null)
    if (!start) return []
    return getDaysInRange(start, new Date()).map(date => ({
      date, label: fmtDay(date),
      count: byDay[date]?.length ?? 0,
      clients: byDay[date] ?? [],
    }))
  }, [newDeals, rangeStart])

  const churnData = useMemo(() => {
    const byDay: Record<string, Client[]> = {}
    for (const c of churned) {
      const day = c.updated_at.slice(0, 10)
      if (!byDay[day]) byDay[day] = []
      byDay[day].push(c)
    }
    const start = rangeStart ?? (churned.length > 0
      ? new Date(Math.min(...churned.map(c => new Date(c.updated_at).getTime())))
      : null)
    if (!start) return []
    return getDaysInRange(start, new Date()).map(date => ({
      date, label: fmtDay(date),
      count: byDay[date]?.length ?? 0,
      clients: byDay[date] ?? [],
    }))
  }, [churned, rangeStart])

  const mrrOverTimeData = useMemo(() => {
    const now = new Date()
    const start = rangeStart ?? (clients.length > 0
      ? new Date(Math.min(...clients.filter(c => c.stage === 'active_client').map(c => new Date(c.created_at).getTime())))
      : null)
    if (!start) return []
    const weeks = getWeeksInRange(start, now)
    return weeks.map(weekStart => {
      const weekDate = new Date(weekStart + 'T00:00:00')
      const mrr = clients
        .filter(c => {
          if (!c.monthly_retainer) return false
          const created = new Date(c.created_at)
          if (created > weekDate) return false
          if (c.stage === 'churned' || c.stage === 'free_trial_lost') {
            return new Date(c.updated_at) >= weekDate
          }
          return true
        })
        .reduce((s, c) => s + (c.monthly_retainer ?? 0), 0)
      return { date: weekStart, mrr, label: fmtWeek(weekStart) }
    })
  }, [clients, rangeStart])

  // ── Click handlers ────────────────────────────────────────────────────────────

  function openPayments(point: any, chartTitle: string) {
    setDrillDown({ title: point.label, subtitle: chartTitle, type: 'payments', payments: point.payments ?? [] })
  }

  function openClients(point: any, chartTitle: string, type: 'clients' | 'churn' = 'clients') {
    setDrillDown({ title: point.label, subtitle: chartTitle, type, clients: point.clients ?? [] })
  }

  // ── Pipeline breakdown ─────────────────────────────────────────────────────────

  const STAGE_LABELS: Record<string, string> = {
    onboarding: 'Onboarding',
    free_trial_pending: 'Free Trial (Pending)',
    free_trial: 'Free Trial (Active)',
    trial_concluded: 'Free Trial (Complete)',
    active_client: 'Active Client',
    overdue: 'Overdue',
    paused: 'Paused',
    churned: 'Churned',
    free_trial_lost: 'Free Trial (Lost)',
  }

  const stageGroups = useMemo(() =>
    clients.reduce((acc, c) => {
      acc[c.stage] = (acc[c.stage] ?? 0) + 1
      return acc
    }, {} as Record<string, number>),
    [clients]
  )

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 w-48 bg-card rounded-lg" />
        <div className="grid grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => <div key={i} className="h-20 bg-card rounded-xl" />)}
        </div>
        <div className="h-64 bg-card rounded-xl" />
      </div>
    )
  }

  return (
    <>
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header + range filter */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Revenue, deal flow, and churn tracking</p>
        </div>
        <div className="flex items-center gap-1 bg-card border border-border rounded-xl p-1">
          {RANGE_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                range === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-emerald-500/30 bg-emerald-500/5 rounded-xl px-4 py-4">
          <div className="text-2xl font-bold text-emerald-400">{formatCurrency(totalCollected)}</div>
          <div className="text-xs text-muted-foreground mt-1">Cash Collected</div>
          <div className="text-[10px] text-muted-foreground/50 mt-0.5">{RANGE_OPTIONS.find(r => r.value === range)?.label}</div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-4">
          <div className="text-2xl font-bold text-primary">{formatCurrency(mrr)}</div>
          <div className="text-xs text-muted-foreground mt-1">MRR (Current)</div>
          <div className="text-[10px] text-muted-foreground/50 mt-0.5">{activeClients.length} active clients</div>
        </div>
        <div
          className="bg-card border border-blue-500/30 bg-blue-500/5 rounded-xl px-4 py-4 cursor-pointer hover:bg-blue-500/10 transition-colors"
          onClick={() => setDrillDown({ title: 'All Clients Signed', subtitle: RANGE_OPTIONS.find(r => r.value === range)?.label ?? '', type: 'clients', clients: newDeals })}
        >
          <div className="text-2xl font-bold text-blue-400">{newDeals.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Clients Signed</div>
          <div className="text-[10px] text-muted-foreground/50 mt-0.5">{RANGE_OPTIONS.find(r => r.value === range)?.label}</div>
        </div>
        <div
          className="bg-card border border-red-500/30 bg-red-500/5 rounded-xl px-4 py-4 cursor-pointer hover:bg-red-500/10 transition-colors"
          onClick={() => setDrillDown({ title: 'All Churned / Paused', subtitle: RANGE_OPTIONS.find(r => r.value === range)?.label ?? '', type: 'churn', clients: churned })}
        >
          <div className="text-2xl font-bold text-red-400">{churned.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Churned / Paused</div>
          <div className="text-[10px] text-muted-foreground/50 mt-0.5">{RANGE_OPTIONS.find(r => r.value === range)?.label}</div>
        </div>
      </div>

      {/* Secondary stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div
          className="bg-card border border-border rounded-xl px-4 py-3 text-center cursor-pointer hover:bg-secondary/30 transition-colors"
          onClick={() => setDrillDown({ title: 'Active Clients', subtitle: 'Current', type: 'clients', clients: activeClients })}
        >
          <div className="text-xl font-bold">{activeClients.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Active Clients</div>
        </div>
        <div
          className="bg-card border border-border rounded-xl px-4 py-3 text-center cursor-pointer hover:bg-secondary/30 transition-colors"
          onClick={() => setDrillDown({ title: 'Active Trials', subtitle: 'Current', type: 'clients', clients: trialClients })}
        >
          <div className="text-xl font-bold">{trialClients.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Active Trials</div>
        </div>
        <div
          className="bg-card border border-border rounded-xl px-4 py-3 text-center cursor-pointer hover:bg-secondary/30 transition-colors"
          onClick={() => setDrillDown({ title: 'Total Churned', subtitle: 'All Time', type: 'churn', clients: clients.filter(c => c.stage === 'churned') })}
        >
          <div className="text-xl font-bold">{clients.filter(c => c.stage === 'churned').length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total Churned</div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
          <div className="text-xl font-bold">{clients.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total Managed</div>
        </div>
      </div>

      {/* Charts row 1 — Cash collected */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Cash Collected (Daily)</div>
          {dailyCashData.length > 0 ? (
            <div>
              <div className="text-2xl font-bold text-emerald-400 mb-4">{formatCurrency(totalCollected)}</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={dailyCashData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
                  <Tooltip content={<ChartTooltip isCurrency />} />
                  <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981', cursor: 'pointer' }} activeDot={{ r: 6, cursor: 'pointer', onClick: (_: any, payload: any) => openPayments(payload.payload, 'Cash Collected (Daily)') }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No payments in this period</div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Cash Collected (Weekly)</div>
          {weeklyCashData.length > 0 ? (
            <div>
              <div className="text-2xl font-bold text-emerald-400 mb-4">{formatCurrency(totalCollected)}</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={weeklyCashData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} tickFormatter={v => `$${v >= 1000 ? `${(v/1000).toFixed(1)}k` : v}`} />
                  <Tooltip content={<ChartTooltip isCurrency />} />
                  <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(p: any) => openPayments(p, 'Cash Collected (Weekly)')} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No payments in this period</div>
          )}
        </div>
      </div>

      {/* Charts row 2 — Deal flow & churn */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Deal Flow — Clients Signed</div>
          {dealFlowData.length > 0 ? (
            <div>
              <div className="text-2xl font-bold text-blue-400 mb-4">{newDeals.length} signed</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dealFlowData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(p: any) => openClients(p, 'Clients Signed', 'clients')} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No new deals in this period</div>
          )}
        </div>

        <div className="bg-card border border-border rounded-2xl p-5">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Churn — Clients Lost / Paused</div>
          {churnData.length > 0 ? (
            <div>
              <div className="text-2xl font-bold text-red-400 mb-4">{churned.length} churned</div>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={churnData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(p: any) => openClients(p, 'Churned / Paused', 'churn')} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No churn in this period</div>
          )}
        </div>
      </div>

      {/* Pipeline breakdown */}
      <div>
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Pipeline Breakdown</h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">Stage</th>
                <th className="text-right px-4 py-2.5 text-xs text-muted-foreground">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {Object.entries(stageGroups)
                .sort(([, a], [, b]) => b - a)
                .map(([stage, count]) => (
                  <tr
                    key={stage}
                    className="hover:bg-secondary/20 cursor-pointer"
                    onClick={() => setDrillDown({
                      title: STAGE_LABELS[stage] ?? stage.replace(/_/g, ' '),
                      subtitle: 'Pipeline Breakdown',
                      type: stage === 'churned' || stage === 'paused' ? 'churn' : 'clients',
                      clients: clients.filter(c => c.stage === stage),
                    })}
                  >
                    <td className="px-4 py-2.5">{STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ')}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{count}</td>
                  </tr>
                ))}
              <tr className="bg-secondary/20">
                <td className="px-4 py-2.5 font-medium">Total</td>
                <td className="px-4 py-2.5 text-right font-bold">{clients.length}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* MRR Over Time */}
      <div className="bg-card border border-border rounded-2xl p-5">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">MRR Over Time</div>
          <div className="text-xs text-muted-foreground">Weekly · {RANGE_OPTIONS.find(r => r.value === range)?.label}</div>
        </div>
        <div className="text-2xl font-bold text-emerald-400 mb-4">{formatCurrency(mrr)} current</div>
        {mrrOverTimeData.length > 1 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={mrrOverTimeData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={v => `$${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10, fill: '#666' }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip isCurrency />} />
              <Line type="monotone" dataKey="mrr" stroke="#34d399" strokeWidth={2.5} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">Not enough data for this period</div>
        )}
      </div>

      {/* Active client revenue table */}
      {activeClients.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Active Client Revenue</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">Retainer</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">Frequency</th>
                  <th className="text-left px-4 py-2.5 text-xs text-muted-foreground">Market</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeClients
                  .sort((a, b) => (b.monthly_retainer ?? 0) - (a.monthly_retainer ?? 0))
                  .map(c => (
                    <tr key={c.id} className="hover:bg-secondary/20 cursor-pointer" onClick={() => setDrillDown({ title: c.business_name || c.name, subtitle: 'Active Client', type: 'clients', clients: [c] })}>
                      <td className="px-4 py-2.5 font-medium">{c.name}{c.business_name ? <span className="text-muted-foreground font-normal ml-1.5">· {c.business_name}</span> : null}</td>
                      <td className="px-4 py-2.5 text-emerald-400">{formatCurrency(c.monthly_retainer)}</td>
                      <td className="px-4 py-2.5 text-muted-foreground capitalize">{(c.payment_frequency ?? 'monthly').replace(/_/g, '-')}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{c.market_location ?? '—'}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>

    {/* Drill-down side panel */}
    {drillDown && (
      <DrillDownPanel
        drillDown={drillDown}
        clients={clients}
        onClose={() => setDrillDown(null)}
      />
    )}
    </>
  )
}
