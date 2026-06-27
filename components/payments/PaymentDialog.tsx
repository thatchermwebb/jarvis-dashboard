'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ChevronDown, Search, ChevronLeft, ChevronRight, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Client, Payment, PaymentType, PaymentEntryStatus, PaymentSource, PaymentFrequency } from '@/types'

// ─── Data ─────────────────────────────────────────────────────────────────────

const PAYMENT_TYPES: { value: PaymentType; label: string }[] = [
  { value: 'retainer_monthly',  label: 'Retainer (1 month)' },
  { value: 'retainer_biweekly', label: 'Retainer (2 weeks)' },
  { value: 'retainer_weekly',   label: 'Retainer (1 week)' },
  { value: 'deposit',           label: 'Deposit' },
  { value: 'remaining_balance', label: 'Remaining Balance' },
  { value: 'partial_payment',   label: 'Partial Payment' },
  { value: 'one_time',          label: 'One-Time' },
]

const STATUSES: { value: PaymentEntryStatus; label: string; color: string }[] = [
  { value: 'pending',   label: 'Open',        color: 'text-muted-foreground' },
  { value: 'paid',      label: 'Paid',        color: 'text-emerald-400' },
  { value: 'paid_late', label: 'Paid (Late)', color: 'text-blue-400' },
  { value: 'overdue',   label: 'Overdue',     color: 'text-red-400' },
  { value: 'voided',    label: 'Voided',      color: 'text-muted-foreground/50' },
]

const SOURCES: { value: PaymentSource; label: string }[] = [
  { value: 'stripe', label: 'Stripe' },
  { value: 'zelle',  label: 'Zelle' },
  { value: 'other',  label: 'Other' },
]

const TYPE_LABEL: Record<string, string> = Object.fromEntries(PAYMENT_TYPES.map(t => [t.value, t.label]))
const STATUS_MAP = Object.fromEntries(STATUSES.map(s => [s.value, s]))
const SOURCE_LABEL: Record<string, string> = Object.fromEntries(SOURCES.map(s => [s.value, s.label]))

// ─── Shared dropdown wrapper ──────────────────────────────────────────────────

function DropdownWrapper({ trigger, open, onClose, children }: {
  trigger: React.ReactNode; open: boolean; onClose: () => void; children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-[#111116] border border-border/60 rounded-xl shadow-2xl overflow-hidden">
          {children}
        </div>
      )}
    </div>
  )
}

function DropdownTrigger({ label, placeholder, className }: { label?: string; placeholder?: string; className?: string }) {
  return (
    <div className={cn('w-full h-9 flex items-center justify-between rounded-md border border-border bg-secondary/50 px-3 text-sm cursor-pointer hover:border-border/80 transition-colors', className)}>
      <span className={label ? 'text-foreground' : 'text-muted-foreground'}>{label || placeholder}</span>
      <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
    </div>
  )
}

// ─── Client select ────────────────────────────────────────────────────────────

function ClientSelect({ value, clients, onChange }: { value: string; clients: Client[]; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const selected = clients.find(c => c.id === value)
  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.business_name ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <DropdownWrapper
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button type="button" onClick={() => { setOpen(o => !o); setSearch('') }} className="w-full">
          <DropdownTrigger label={selected?.name} placeholder="Select client..." />
        </button>
      }
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/40">
        <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <input
          autoFocus
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search clients..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
        />
      </div>
      <div className="max-h-52 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="px-3 py-3 text-sm text-muted-foreground">No clients found</div>
        ) : filtered.map(c => (
          <button
            key={c.id}
            type="button"
            onClick={() => { onChange(c.id); setOpen(false) }}
            className={cn('w-full flex flex-col items-start px-4 py-2.5 text-sm hover:bg-white/5 transition-colors', c.id === value && 'bg-primary/10')}
          >
            <span className={cn('font-medium', c.id === value ? 'text-primary' : 'text-foreground')}>{c.name}</span>
            {c.business_name && <span className="text-xs text-muted-foreground mt-0.5">{c.business_name}</span>}
          </button>
        ))}
      </div>
    </DropdownWrapper>
  )
}

// ─── Type select ──────────────────────────────────────────────────────────────

function TypeSelect({ value, onChange }: { value: PaymentType; onChange: (v: PaymentType) => void }) {
  const [open, setOpen] = useState(false)

  return (
    <DropdownWrapper
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button type="button" onClick={() => setOpen(o => !o)} className="w-full">
          <DropdownTrigger label={TYPE_LABEL[value]} />
        </button>
      }
    >
      <div className="py-1">
        {PAYMENT_TYPES.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => { onChange(t.value as PaymentType); setOpen(false) }}
            className={cn('w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/5 transition-colors', t.value === value ? 'text-primary' : 'text-foreground')}
          >
            <span>{t.label}</span>
            {t.value === value && <span className="text-primary text-xs">✓</span>}
          </button>
        ))}
      </div>
    </DropdownWrapper>
  )
}

// ─── Status select ────────────────────────────────────────────────────────────

function StatusSelect({ value, onChange }: { value: PaymentEntryStatus; onChange: (v: PaymentEntryStatus) => void }) {
  const [open, setOpen] = useState(false)
  const current = STATUS_MAP[value]

  return (
    <DropdownWrapper
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button type="button" onClick={() => setOpen(o => !o)} className="w-full">
          <div className="w-full h-9 flex items-center justify-between rounded-md border border-border bg-secondary/50 px-3 text-sm cursor-pointer hover:border-border/80 transition-colors">
            <span className={cn('font-medium', current?.color)}>{current?.label}</span>
            <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          </div>
        </button>
      }
    >
      <div className="py-1">
        {STATUSES.map(s => (
          <button
            key={s.value}
            type="button"
            onClick={() => { onChange(s.value); setOpen(false) }}
            className={cn('w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/5 transition-colors')}
          >
            <span className={cn('font-medium', s.color)}>{s.label}</span>
            {s.value === value && <span className={cn('text-xs', s.color)}>✓</span>}
          </button>
        ))}
      </div>
    </DropdownWrapper>
  )
}

// ─── Source select ────────────────────────────────────────────────────────────

function SourceSelect({ value, onChange }: { value: PaymentSource | ''; onChange: (v: PaymentSource | '') => void }) {
  const [open, setOpen] = useState(false)

  return (
    <DropdownWrapper
      open={open}
      onClose={() => setOpen(false)}
      trigger={
        <button type="button" onClick={() => setOpen(o => !o)} className="w-full">
          <DropdownTrigger label={value ? SOURCE_LABEL[value] : undefined} placeholder="Select..." />
        </button>
      }
    >
      <div className="py-1">
        {SOURCES.map(s => (
          <button
            key={s.value}
            type="button"
            onClick={() => { onChange(s.value); setOpen(false) }}
            className={cn('w-full flex items-center justify-between px-4 py-2.5 text-sm hover:bg-white/5 transition-colors', s.value === value ? 'text-primary' : 'text-foreground')}
          >
            <span>{s.label}</span>
            {s.value === value && <span className="text-primary text-xs">✓</span>}
          </button>
        ))}
      </div>
    </DropdownWrapper>
  )
}

// ─── Custom Date Picker ───────────────────────────────────────────────────────

const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CAL_DAYS = ['S','M','T','W','T','F','S']

function DatePicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [viewYear, setViewYear] = useState(() => value ? parseInt(value.split('-')[0]) : new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(() => value ? parseInt(value.split('-')[1]) - 1 : new Date().getMonth())

  const today = new Date(); today.setHours(0,0,0,0)
  const selectedDate = value ? new Date(value + 'T00:00:00') : null

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }
  function selectDay(day: number) {
    const ds = `${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
    onChange(ds); setOpen(false)
  }

  const displayValue = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : undefined

  return (
    <div>
      <button type="button" onClick={() => setOpen(o => !o)} className="w-full">
        <DropdownTrigger label={displayValue} placeholder="Select date..." />
      </button>

      {open && (
        <div className="mt-2 bg-[#111116] border border-border/60 rounded-xl p-4">
          {/* Month nav */}
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold">{CAL_MONTHS[viewMonth]} {viewYear}</span>
            <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {CAL_DAYS.map((d, i) => (
              <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground/50 py-1">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5">
            {cells.map((day, i) => {
              if (!day) return <div key={i} />
              const cellDate = new Date(viewYear, viewMonth, day); cellDate.setHours(0,0,0,0)
              const isToday = cellDate.getTime() === today.getTime()
              const isSelected = selectedDate && cellDate.getTime() === selectedDate.getTime()
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    'w-8 h-8 mx-auto flex items-center justify-center rounded-full text-sm transition-all font-medium',
                    isSelected ? 'bg-primary text-primary-foreground shadow-lg'
                    : isToday ? 'border border-primary/50 text-primary'
                    : 'text-foreground/80 hover:bg-white/10 hover:text-foreground'
                  )}
                >
                  {day}
                </button>
              )
            })}
          </div>

          {/* Quick actions */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
            <button type="button" onClick={() => { onChange(''); setOpen(false) }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors">Clear</button>
            <button type="button" onClick={() => { onChange(today.toISOString().split('T')[0]); setOpen(false) }}
              className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">Today</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

interface Props {
  open: boolean
  onClose: () => void
  onSaved: () => void
  payment?: Payment | null
  prefill?: Partial<{ client_id: string; payment_type: PaymentType; amount: number; due_date: string }>
}

const FREQUENCIES = [
  { value: 'weekly',    label: 'Weekly' },
  { value: 'biweekly', label: 'Bi-weekly' },
  { value: 'monthly',  label: 'Monthly' },
  { value: 'one_time', label: 'One-time' },
]

export function PaymentDialog({ open, onClose, onSaved, payment, prefill }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'single' | 'plan'>('single')

  // Single payment form
  const [form, setForm] = useState({
    client_id: '',
    payment_type: 'retainer_monthly' as PaymentType,
    description: '',
    amount: '',
    due_date: '',
    status: 'pending' as PaymentEntryStatus,
    source: '' as PaymentSource | '',
    notes: '',
  })

  // Payment plan form
  const [plan, setPlan] = useState({
    client_id: '',
    label: '',
    payment_type: 'retainer_biweekly' as PaymentType,
    amount: '',
    frequency: 'biweekly' as PaymentFrequency,
    start_date: '',
    end_date: '',
    notes: '',
  })

  useEffect(() => {
    if (open) {
      fetch('/api/clients').then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : []))
      setTab(payment ? 'single' : 'single')
      if (payment) {
        setForm({
          client_id: payment.client_id,
          payment_type: payment.payment_type,
          description: payment.description ?? '',
          amount: String(payment.amount),
          due_date: payment.due_date,
          status: payment.status,
          source: payment.source ?? '',
          notes: payment.notes ?? '',
        })
      } else if (prefill) {
        setForm(f => ({
          ...f,
          client_id: prefill.client_id ?? '',
          payment_type: prefill.payment_type ?? 'retainer_monthly',
          amount: prefill.amount ? String(prefill.amount) : '',
          due_date: prefill.due_date ?? '',
          status: 'pending',
        }))
        setPlan(p => ({ ...p, client_id: prefill.client_id ?? '' }))
      } else {
        setForm({ client_id: '', payment_type: 'retainer_monthly', description: '', amount: '', due_date: '', status: 'pending', source: '', notes: '' })
        setPlan({ client_id: '', label: '', payment_type: 'retainer_biweekly', amount: '', frequency: 'biweekly', start_date: '', end_date: '', notes: '' })
      }
    }
  }, [open, payment, prefill])

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }
  function setPlanField(field: string, value: string) { setPlan(p => ({ ...p, [field]: value })) }

  async function submitSingle(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_id || !form.amount || !form.due_date) return toast.error('Client, amount, and due date required')
    setSaving(true)
    try {
      const body: Record<string, unknown> = {
        client_id: form.client_id,
        payment_type: form.payment_type,
        description: form.description || undefined,
        amount: Number(form.amount),
        due_date: form.due_date,
        status: form.status,
        source: form.source || undefined,
        notes: form.notes || undefined,
      }
      const url = payment ? `/api/payments/${payment.id}` : '/api/payments'
      const method = payment ? 'PATCH' : 'POST'
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to save'); return }
      toast.success(payment ? 'Payment updated' : 'Payment added')
      onSaved(); onClose()
    } catch (err) { toast.error(String(err)) } finally { setSaving(false) }
  }

  async function submitPlan(e: React.FormEvent) {
    e.preventDefault()
    if (!plan.client_id || !plan.amount || !plan.start_date) return toast.error('Client, amount, and start date required')
    setSaving(true)
    try {
      const res = await fetch('/api/payment-schedules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...plan, amount: Number(plan.amount), end_date: plan.end_date || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { toast.error(data.error ?? 'Failed to create plan'); return }
      toast.success(`Payment plan created — ${data.payments_created} invoices generated`)
      onSaved(); onClose()
    } catch (err) { toast.error(String(err)) } finally { setSaving(false) }
  }

  const fieldClass = 'w-full rounded-md border border-border bg-secondary/50 px-3 h-9 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50'
  const labelClass = 'text-xs font-medium text-muted-foreground uppercase tracking-wider'

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>{payment ? 'Edit Payment' : 'Add Payment'}</DialogTitle>
        </DialogHeader>

        {/* Tab toggle — only show when creating */}
        {!payment && (
          <div className="flex items-center rounded-lg border border-border bg-secondary/30 p-0.5 gap-0.5 mt-1">
            <button type="button" onClick={() => setTab('single')}
              className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-all', tab === 'single' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              Single Payment
            </button>
            <button type="button" onClick={() => setTab('plan')}
              className={cn('flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-sm font-medium transition-all', tab === 'plan' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
              <Repeat className="w-3.5 h-3.5" /> Payment Plan
            </button>
          </div>
        )}

        {/* ── Single Payment ── */}
        {(tab === 'single' || payment) && (
          <form onSubmit={submitSingle} className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <label className={labelClass}>Client</label>
              <ClientSelect value={form.client_id} clients={clients} onChange={id => set('client_id', id)} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Type</label>
              <TypeSelect value={form.payment_type} onChange={v => set('payment_type', v)} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Custom Description <span className="text-muted-foreground/40 font-normal normal-case tracking-normal">(optional)</span></label>
              <input value={form.description} onChange={e => set('description', e.target.value)}
                placeholder='e.g. "Deposit (towards 2 weeks)"' className={fieldClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Amount ($)</label>
                <input type="number" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="500" className={fieldClass} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Due Date</label>
                <DatePicker value={form.due_date} onChange={v => set('due_date', v)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Status</label>
                <StatusSelect value={form.status} onChange={v => set('status', v)} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Source</label>
                <SourceSelect value={form.source} onChange={v => set('source', v)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                placeholder="Optional notes..." rows={2}
                className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Saving...' : payment ? 'Save Changes' : 'Add Payment'}</Button>
            </div>
          </form>
        )}

        {/* ── Payment Plan ── */}
        {tab === 'plan' && !payment && (
          <form onSubmit={submitPlan} className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <label className={labelClass}>Client</label>
              <ClientSelect value={plan.client_id} clients={clients} onChange={id => setPlanField('client_id', id)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Type</label>
                <TypeSelect value={plan.payment_type} onChange={v => setPlanField('payment_type', v)} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Frequency</label>
                <select value={plan.frequency} onChange={e => setPlanField('frequency', e.target.value)}
                  className="w-full h-9 rounded-md border border-border bg-secondary/50 px-3 text-sm text-foreground outline-none focus:border-primary/50 cursor-pointer">
                  {FREQUENCIES.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Label <span className="text-muted-foreground/40 font-normal normal-case tracking-normal">(optional)</span></label>
              <input value={plan.label} onChange={e => setPlanField('label', e.target.value)}
                placeholder="e.g. Monthly Retainer" className={fieldClass} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>Amount ($)</label>
                <input type="number" value={plan.amount} onChange={e => setPlanField('amount', e.target.value)} placeholder="500" className={fieldClass} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Start Date</label>
                <input type="date" value={plan.start_date} onChange={e => setPlanField('start_date', e.target.value)} className={fieldClass} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>End Date <span className="text-muted-foreground/40 font-normal normal-case tracking-normal">(optional — leave blank to generate 12 months)</span></label>
              <input type="date" value={plan.end_date} onChange={e => setPlanField('end_date', e.target.value)} className={fieldClass} />
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Notes</label>
              <textarea value={plan.notes} onChange={e => setPlanField('notes', e.target.value)}
                placeholder="Pay plan details..." rows={2}
                className="w-full rounded-md border border-border bg-secondary/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 resize-none" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Payment Plan'}</Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
