'use client'

import { useState, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { ChevronDown, ChevronLeft, ChevronRight, Check, Calendar } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import type { Client, ClientStage } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  client?: Client
  defaultStage?: ClientStage
  onSaved?: (client: Client) => void
}

// ─── Stage config with colors ────────────────────────────────────────────────

const STAGES: { value: ClientStage; label: string; color: string; bg: string; dot: string }[] = [
  { value: 'onboarding',         label: 'Onboarding',            color: 'text-blue-400',    bg: 'bg-blue-500/15',    dot: 'bg-blue-400' },
  { value: 'free_trial_pending', label: 'Free Trial (Pending)',  color: 'text-yellow-400',  bg: 'bg-yellow-500/15',  dot: 'bg-yellow-400' },
  { value: 'free_trial',         label: 'Free Trial (Active)',   color: 'text-cyan-400',    bg: 'bg-cyan-500/15',    dot: 'bg-cyan-400' },
  { value: 'trial_concluded',    label: 'Free Trial (Complete)', color: 'text-violet-400',  bg: 'bg-violet-500/15',  dot: 'bg-violet-400' },
  { value: 'active_client',      label: 'Active Client',         color: 'text-emerald-400', bg: 'bg-emerald-500/15', dot: 'bg-emerald-400' },
  { value: 'overdue',            label: 'Overdue',               color: 'text-red-400',     bg: 'bg-red-500/15',     dot: 'bg-red-400' },
  { value: 'paused',             label: 'Paused',                color: 'text-amber-400',   bg: 'bg-amber-500/15',   dot: 'bg-amber-400' },
  { value: 'churned',            label: 'Churned',               color: 'text-zinc-400',    bg: 'bg-zinc-500/15',    dot: 'bg-zinc-400' },
  { value: 'free_trial_lost',    label: 'Free Trial (Lost)',     color: 'text-rose-400',    bg: 'bg-rose-500/15',    dot: 'bg-rose-400' },
]

const FREQUENCIES: { value: string; label: string }[] = [
  { value: 'monthly',    label: 'Monthly' },
  { value: 'bi_weekly',  label: 'Bi-Weekly' },
  { value: 'weekly',     label: 'Weekly' },
  { value: 'one_time',   label: 'One-Time' },
  { value: 'custom',     label: 'Custom' },
]

const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CAL_DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

// ─── Shared dropdown wrapper ──────────────────────────────────────────────────

function DropdownWrapper({ open, onClose, trigger, children }: {
  open: boolean; onClose: () => void; trigger: React.ReactNode; children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open, onClose])

  return (
    <div ref={ref} className="relative">
      {trigger}
      {open && (
        <div className="absolute z-50 top-full mt-1 left-0 min-w-full bg-[#111116] border border-border/60 rounded-xl shadow-2xl overflow-hidden">
          {children}
        </div>
      )}
    </div>
  )
}

// ─── Stage Select ─────────────────────────────────────────────────────────────

function StageSelect({ value, onChange }: { value: ClientStage; onChange: (v: ClientStage) => void }) {
  const [open, setOpen] = useState(false)
  const stage = STAGES.find(s => s.value === value) ?? STAGES[0]

  return (
    <DropdownWrapper open={open} onClose={() => setOpen(false)} trigger={
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-11 px-3 flex items-center justify-between gap-2 bg-secondary/50 border border-border/50 rounded-xl hover:bg-secondary/70 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', stage.dot)} />
          <span className={cn('text-sm font-medium', stage.color)}>{stage.label}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </button>
    }>
      <div className="py-1">
        {STAGES.map(s => (
          <button
            key={s.value}
            type="button"
            onClick={() => { onChange(s.value); setOpen(false) }}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors',
              s.value === value && 'bg-white/5'
            )}
          >
            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', s.dot)} />
            <span className={cn('text-sm font-medium flex-1 text-left', s.color)}>{s.label}</span>
            {s.value === value && <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />}
          </button>
        ))}
      </div>
    </DropdownWrapper>
  )
}

// ─── Frequency Select ─────────────────────────────────────────────────────────

function FrequencySelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const freq = FREQUENCIES.find(f => f.value === value) ?? FREQUENCIES[0]

  return (
    <DropdownWrapper open={open} onClose={() => setOpen(false)} trigger={
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-11 px-3 flex items-center justify-between gap-2 bg-secondary/50 border border-border/50 rounded-xl hover:bg-secondary/70 transition-colors"
      >
        <span className="text-sm text-foreground">{freq.label}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </button>
    }>
      <div className="py-1">
        {FREQUENCIES.map(f => (
          <button
            key={f.value}
            type="button"
            onClick={() => { onChange(f.value); setOpen(false) }}
            className={cn(
              'w-full flex items-center justify-between gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors',
              f.value === value && 'bg-white/5'
            )}
          >
            <span className="text-sm text-foreground">{f.label}</span>
            {f.value === value && <Check className="w-3.5 h-3.5 text-primary" />}
          </button>
        ))}
      </div>
    </DropdownWrapper>
  )
}

// ─── Date Picker ──────────────────────────────────────────────────────────────

function DatePicker({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
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
    onChange(ds)
    setOpen(false)
  }

  const displayValue = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : ''

  return (
    <DropdownWrapper open={open} onClose={() => setOpen(false)} trigger={
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-11 px-3 flex items-center justify-between gap-2 bg-secondary/50 border border-border/50 rounded-xl hover:bg-secondary/70 transition-colors"
      >
        <span className={cn('text-sm', displayValue ? 'text-foreground' : 'text-muted-foreground')}>
          {displayValue || (placeholder ?? 'Select date...')}
        </span>
        <Calendar className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </button>
    }>
      <div className="p-4 w-[280px]">
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-sm font-semibold">{CAL_MONTHS[viewMonth]} {viewYear}</span>
          <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 mb-1">
          {CAL_DAYS.map((d, i) => (
            <div key={i} className="text-center text-[10px] font-semibold text-muted-foreground/50 py-1">{d}</div>
          ))}
        </div>

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
                  isSelected
                    ? 'bg-primary text-primary-foreground shadow-lg'
                    : isToday
                    ? 'border border-primary/50 text-primary'
                    : 'text-foreground/80 hover:bg-white/10 hover:text-foreground'
                )}
              >
                {day}
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/40">
          <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Clear</button>
          <button type="button" onClick={() => { onChange(today.toISOString().split('T')[0]); setOpen(false) }} className="text-xs text-primary hover:text-primary/80 transition-colors font-medium">Today</button>
        </div>
      </div>
    </DropdownWrapper>
  )
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export function ClientForm({ open, onClose, client, defaultStage, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: client?.name ?? '',
    business_name: client?.business_name ?? '',
    owner_name: client?.owner_name ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    market_location: client?.market_location ?? '',
    timezone: client?.timezone ?? '',
    stage: (client?.stage ?? defaultStage ?? 'onboarding') as ClientStage,
    assigned_va: client?.assigned_va ?? '',
    monthly_retainer: client?.monthly_retainer?.toString() ?? '',
    payment_frequency: client?.payment_frequency ?? 'monthly',
    trial_start: client?.trial_start ?? '',
    trial_end: client?.trial_end ?? '',
    ghl_location_link: client?.ghl_location_link ?? '',
    ad_account_link: client?.ad_account_link ?? '',
    slack_thread: client?.slack_thread ?? '',
    google_drive_folder: client?.google_drive_folder ?? '',
    deal_notes: client?.deal_notes ?? '',
    advertised_package: client?.advertised_package ?? '',
  })

  useEffect(() => {
    if (open && defaultStage && !client) setForm(f => ({ ...f, stage: defaultStage }))
  }, [open, defaultStage, client])

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    setLoading(true)

    const raw: Record<string, unknown> = { ...form }
    const payload: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(raw)) {
      payload[k] = typeof v === 'string' && v.trim() === '' ? null : v
    }
    payload.monthly_retainer = form.monthly_retainer ? Number(form.monthly_retainer) : null
    payload.trial_start = form.trial_start || null
    payload.trial_end = form.trial_end || null

    try {
      const url = client ? `/api/clients/${client.id}` : '/api/clients'
      const method = client ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(client ? 'Client updated' : 'Client added')
      onSaved?.(data)
      onClose()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setLoading(false)
    }
  }

  const stageConfig = STAGES.find(s => s.value === form.stage)

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[760px] max-w-[95vw] max-h-[90vh] overflow-y-auto overflow-x-visible bg-card border-border">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <DialogTitle className="text-xl">{client ? 'Edit Client' : 'Add New Client'}</DialogTitle>
            {stageConfig && (
              <span className={cn('px-2.5 py-1 rounded-full text-xs font-semibold', stageConfig.bg, stageConfig.color)}>
                {stageConfig.label}
              </span>
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-4">
          {/* Row 1: Name + Business */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Client Name *</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="John Smith" className="bg-secondary/50 h-11 text-base border-border/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Business Name</Label>
              <Input value={form.business_name} onChange={(e) => set('business_name', e.target.value)} placeholder="Pro Shine Detailing" className="bg-secondary/50 h-11 text-base border-border/50" />
            </div>
          </div>

          {/* Row 2: Phone + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Phone</Label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(555) 123-4567" className="bg-secondary/50 h-11 text-base border-border/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Email</Label>
              <Input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="john@example.com" className="bg-secondary/50 h-11 text-base border-border/50" />
            </div>
          </div>

          {/* Row 3: Location + Timezone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Market / Location</Label>
              <Input value={form.market_location} onChange={(e) => set('market_location', e.target.value)} placeholder="Houston, TX" className="bg-secondary/50 h-11 text-base border-border/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Timezone</Label>
              <Input value={form.timezone} onChange={(e) => set('timezone', e.target.value)} placeholder="CST" className="bg-secondary/50 h-11 text-base border-border/50" />
            </div>
          </div>

          {/* Divider */}
          <div className="border-t border-border/30" />

          {/* Row 4: Stage + Retainer + Frequency */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Stage</Label>
              <StageSelect value={form.stage} onChange={(v) => set('stage', v)} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Monthly Retainer ($)</Label>
              <Input value={form.monthly_retainer} onChange={(e) => set('monthly_retainer', e.target.value)} placeholder="1000" type="number" className="bg-secondary/50 h-11 text-base border-border/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Payment Frequency</Label>
              <FrequencySelect value={form.payment_frequency} onChange={(v) => set('payment_frequency', v)} />
            </div>
          </div>

          {/* Row 5: Trial dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trial Start</Label>
              <DatePicker value={form.trial_start} onChange={(v) => set('trial_start', v)} placeholder="Select start date..." />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Trial End</Label>
              <DatePicker value={form.trial_end} onChange={(v) => set('trial_end', v)} placeholder="Select end date..." />
            </div>
          </div>

          {/* Advertised Package + Deal Notes */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Advertised Package</Label>
            <Input value={form.advertised_package} onChange={(e) => set('advertised_package', e.target.value)} placeholder="e.g. Ads + AI + CRM, Ads Only..." className="bg-secondary/50 h-11 text-base border-border/50" />
          </div>
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Deal Notes</Label>
            <Textarea value={form.deal_notes} onChange={(e) => set('deal_notes', e.target.value)} placeholder="Special pricing, discounts, custom deal notes..." className="bg-secondary/50 h-24 text-base border-border/50 resize-none" />
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? 'Saving...' : client ? 'Save Changes' : 'Add Client'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
