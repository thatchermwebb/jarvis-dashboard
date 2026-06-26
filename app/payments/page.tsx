'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Clock, CheckCircle, Plus, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatCurrency } from '@/lib/utils'
import type { Payment, Client } from '@/types'
import { AddPaymentGlobalDialog } from '@/components/payments/AddPaymentGlobalDialog'

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  overdue:   { label: 'Overdue',   color: 'text-red-400',     bg: 'border-l-red-500' },
  pending:   { label: 'Upcoming',  color: 'text-yellow-400',  bg: 'border-l-yellow-500' },
  paid:      { label: 'Paid',      color: 'text-emerald-400', bg: 'border-l-emerald-500' },
  paid_late: { label: 'Paid Late', color: 'text-blue-400',    bg: 'border-l-blue-500' },
  waived:    { label: 'Waived',    color: 'text-muted-foreground', bg: 'border-l-border' },
}

const TYPE_LABELS: Record<string, string> = {
  retainer_monthly: 'Retainer (1mo)',
  retainer_biweekly: 'Retainer (2wk)',
  retainer_weekly: 'Retainer (1wk)',
  deposit: 'Deposit',
  remaining_balance: 'Remaining Balance',
  one_time: 'One-Time',
}

export default function PaymentsPage() {
  const router = useRouter()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/payments')
    const data = await res.json()
    setPayments(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function markPaid(id: string, wasOverdue: boolean) {
    const status = wasOverdue ? 'paid_late' : 'paid'
    await fetch(`/api/payments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setPayments((prev) => prev.map((p) => p.id === id ? { ...p, status: status as any } : p))
  }

  const overdue = payments.filter((p) => p.status === 'overdue')
  const upcoming = payments.filter((p) => p.status === 'pending')
  const history = payments.filter((p) => ['paid', 'paid_late', 'waived'].includes(p.status))

  const totalOwed = [...overdue, ...upcoming].reduce((s, p) => s + p.amount, 0)
  const totalCollected = history.filter((p) => p.status !== 'waived').reduce((s, p) => s + p.amount, 0)
  const overdueTotal = overdue.reduce((s, p) => s + p.amount, 0)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Payments</h1>
          <p className="text-xs text-muted-foreground">Pay plans, invoices, and collection tracking</p>
        </div>
        <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="w-3.5 h-3.5" /> Add Payment
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
          <div className="text-xl font-bold text-red-400">{formatCurrency(overdueTotal)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Overdue ({overdue.length})</div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
          <div className="text-xl font-bold text-yellow-400">{formatCurrency(totalOwed - overdueTotal)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Upcoming ({upcoming.length})</div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
          <div className="text-xl font-bold text-emerald-400">{formatCurrency(totalCollected)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Collected</div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(4)].map((_, i) => <div key={i} className="h-14 bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
      ) : payments.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
          No payments yet. Add payments from a client's Details page or click Add Payment above.
        </div>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <Section title="Overdue" color="text-red-400" count={overdue.length}>
              {overdue.map((p) => (
                <PaymentRow key={p.id} payment={p} onMarkPaid={() => markPaid(p.id, true)} onClientClick={() => router.push(`/clients/${p.client_id}`)} />
              ))}
            </Section>
          )}
          {upcoming.length > 0 && (
            <Section title="Upcoming" color="text-yellow-400" count={upcoming.length}>
              {upcoming.map((p) => (
                <PaymentRow key={p.id} payment={p} onMarkPaid={() => markPaid(p.id, false)} onClientClick={() => router.push(`/clients/${p.client_id}`)} />
              ))}
            </Section>
          )}
          {history.length > 0 && (
            <Section title="History" color="text-muted-foreground" count={history.length}>
              {history.map((p) => (
                <PaymentRow key={p.id} payment={p} onClientClick={() => router.push(`/clients/${p.client_id}`)} />
              ))}
            </Section>
          )}
        </div>
      )}

      <AddPaymentGlobalDialog open={addOpen} onClose={() => setAddOpen(false)} onSaved={load} />
    </div>
  )
}

function Section({ title, color, count, children }: { title: string; color: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <div className={cn('text-xs font-semibold uppercase tracking-wider', color)}>
        {title} <span className="text-muted-foreground font-normal">({count})</span>
      </div>
      <div className="space-y-1.5">{children}</div>
    </div>
  )
}

function PaymentRow({ payment: p, onMarkPaid, onClientClick }: {
  payment: Payment; onMarkPaid?: () => void; onClientClick: () => void
}) {
  const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending
  const isPaid = ['paid', 'paid_late', 'waived'].includes(p.status)
  const clientName = (p.client as any)?.name ?? 'Unknown'

  return (
    <div className={cn('bg-card border border-border border-l-2 rounded-xl px-4 py-3 flex items-center gap-3', cfg.bg)}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onClientClick} className="font-medium text-foreground hover:text-primary transition-colors text-sm">
            {clientName}
          </button>
          <span className="text-xs text-muted-foreground">{TYPE_LABELS[p.payment_type] ?? p.payment_type}</span>
          <Badge variant="outline" className={cn('text-[10px]', cfg.color)}>{cfg.label}</Badge>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {formatCurrency(p.amount)} · Due {new Date(p.due_date).toLocaleDateString()}
          {p.paid_date && ` · Paid ${new Date(p.paid_date).toLocaleDateString()}`}
          {p.notes && ` · ${p.notes}`}
        </div>
      </div>
      {!isPaid && onMarkPaid && (
        <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 px-2 gap-1 flex-shrink-0" onClick={onMarkPaid}>
          <CheckCircle className="w-3 h-3" /> Paid
        </Button>
      )}
    </div>
  )
}
