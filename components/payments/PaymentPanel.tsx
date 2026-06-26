'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Check, CalendarDays, Repeat, Trash2, Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn, formatCurrency } from '@/lib/utils'
import type { Payment, PaymentSchedule, PaymentType, PaymentFrequency } from '@/types'

const PAYMENT_TYPES: { value: PaymentType; label: string }[] = [
  { value: 'retainer_monthly', label: 'Retainer (1 month)' },
  { value: 'retainer_biweekly', label: 'Retainer (2 weeks)' },
  { value: 'retainer_weekly', label: 'Retainer (1 week)' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'remaining_balance', label: 'Remaining Balance' },
  { value: 'one_time', label: 'One-Time' },
]

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pending:   { label: 'Pending',   color: 'text-yellow-400 border-yellow-800 bg-yellow-950/40' },
  paid:      { label: 'Paid',      color: 'text-emerald-400 border-emerald-800 bg-emerald-950/40' },
  paid_late: { label: 'Paid Late', color: 'text-blue-400 border-blue-800 bg-blue-950/40' },
  overdue:   { label: 'Overdue',   color: 'text-red-400 border-red-800 bg-red-950/40' },
  waived:    { label: 'Waived',    color: 'text-muted-foreground border-border bg-secondary/30' },
}

function typeLabel(t: string) {
  return PAYMENT_TYPES.find((p) => p.value === t)?.label ?? t
}

interface Props {
  clientId: string
  clientName?: string
}

export function PaymentPanel({ clientId, clientName }: Props) {
  const [payments, setPayments] = useState<Payment[]>([])
  const [schedules, setSchedules] = useState<PaymentSchedule[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [editPayment, setEditPayment] = useState<Payment | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [pRes, sRes] = await Promise.all([
      fetch(`/api/payments?client_id=${clientId}`),
      fetch(`/api/payment-schedules?client_id=${clientId}`),
    ])
    const [pData, sData] = await Promise.all([pRes.json(), sRes.json()])
    setPayments(Array.isArray(pData) ? pData : [])
    setSchedules(Array.isArray(sData) ? sData : [])
    setLoading(false)
  }, [clientId])

  useEffect(() => { load() }, [load])

  async function markStatus(id: string, status: string, wasOverdue: boolean) {
    const finalStatus = wasOverdue && status === 'paid' ? 'paid_late' : status
    try {
      await fetch(`/api/payments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: finalStatus }),
      })
      setPayments((prev) => prev.map((p) => p.id === id ? { ...p, status: finalStatus as any, paid_date: new Date().toISOString().split('T')[0] } : p))
      toast.success(finalStatus === 'paid' || finalStatus === 'paid_late' ? 'Marked as paid' : 'Updated')
    } catch {
      toast.error('Failed to update')
    }
  }

  async function deletePayment(id: string) {
    await fetch(`/api/payments/${id}`, { method: 'DELETE' })
    setPayments((prev) => prev.filter((p) => p.id !== id))
    toast.success('Deleted')
  }

  const overdue = payments.filter((p) => p.status === 'overdue')
  const upcoming = payments.filter((p) => p.status === 'pending')
  const history = payments.filter((p) => ['paid', 'paid_late', 'waived'].includes(p.status))

  const totalOwed = [...overdue, ...upcoming].reduce((s, p) => s + p.amount, 0)
  const totalPaid = history.filter((p) => p.status !== 'waived').reduce((s, p) => s + p.amount, 0)

  return (
    <div className="space-y-4">
      {/* Summary + actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-4 text-xs text-muted-foreground">
          {totalOwed > 0 && <span className="text-red-400 font-medium">{formatCurrency(totalOwed)} outstanding</span>}
          {totalPaid > 0 && <span className="text-emerald-400">{formatCurrency(totalPaid)} collected</span>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setScheduleOpen(true)}>
            <Repeat className="w-3 h-3" /> Set Schedule
          </Button>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setAddOpen(true)}>
            <Plus className="w-3 h-3" /> Add Payment
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="h-24 bg-card border border-border rounded-xl animate-pulse" />
      ) : payments.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center text-xs text-muted-foreground">
          No payments yet. Add a one-time payment or set a recurring schedule.
        </div>
      ) : (
        <div className="space-y-4">
          {/* Overdue */}
          {overdue.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-red-400 uppercase tracking-wider">Overdue ({overdue.length})</div>
              {overdue.map((p) => (
                <PaymentRow key={p.id} payment={p} onMark={(s) => markStatus(p.id, s, true)} onDelete={() => deletePayment(p.id)} onEdit={() => setEditPayment(p)} />
              ))}
            </div>
          )}

          {/* Upcoming */}
          {upcoming.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-yellow-400 uppercase tracking-wider">Upcoming ({upcoming.length})</div>
              {upcoming.map((p) => (
                <PaymentRow key={p.id} payment={p} onMark={(s) => markStatus(p.id, s, false)} onDelete={() => deletePayment(p.id)} onEdit={() => setEditPayment(p)} />
              ))}
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">History ({history.length})</div>
              {history.map((p) => (
                <PaymentRow key={p.id} payment={p} onMark={(s) => markStatus(p.id, s, false)} onDelete={() => deletePayment(p.id)} onEdit={() => setEditPayment(p)} />
              ))}
            </div>
          )}

          {/* Active schedules */}
          {schedules.filter((s) => s.active).length > 0 && (
            <div className="space-y-1.5 pt-2 border-t border-border">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Recurring Schedules</div>
              {schedules.filter((s) => s.active).map((s) => (
                <div key={s.id} className="bg-card border border-border rounded-lg px-3 py-2 flex items-center justify-between text-xs">
                  <div>
                    <span className="text-foreground font-medium">{s.label || typeLabel(s.payment_type)}</span>
                    <span className="text-muted-foreground ml-2">{formatCurrency(s.amount)} · {s.frequency}</span>
                  </div>
                  <span className="text-muted-foreground">from {new Date(s.start_date).toLocaleDateString()}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <AddPaymentDialog open={addOpen} onClose={() => setAddOpen(false)} clientId={clientId} clientName={clientName} onSaved={load} />
      <AddScheduleDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} clientId={clientId} clientName={clientName} onSaved={load} />
      {editPayment && (
        <EditPaymentDialog payment={editPayment} onClose={() => setEditPayment(null)} onSaved={() => { load(); setEditPayment(null) }} />
      )}
    </div>
  )
}

function PaymentRow({ payment: p, onMark, onDelete, onEdit }: {
  payment: Payment; onMark: (s: string) => void; onDelete: () => void; onEdit: () => void
}) {
  const cfg = STATUS_CONFIG[p.status] ?? STATUS_CONFIG.pending
  const isPaid = p.status === 'paid' || p.status === 'paid_late' || p.status === 'waived'

  return (
    <div className="bg-card border border-border rounded-lg px-3 py-2.5 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-foreground">{formatCurrency(p.amount)}</span>
          <span className="text-xs text-muted-foreground">{typeLabel(p.payment_type)}</span>
          <Badge variant="outline" className={cn('text-[10px] px-1.5', cfg.color)}>{cfg.label}</Badge>
        </div>
        <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2">
          <CalendarDays className="w-3 h-3 flex-shrink-0" />
          Due {new Date(p.due_date).toLocaleDateString()}
          {p.paid_date && <span>· Paid {new Date(p.paid_date).toLocaleDateString()}</span>}
          {p.notes && <span>· {p.notes}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 flex-shrink-0">
        {!isPaid && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-950/40 px-2 gap-1" onClick={() => onMark('paid')}>
            <Check className="w-3 h-3" /> Paid
          </Button>
        )}
        {!isPaid && (
          <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground hover:text-foreground px-2 gap-1" onClick={() => onMark('waived')}>
            Waive
          </Button>
        )}
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground" onClick={onEdit}>
          <Pencil className="w-3 h-3" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-muted-foreground hover:text-red-400" onClick={onDelete}>
          <Trash2 className="w-3 h-3" />
        </Button>
      </div>
    </div>
  )
}

function AddPaymentDialog({ open, onClose, clientId, clientName, onSaved }: {
  open: boolean; onClose: () => void; clientId: string; clientName?: string; onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ payment_type: 'retainer_monthly' as PaymentType, amount: '', due_date: '', notes: '' })

  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || !form.due_date) return toast.error('Amount and due date required')
    setSaving(true)
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount), client_id: clientId, status: 'pending' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Payment added')
      onSaved()
      onClose()
      setForm({ payment_type: 'retainer_monthly', amount: '', due_date: '', notes: '' })
    } catch { toast.error('Failed') } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader><DialogTitle>Add Payment{clientName ? ` — ${clientName}` : ''}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.payment_type} onValueChange={(v) => v && set('payment_type', v)}>
              <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount ($)</Label>
              <Input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="500" className="bg-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} className="bg-secondary/50" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional note..." className="bg-secondary/50" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add Payment'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function EditPaymentDialog({ payment, onClose, onSaved }: { payment: Payment; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    payment_type: payment.payment_type,
    amount: String(payment.amount),
    due_date: payment.due_date,
    paid_date: payment.paid_date ?? '',
    status: payment.status,
    notes: payment.notes ?? '',
  })

  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch(`/api/payments/${payment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount), paid_date: form.paid_date || null }),
      })
      if (!res.ok) throw new Error()
      toast.success('Payment updated')
      onSaved()
    } catch { toast.error('Failed to update') } finally { setSaving(false) }
  }

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader><DialogTitle>Edit Payment</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.payment_type} onValueChange={(v) => v && set('payment_type', v)}>
              <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={form.status} onValueChange={(v) => v && set('status', v)}>
              <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="paid_late">Paid Late</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="waived">Waived</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount ($)</Label>
              <Input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} className="bg-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} className="bg-secondary/50" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Paid Date</Label>
            <Input type="date" value={form.paid_date} onChange={(e) => set('paid_date', e.target.value)} className="bg-secondary/50" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional note..." className="bg-secondary/50" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function AddScheduleDialog({ open, onClose, clientId, clientName, onSaved }: {
  open: boolean; onClose: () => void; clientId: string; clientName?: string; onSaved: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    label: '', payment_type: 'retainer_monthly' as PaymentType,
    amount: '', frequency: 'monthly' as PaymentFrequency,
    start_date: '', end_date: '', notes: '',
  })

  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.amount || !form.start_date) return toast.error('Amount and start date required')
    setSaving(true)
    try {
      const res = await fetch('/api/payment-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount), client_id: clientId, end_date: form.end_date || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(`Schedule created — ${data.payments_created} payments generated`)
      onSaved()
      onClose()
    } catch (err) { toast.error(String(err)) } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader><DialogTitle>Set Pay Schedule{clientName ? ` — ${clientName}` : ''}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label>Label (optional)</Label>
            <Input value={form.label} onChange={(e) => set('label', e.target.value)} placeholder="e.g. Monthly Retainer" className="bg-secondary/50" />
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.payment_type} onValueChange={(v) => v && set('payment_type', v)}>
              <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount ($)</Label>
              <Input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="500" className="bg-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <Label>Frequency</Label>
              <Select value={form.frequency} onValueChange={(v) => v && set('frequency', v)}>
                <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Weekly</SelectItem>
                  <SelectItem value="biweekly">Bi-weekly</SelectItem>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="one_time">One-time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Start Date</Label>
              <Input type="date" value={form.start_date} onChange={(e) => set('start_date', e.target.value)} className="bg-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <Label>End Date (optional)</Label>
              <Input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} className="bg-secondary/50" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Pay plan details..." className="bg-secondary/50" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Schedule'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
