'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  Plus, ChevronLeft, ChevronRight, Calendar, List,
  Pencil, Trash2, CheckCircle, Repeat,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn, formatCurrency, localToday } from '@/lib/utils'
import type { Payment, PaymentEntryStatus, PaymentType } from '@/types'
import { PaymentDialog } from '@/components/payments/PaymentDialog'
import { useIsMobile } from '@/hooks/useIsMobile'
import { toast } from 'sonner'

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

// ─── Config ───────────────────────────────────────────────────────────────────

const TYPE_LABELS: Record<string, string> = {
  retainer_monthly:  'Retainer (1mo)',
  retainer_biweekly: 'Retainer (2 weeks)',
  retainer_weekly:   'Retainer (1 week)',
  deposit:           'Deposit',
  remaining_balance: 'Remaining Balance',
  partial_payment:   'Partial Payment',
  one_time:          'One-Time',
}

const SOURCE_LABELS: Record<string, string> = {
  stripe: 'Stripe', zelle: 'Zelle', other: 'Other',
}

const STATUS_STYLE: Record<PaymentEntryStatus, { label: string; badge: string; border: string; calBg: string; dot: string }> = {
  paid:      { label: 'Paid',        badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', border: 'border-l-emerald-500', calBg: 'bg-emerald-500/10 border-emerald-500/25',   dot: 'bg-emerald-400' },
  paid_late: { label: 'Paid (Late)', badge: 'bg-emerald-500/10 text-emerald-500/60 border-emerald-500/20', border: 'border-l-emerald-700', calBg: 'bg-emerald-500/5 border-emerald-700/30',    dot: 'bg-emerald-600' },
  pending:   { label: 'Open',        badge: 'bg-muted/60 text-muted-foreground border-border',          border: 'border-l-border',      calBg: 'bg-muted/30 border-border/40',              dot: 'bg-muted-foreground/60' },
  overdue:   { label: 'Overdue',     badge: 'bg-red-500/15 text-red-400 border-red-500/30',             border: 'border-l-red-500',     calBg: 'bg-red-500/10 border-red-500/25',           dot: 'bg-red-400' },
  voided:    { label: 'Voided',      badge: 'bg-muted/30 text-muted-foreground/40 border-border/30',    border: 'border-l-border/30',   calBg: 'bg-muted/20 border-border/20',              dot: 'bg-muted-foreground/30' },
  waived:    { label: 'Waived',      badge: 'bg-muted/30 text-muted-foreground/40 border-border/30',    border: 'border-l-border/30',   calBg: 'bg-muted/20 border-border/20',              dot: 'bg-muted-foreground/30' },
}

function addDays(dateStr: string, days: number) {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function paymentLabel(p: Payment) {
  return p.description || TYPE_LABELS[p.payment_type] || p.payment_type
}

function getNextWeekRange() {
  const today = new Date(); today.setHours(0,0,0,0)
  const dayOfWeek = today.getDay() // 0=Sun
  const nextMonday = new Date(today); nextMonday.setDate(today.getDate() + (dayOfWeek === 0 ? 1 : 8 - dayOfWeek))
  const nextSunday = new Date(nextMonday); nextSunday.setDate(nextMonday.getDate() + 6)
  return { start: nextMonday, end: nextSunday }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function PaymentsPage() {
  const router = useRouter()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'table' | 'calendar'>('table')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Payment | null>(null)
  const [prefill, setPrefill] = useState<Partial<{ client_id: string; payment_type: PaymentType; amount: number; due_date: string }> | undefined>()
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)
  const [calMonth, setCalMonth] = useState(() => {
    const n = new Date(); return { year: n.getFullYear(), month: n.getMonth() }
  })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/payments')
      const data = await res.json()
      const today = localToday()
      const normalized = (Array.isArray(data) ? data : []).map((p: Payment) =>
        p.status === 'pending' && p.due_date && p.due_date < today ? { ...p, status: 'overdue' as const } : p
      )
      setPayments(normalized)
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function openAdd(prefillDate?: string) {
    setEditing(null)
    setPrefill(prefillDate ? { due_date: prefillDate } : undefined)
    setDialogOpen(true)
  }

  function openEdit(p: Payment) { setEditing(p); setPrefill(undefined); setDialogOpen(true) }

  async function markPaid(p: Payment) {
    const today = localToday()
    const status = today <= p.due_date ? 'paid' : 'paid_late'
    await fetch(`/api/payments/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, paid_date: today, due_date: p.due_date }),
    })
    setPayments(prev => prev.map(x => x.id === p.id ? { ...x, status, paid_date: today } : x))
    toast.success(status === 'paid' ? 'Marked paid ✓' : 'Marked paid (late) ✓')
  }

  async function deletePayment(id: string) {
    await fetch(`/api/payments/${id}`, { method: 'DELETE' })
    setPayments(prev => prev.filter(x => x.id !== id))
    setDeleteConfirm(null)
    toast.success('Payment deleted')
  }

  function cloneWith(p: Payment, daysOffset: number) {
    setPrefill({ client_id: p.client_id, payment_type: p.payment_type, amount: p.amount, due_date: addDays(p.due_date, daysOffset) })
    setEditing(null)
    setDialogOpen(true)
  }

  // ── Summary calcs ──
  const today = new Date(); today.setHours(0,0,0,0)
  const overdue = payments.filter(p => p.status === 'overdue')
  const overdueAmt = overdue.reduce((s, p) => s + p.amount, 0)

  const { start: nwStart, end: nwEnd } = getNextWeekRange()
  const nextWeek = payments.filter(p => {
    if (!['pending', 'overdue'].includes(p.status)) return false
    const d = new Date(p.due_date + 'T00:00:00')
    return d >= nwStart && d <= nwEnd
  })
  const nextWeekAmt = nextWeek.reduce((s, p) => s + p.amount, 0)

  const thisMonthStart = new Date(today.getFullYear(), today.getMonth(), 1)
  const collectedThisMonth = payments.filter(p => {
    if (p.status !== 'paid' && p.status !== 'paid_late') return false
    if (!p.paid_date) return false
    return new Date(p.paid_date + 'T00:00:00') >= thisMonthStart
  })
  const collectedAmt = collectedThisMonth.reduce((s, p) => s + p.amount, 0)

  // When in calendar view, scope projected to the viewed month; in table view use all time
  const projectedMonthStart = view === 'calendar'
    ? new Date(calMonth.year, calMonth.month, 1)
    : null
  const projectedMonthEnd = view === 'calendar'
    ? new Date(calMonth.year, calMonth.month + 1, 0)
    : null
  const projected = payments.filter(p => {
    if (p.status === 'voided' || p.status === 'waived') return false
    if (projectedMonthStart && projectedMonthEnd && p.due_date) {
      const d = new Date(p.due_date + 'T00:00:00')
      return d >= projectedMonthStart && d <= projectedMonthEnd
    }
    return true
  })
  const projectedAmt = projected.reduce((s, p) => s + p.amount, 0)

  const nwLabel = `${nwStart.toLocaleDateString('en-US',{month:'short',day:'numeric'})}–${nwEnd.toLocaleDateString('en-US',{month:'short',day:'numeric'})}`

  const isMobile = useIsMobile()

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Payments</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Track retainers, deposits, and balances</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5 gap-0.5">
            <button
              onClick={() => setView('table')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all', view === 'table' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              <List className="w-3.5 h-3.5" /> Table
            </button>
            <button
              onClick={() => setView('calendar')}
              className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all', view === 'calendar' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              <Calendar className="w-3.5 h-3.5" /> Calendar
            </button>
          </div>
          {!isMobile && (
            <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => openAdd()}>
              <Plus className="w-3.5 h-3.5" /> Add Payment
            </Button>
          )}
        </div>
      </div>

      {/* Summary — 4 cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
          <div className="text-2xl font-bold text-red-400">{formatCurrency(overdueAmt)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Overdue ({overdue.length})</div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
          <div className="text-2xl font-bold text-amber-400">{formatCurrency(nextWeekAmt)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Next Week ({nwLabel})</div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
          <div className="text-2xl font-bold text-emerald-400">{formatCurrency(collectedAmt)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Collected This Month</div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
          <div className="text-2xl font-bold text-primary">{formatCurrency(projectedAmt)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {view === 'calendar' ? `${MONTH_NAMES[calMonth.month]} Projected` : 'Projected Total'}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_,i) => <div key={i} className="h-14 bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : view === 'table' ? (
        <TableView
          payments={payments}
          isMobile={isMobile}
          onAdd={openAdd}
          onEdit={openEdit}
          onMarkPaid={markPaid}
          onClone={cloneWith}
          deleteConfirm={deleteConfirm}
          onDeleteRequest={id => setDeleteConfirm(id)}
          onDeleteConfirm={deletePayment}
          onDeleteCancel={() => setDeleteConfirm(null)}
          onClientClick={id => router.push(`/clients/${id}`)}
        />
      ) : (
        <CalendarView
          payments={payments}
          month={calMonth}
          onMonthChange={setCalMonth}
          onEdit={openEdit}
          onMarkPaid={markPaid}
          onDayClick={date => openAdd(date)}
          onClientClick={id => router.push(`/clients/${id}`)}
        />
      )}

      <PaymentDialog
        open={dialogOpen}
        onClose={() => { setDialogOpen(false); setEditing(null); setPrefill(undefined) }}
        onSaved={load}
        payment={editing}
        prefill={prefill}
      />

      {/* Mobile FAB */}
      {isMobile && (
        <button
          onClick={() => openAdd()}
          className="fixed right-4 z-40 w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-xl flex items-center justify-center hover:brightness-110 active:scale-95 transition-all"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 134px)' }}
        >
          <Plus className="w-6 h-6" />
        </button>
      )}
    </div>
  )
}

// ─── Table View (card-row style) ──────────────────────────────────────────────

function TableView({
  payments, isMobile, onAdd, onEdit, onMarkPaid, onClone, deleteConfirm, onDeleteRequest, onDeleteConfirm, onDeleteCancel, onClientClick,
}: {
  payments: Payment[]
  isMobile: boolean
  onAdd: () => void
  onEdit: (p: Payment) => void
  onMarkPaid: (p: Payment) => void
  onClone: (p: Payment, days: number) => void
  deleteConfirm: string | null
  onDeleteRequest: (id: string) => void
  onDeleteConfirm: (id: string) => void
  onDeleteCancel: () => void
  onClientClick: (id: string) => void
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set(['History']))

  function toggleSection(title: string) {
    setCollapsed(prev => {
      const next = new Set(prev)
      if (next.has(title)) next.delete(title); else next.add(title)
      return next
    })
  }

  const sorted = [...payments].sort((a, b) => {
    const order: Record<string, number> = { overdue: 0, pending: 1, paid: 2, paid_late: 2, voided: 3, waived: 3 }
    const oa = order[a.status] ?? 2, ob = order[b.status] ?? 2
    if (oa !== ob) return oa - ob
    return a.due_date.localeCompare(b.due_date)
  })

  if (sorted.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-16 text-center text-muted-foreground text-sm">
        No payments yet. Click <span className="text-foreground font-medium">Add Payment</span> to get started.
      </div>
    )
  }

  const sections: { title: string; color: string; items: Payment[] }[] = [
    { title: 'Overdue',  color: 'text-red-400',           items: sorted.filter(p => p.status === 'overdue') },
    { title: 'Open',     color: 'text-amber-400',          items: sorted.filter(p => p.status === 'pending') },
    { title: 'History',  color: 'text-muted-foreground',   items: sorted.filter(p => ['paid','paid_late','waived','voided'].includes(p.status)) },
  ].filter(s => s.items.length > 0)

  return (
    <div className="space-y-4">
      {isMobile && (
        <button
          onClick={onAdd}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border/60 text-sm text-muted-foreground hover:text-foreground hover:border-border active:bg-muted/20 transition-colors"
        >
          <Plus className="w-4 h-4" /> Add Payment
        </button>
      )}
      {sections.map(section => {
        const isCollapsed = collapsed.has(section.title)
        return (
          <div key={section.title} className="space-y-1.5">
            <button
              onClick={() => toggleSection(section.title)}
              className="flex items-center gap-2 w-full px-1 group"
            >
              <span className={cn('text-xs font-semibold uppercase tracking-wider', section.color)}>
                {section.title}
              </span>
              <span className="text-xs text-muted-foreground font-normal">({section.items.length})</span>
              <ChevronRight className={cn('w-3.5 h-3.5 text-muted-foreground/40 ml-auto transition-transform', !isCollapsed && 'rotate-90')} />
            </button>
            {!isCollapsed && (
              <div className="space-y-1.5">
                {section.items.map(p => isMobile ? (
                  <MobilePaymentRow
                    key={p.id}
                    payment={p}
                    onMarkPaid={() => onMarkPaid(p)}
                    onEdit={() => onEdit(p)}
                  />
                ) : (
                  <PaymentRow
                    key={p.id}
                    payment={p}
                    deleteConfirm={deleteConfirm}
                    onMarkPaid={() => onMarkPaid(p)}
                    onClone={days => onClone(p, days)}
                    onEdit={() => onEdit(p)}
                    onClientClick={() => onClientClick(p.client_id)}
                    onDeleteRequest={() => onDeleteRequest(p.id)}
                    onDeleteConfirm={() => onDeleteConfirm(p.id)}
                    onDeleteCancel={onDeleteCancel}
                  />
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

function MobilePaymentRow({ payment: p, onMarkPaid, onEdit }: {
  payment: Payment
  onMarkPaid: () => void
  onEdit: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.pending
  const isPaid = ['paid','paid_late','waived','voided'].includes(p.status)
  const clientName = (p.client as any)?.name ?? 'Unknown'
  const dueDate = new Date(p.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  return (
    <div className={cn('bg-card border border-border border-l-2 rounded-xl px-3 py-2.5 flex items-center gap-3', st.border)}>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-semibold text-foreground truncate">{clientName}</span>
          <span className="text-sm font-bold tabular-nums text-foreground flex-shrink-0">{formatCurrency(p.amount)}</span>
        </div>
        <div className="text-xs text-muted-foreground/70 truncate mt-0.5">
          {paymentLabel(p)} · Due {dueDate}
        </div>
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        {isPaid ? (
          <>
            <span className={cn('text-[10px] font-semibold px-2 py-1 rounded-full border whitespace-nowrap', st.badge)}>{st.label}</span>
            <button onClick={onEdit} className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground active:bg-muted/30 transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </>
        ) : confirming ? (
          <>
            <span className="text-xs text-muted-foreground">Sure?</span>
            <button
              onClick={() => { setConfirming(false); onMarkPaid() }}
              className="text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg active:bg-emerald-500/20"
            >
              Yes
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="text-xs text-muted-foreground px-2 py-1.5"
            >
              No
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => setConfirming(true)}
              className="flex items-center gap-1 text-xs font-medium text-emerald-400 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg active:bg-emerald-500/10 transition-colors"
            >
              <CheckCircle className="w-3.5 h-3.5" /> Paid
            </button>
            <button onClick={onEdit} className="p-1.5 rounded-lg text-muted-foreground/50 hover:text-foreground active:bg-muted/30 transition-colors">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function PaymentRow({
  payment: p, deleteConfirm, onMarkPaid, onClone, onEdit, onClientClick, onDeleteRequest, onDeleteConfirm, onDeleteCancel,
}: {
  payment: Payment
  deleteConfirm: string | null
  onMarkPaid: () => void
  onClone: (days: number) => void
  onEdit: () => void
  onClientClick: () => void
  onDeleteRequest: () => void
  onDeleteConfirm: () => void
  onDeleteCancel: () => void
}) {
  const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.pending
  const isPaid = ['paid','paid_late','waived','voided'].includes(p.status)
  const clientName = (p.client as any)?.name ?? 'Unknown'
  const isDeleting = deleteConfirm === p.id

  return (
    <div className={cn('bg-card border border-border border-l-2 rounded-xl px-4 py-3 flex items-center gap-3 group hover:bg-muted/10 transition-colors', st.border)}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={onClientClick} className="font-semibold text-foreground hover:text-primary transition-colors text-sm">
            {clientName}
          </button>
          <span className="text-xs text-muted-foreground">{paymentLabel(p)}</span>
          <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap', st.badge)}>{st.label}</span>
          {p.source && <span className="text-[10px] text-muted-foreground/50">{SOURCE_LABELS[p.source]}</span>}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {formatCurrency(p.amount)}
          {' · Due '}
          {new Date(p.due_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          {p.paid_date && ` · Paid ${new Date(p.paid_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
          {p.notes && ` · ${p.notes}`}
        </div>
      </div>

      {/* Actions — visible on hover */}
      <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        {!isPaid && (
          <button
            onClick={onMarkPaid}
            className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 hover:bg-emerald-950/30 px-2 py-1 rounded-md transition-all"
          >
            <CheckCircle className="w-3 h-3" /> Paid
          </button>
        )}
        <button onClick={() => onClone(7)}  title="+1 week"  className="text-[10px] text-muted-foreground hover:text-foreground border border-border/60 hover:border-border px-2 py-1 rounded-md transition-all">+1wk</button>
        <button onClick={() => onClone(14)} title="+2 weeks" className="text-[10px] text-muted-foreground hover:text-foreground border border-border/60 hover:border-border px-2 py-1 rounded-md transition-all">+2wk</button>
        <button onClick={() => onClone(30)} title="+1 month" className="text-[10px] text-muted-foreground hover:text-foreground border border-border/60 hover:border-border px-2 py-1 rounded-md transition-all">+1mo</button>
        <button onClick={onEdit} className="text-muted-foreground/60 hover:text-foreground p-1.5 rounded-md hover:bg-muted/40 transition-colors">
          <Pencil className="w-3 h-3" />
        </button>
        {isDeleting ? (
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-red-400">Sure?</span>
            <button onClick={onDeleteConfirm} className="text-[10px] bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30 px-2 py-0.5 rounded-md">Yes</button>
            <button onClick={onDeleteCancel}  className="text-[10px] text-muted-foreground hover:text-foreground px-1 py-0.5">No</button>
          </div>
        ) : (
          <button onClick={onDeleteRequest} className="text-muted-foreground/30 hover:text-red-400 p-1.5 rounded-md hover:bg-red-950/20 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Calendar View ────────────────────────────────────────────────────────────

const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

function CalendarView({
  payments, month, onMonthChange, onEdit, onMarkPaid, onDayClick, onClientClick,
}: {
  payments: Payment[]
  month: { year: number; month: number }
  onMonthChange: (m: { year: number; month: number }) => void
  onEdit: (p: Payment) => void
  onMarkPaid: (p: Payment) => void
  onDayClick: (date: string) => void
  onClientClick?: (id: string) => void
}) {
  const { year, month: mo } = month
  const today = new Date(); today.setHours(0,0,0,0)
  const isMobile = useIsMobile()

  const firstDay = new Date(year, mo, 1).getDay()
  const daysInMonth = new Date(year, mo + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  function prevMonth() {
    onMonthChange(mo === 0 ? { year: year - 1, month: 11 } : { year, month: mo - 1 })
  }
  function nextMonth() {
    onMonthChange(mo === 11 ? { year: year + 1, month: 0 } : { year, month: mo + 1 })
  }

  function dateStr(day: number) {
    return `${year}-${String(mo + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  }

  function paymentsOnDay(day: number) {
    const ds = dateStr(day)
    return payments.filter(p => p.due_date === ds)
  }

  if (isMobile) {
    const daysWithPayments = Array.from({ length: daysInMonth }, (_, i) => i + 1)
      .map(day => ({ day, items: paymentsOnDay(day) }))
      .filter(d => d.items.length > 0)

    return (
      <div className="bg-card border border-border rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-border">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-base font-semibold">{MONTH_NAMES[mo]} {year}</div>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
        {daysWithPayments.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">No payments this month</div>
        ) : (
          <div className="divide-y divide-border/40">
            {daysWithPayments.map(({ day, items }) => {
              const cellDate = new Date(year, mo, day); cellDate.setHours(0,0,0,0)
              const isToday = cellDate.getTime() === today.getTime()
              return (
                <div key={day} className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={cn(
                      'text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full flex-shrink-0',
                      isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground bg-secondary/50'
                    )}>
                      {day}
                    </span>
                    <span className="text-xs text-muted-foreground">{DAY_NAMES[cellDate.getDay()]}</span>
                  </div>
                  <div className="space-y-1.5">
                    {items.map(p => {
                      const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.pending
                      const clientName = (p.client as any)?.name ?? '?'
                      const isPaid = ['paid','paid_late','waived','voided'].includes(p.status)
                      return (
                        <div key={p.id} className={cn('rounded-lg px-3 py-2.5 border', st.calBg)} onClick={() => onEdit(p)}>
                          <div className="flex items-center justify-between gap-2">
                            <button
                              className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate text-left"
                              onClick={e => {
                                e.stopPropagation()
                                const clientId = (p.client as any)?.id
                                if (clientId && onClientClick) onClientClick(clientId)
                              }}
                            >
                              {clientName}
                            </button>
                            <span className="text-sm font-bold tabular-nums flex-shrink-0">{formatCurrency(p.amount)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-2 mt-1">
                            <span className="text-[11px] text-muted-foreground/70 truncate">{paymentLabel(p)}</span>
                            <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap flex-shrink-0', st.badge)}>{st.label}</span>
                          </div>
                          {!isPaid && (
                            <button
                              onClick={e => { e.stopPropagation(); onMarkPaid(p) }}
                              className="mt-1.5 text-[11px] text-emerald-400 flex items-center gap-1"
                            >
                              <CheckCircle className="w-3 h-3" /> Mark paid
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Month nav */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-lg font-semibold">{MONTH_NAMES[mo]} {year}</div>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border bg-background/30">
        {DAY_NAMES.map(d => (
          <div key={d} className="py-2.5 text-center text-[11px] font-semibold text-muted-foreground/50 uppercase tracking-wider">{d}</div>
        ))}
      </div>

      {/* Grid */}
      <div className="grid grid-cols-7" style={{ gridAutoRows: 'minmax(130px, auto)' }}>
        {cells.map((day, idx) => {
          if (!day) return <div key={`empty-${idx}`} className={cn('border-r border-b border-border/20 bg-background/10', idx % 7 === 6 && 'border-r-0')} />

          const cellDate = new Date(year, mo, day); cellDate.setHours(0,0,0,0)
          const isToday = cellDate.getTime() === today.getTime()
          const dayPayments = paymentsOnDay(day)
          const isLastRow = idx >= cells.length - 7
          const ds = dateStr(day)

          return (
            <div
              key={`day-${idx}`}
              className={cn(
                'border-r border-b border-border/20 p-2 min-h-[130px] cursor-pointer hover:bg-muted/10 transition-colors group/day',
                isLastRow && 'border-b-0',
                idx % 7 === 6 && 'border-r-0',
              )}
              onClick={() => onDayClick(ds)}
            >
              {/* Day number */}
              <div className={cn(
                'text-xs font-semibold w-7 h-7 flex items-center justify-center rounded-full mb-1.5 transition-colors group-hover/day:bg-muted/30',
                isToday ? 'bg-primary text-primary-foreground group-hover/day:bg-primary' : 'text-muted-foreground/60',
              )}>
                {day}
              </div>

              {/* Payment cards */}
              <div className="space-y-1" onClick={e => e.stopPropagation()}>
                {dayPayments.map(p => {
                  const st = STATUS_STYLE[p.status] ?? STATUS_STYLE.pending
                  const clientName = (p.client as any)?.name ?? '?'
                  const isPaid = ['paid','paid_late','waived','voided'].includes(p.status)

                  return (
                    <div
                      key={p.id}
                      className={cn('rounded-lg px-2.5 py-2 border cursor-pointer hover:brightness-110 transition-all group/card', st.calBg)}
                      onClick={() => onEdit(p)}
                    >
                      {/* Client + amount row */}
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <button
                          className="text-xs font-semibold text-foreground hover:text-primary transition-colors truncate text-left"
                          onClick={e => {
                            e.stopPropagation()
                            const clientId = (p.client as any)?.id
                            if (clientId && onClientClick) onClientClick(clientId)
                          }}
                        >
                          {clientName}
                        </button>
                        <span className="text-xs font-bold tabular-nums flex-shrink-0">{formatCurrency(p.amount)}</span>
                      </div>
                      {/* Type */}
                      <div className="text-[10px] text-muted-foreground/70 truncate mb-1.5">{paymentLabel(p)}</div>
                      {/* Status badge + mark paid */}
                      <div className="flex items-center justify-between gap-1">
                        <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border whitespace-nowrap', st.badge)}>{st.label}</span>
                        {!isPaid && (
                          <button
                            onClick={e => { e.stopPropagation(); onMarkPaid(p) }}
                            className="opacity-0 group-hover/card:opacity-100 text-emerald-400 hover:text-emerald-300 transition-all flex-shrink-0"
                            title="Mark paid"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
