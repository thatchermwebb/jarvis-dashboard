'use client'

import { useEffect, useState, useMemo } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid,
} from 'recharts'
import { formatCurrency } from '@/lib/utils'

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
}

interface Payment {
  id: string
  amount: number
  paid_date?: string
  status: string
}

type Range = '7d' | '30d' | '90d' | 'ytd' | 'all'

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
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function fmtWeek(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ReportsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [range, setRange] = useState<Range>('30d')
  const [loading, setLoading] = useState(true)

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

  const inRange = (dateStr: string) => {
    if (!rangeStart) return true
    return new Date(dateStr) >= rangeStart
  }

  // ── Revenue metrics ──────────────────────────────────────────────────────────

  const activeClients = useMemo(() => clients.filter(c => c.stage === 'active_client'), [clients])
  const mrr = useMemo(() => activeClients.reduce((s, c) => s + (c.monthly_retainer ?? 0), 0), [activeClients])

  // Paid payments in range
  const paidInRange = useMemo(() =>
    payments.filter(p =>
      (p.status === 'paid' || p.status === 'paid_late') &&
      p.paid_date && inRange(p.paid_date)
    ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [payments, range, rangeStart]
  )

  const totalCollected = useMemo(() => paidInRange.reduce((s, p) => s + p.amount, 0), [paidInRange])

  // ── Deal flow & churn (using updated_at + stage as proxy) ────────────────────

  const newDeals = useMemo(() =>
    clients.filter(c => c.stage === 'active_client' && inRange(c.created_at)),
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

  // ── Daily cash collected chart ────────────────────────────────────────────────

  const dailyCashData = useMemo(() => {
    const byDay: Record<string, number> = {}
    for (const p of paidInRange) {
      if (!p.paid_date) continue
      const day = p.paid_date.slice(0, 10)
      byDay[day] = (byDay[day] ?? 0) + p.amount
    }
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount, label: fmtDay(date) }))
  }, [paidInRange])

  // ── Weekly cash collected chart ───────────────────────────────────────────────

  const weeklyCashData = useMemo(() => {
    const byWeek: Record<string, number> = {}
    for (const p of paidInRange) {
      if (!p.paid_date) continue
      const d = new Date(p.paid_date)
      // Round down to Sunday of that week
      const sun = new Date(d)
      sun.setDate(d.getDate() - d.getDay())
      const key = sun.toISOString().slice(0, 10)
      byWeek[key] = (byWeek[key] ?? 0) + p.amount
    }
    return Object.entries(byWeek)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, amount]) => ({ date, amount, label: fmtWeek(date) }))
  }, [paidInRange])

  // ── New clients over time (for deal flow chart) ────────────────────────────────

  const dealFlowData = useMemo(() => {
    const byDay: Record<string, number> = {}
    for (const c of newDeals) {
      const day = c.created_at.slice(0, 10)
      byDay[day] = (byDay[day] ?? 0) + 1
    }
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count, label: fmtDay(date) }))
  }, [newDeals])

  // ── Churn over time ────────────────────────────────────────────────────────────

  const churnData = useMemo(() => {
    const byDay: Record<string, number> = {}
    for (const c of churned) {
      const day = c.updated_at.slice(0, 10)
      byDay[day] = (byDay[day] ?? 0) + 1
    }
    return Object.entries(byDay)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count, label: fmtDay(date) }))
  }, [churned])

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
        <div className="bg-card border border-blue-500/30 bg-blue-500/5 rounded-xl px-4 py-4">
          <div className="text-2xl font-bold text-blue-400">{newDeals.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Clients Signed</div>
          <div className="text-[10px] text-muted-foreground/50 mt-0.5">{RANGE_OPTIONS.find(r => r.value === range)?.label}</div>
        </div>
        <div className="bg-card border border-red-500/30 bg-red-500/5 rounded-xl px-4 py-4">
          <div className="text-2xl font-bold text-red-400">{churned.length}</div>
          <div className="text-xs text-muted-foreground mt-1">Churned / Paused</div>
          <div className="text-[10px] text-muted-foreground/50 mt-0.5">{RANGE_OPTIONS.find(r => r.value === range)?.label}</div>
        </div>
      </div>

      {/* Secondary stat row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
          <div className="text-xl font-bold">{activeClients.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Active Clients</div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
          <div className="text-xl font-bold">{trialClients.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Active Trials</div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
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
                  <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={{ r: 3, fill: '#10b981' }} activeDot={{ r: 5 }} />
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
                  <Bar dataKey="amount" fill="#10b981" radius={[4, 4, 0, 0]} />
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
                  <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
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
                  <Bar dataKey="count" fill="#ef4444" radius={[4, 4, 0, 0]} />
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
                  <tr key={stage} className="hover:bg-secondary/20">
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
                    <tr key={c.id} className="hover:bg-secondary/20">
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
  )
}
