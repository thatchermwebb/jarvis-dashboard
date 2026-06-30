'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Plus, X, Clock, User, Trash2, RefreshCw, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { GHLAppointment } from '@/types'

const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CAL_DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']

// Color palette per calendar (cycles through)
const CAL_COLORS = [
  { bg: 'bg-primary/10 border-primary/20', text: 'text-primary/80', dot: 'bg-primary' },
  { bg: 'bg-violet-500/10 border-violet-500/20', text: 'text-violet-400', dot: 'bg-violet-400' },
  { bg: 'bg-amber-500/10 border-amber-500/20', text: 'text-amber-400', dot: 'bg-amber-400' },
  { bg: 'bg-emerald-500/10 border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  { bg: 'bg-blue-500/10 border-blue-500/20', text: 'text-blue-400', dot: 'bg-blue-400' },
  { bg: 'bg-pink-500/10 border-pink-500/20', text: 'text-pink-400', dot: 'bg-pink-400' },
]

interface GHLCalendar {
  id: string
  name: string
  description?: string
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}
function dateKey(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// ─── New Appointment Dialog ────────────────────────────────────────────────────

function NewApptDialog({ open, defaultDate, calendars, onClose, onCreated }: {
  open: boolean; defaultDate?: string; calendars: GHLCalendar[]
  onClose: () => void; onCreated: () => void
}) {
  const [form, setForm] = useState({ title: '', startTime: '', endTime: '', calendarId: '', contactId: '', notes: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (open) {
      const base = defaultDate ?? new Date().toISOString().slice(0, 10)
      setForm({
        title: '', startTime: `${base}T10:00`, endTime: `${base}T11:00`,
        calendarId: calendars[0]?.id ?? '', contactId: '', notes: '',
      })
    }
  }, [open, defaultDate, calendars])

  function set(k: string, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Title required')
    if (!form.calendarId) return toast.error('Select a calendar')
    setSaving(true)
    try {
      const res = await fetch('/api/ghl/appointments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          calendarId: form.calendarId,
          startTime: new Date(form.startTime).toISOString(),
          endTime: new Date(form.endTime).toISOString(),
          contactId: form.contactId || undefined,
          notes: form.notes || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed')
      toast.success('Appointment created in GHL ✓')
      onCreated(); onClose()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border/40 flex items-center justify-between">
          <h2 className="text-base font-semibold">New Appointment</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="w-4 h-4" /></button>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Title *</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Appointment title"
              className="w-full bg-secondary/50 border border-border rounded-xl px-3 h-10 text-sm outline-none focus:border-primary/50" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Calendar *</label>
            <select value={form.calendarId} onChange={e => set('calendarId', e.target.value)}
              className="w-full bg-secondary/50 border border-border rounded-xl px-3 h-10 text-sm outline-none focus:border-primary/50">
              <option value="">Select calendar...</option>
              {calendars.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Start *</label>
              <input type="datetime-local" value={form.startTime} onChange={e => set('startTime', e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-xl px-3 h-10 text-sm outline-none focus:border-primary/50" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">End *</label>
              <input type="datetime-local" value={form.endTime} onChange={e => set('endTime', e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-xl px-3 h-10 text-sm outline-none focus:border-primary/50" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">GHL Contact ID <span className="text-muted-foreground/40 font-normal">(optional)</span></label>
            <input value={form.contactId} onChange={e => set('contactId', e.target.value)} placeholder="GHL contact ID"
              className="w-full bg-secondary/50 border border-border rounded-xl px-3 h-10 text-sm outline-none focus:border-primary/50 font-mono" />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/50 resize-none" />
          </div>
          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-1">{saving ? 'Creating...' : 'Create in GHL'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Day Popup ─────────────────────────────────────────────────────────────────

function DayPopup({ date, appts, calendarMap, onClose, onDelete, onNew }: {
  date: string; appts: GHLAppointment[]
  calendarMap: Map<string, { name: string; color: typeof CAL_COLORS[0] }>
  onClose: () => void; onDelete: (id: string) => void; onNew: (date: string) => void
}) {
  const [deleting, setDeleting] = useState<string | null>(null)

  async function handleDelete(id: string) {
    setDeleting(id)
    try {
      const res = await fetch(`/api/ghl/appointments/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      onDelete(id); toast.success('Appointment cancelled')
    } catch { toast.error('Failed to cancel') }
    finally { setDeleting(null) }
  }

  const sorted = [...appts].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div>
            <div className="text-sm font-semibold">{fmtDate(date + 'T12:00:00')}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{appts.length} appointment{appts.length !== 1 ? 's' : ''}</div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => onNew(date)} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors font-medium">
              <Plus className="w-3.5 h-3.5" /> Add
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="divide-y divide-border/30 max-h-[60vh] overflow-y-auto">
          {sorted.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-muted-foreground">No appointments this day</div>
          ) : sorted.map(appt => {
            const cal = calendarMap.get(appt.calendarId ?? '')
            return (
              <div key={appt.id} className="px-5 py-3.5 group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    {cal && (
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', cal.color.dot)} />
                        <span className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">{cal.name}</span>
                      </div>
                    )}
                    <div className="text-sm font-medium truncate">{appt.title}</div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {fmtTime(appt.startTime)} – {fmtTime(appt.endTime)}
                      </span>
                      {appt.contact?.name && (
                        <span className="flex items-center gap-1"><User className="w-3 h-3" />{appt.contact.name}</span>
                      )}
                    </div>
                    {appt.notes && <div className="text-xs text-muted-foreground/60 mt-1 italic truncate">{appt.notes}</div>}
                    {appt.status && <div className="text-[10px] text-muted-foreground/40 mt-1 uppercase tracking-wider">{appt.status}</div>}
                  </div>
                  <button
                    onClick={() => handleDelete(appt.id)}
                    disabled={deleting === appt.id}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-red-400 p-1 flex-shrink-0 mt-0.5"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="px-5 py-3 border-t border-border/40">
          <button onClick={() => onNew(date)} className="w-full flex items-center justify-center gap-2 text-sm text-primary/70 hover:text-primary transition-colors py-1">
            <Plus className="w-4 h-4" /> New appointment on this day
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function CalendarPage() {
  const today = new Date(); today.setHours(0,0,0,0)
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  const [calendars, setCalendars] = useState<GHLCalendar[]>([])
  const [activeCalendars, setActiveCalendars] = useState<Set<string>>(new Set())
  const [appointments, setAppointments] = useState<GHLAppointment[]>([])
  const [loading, setLoading] = useState(true)
  const [ghlError, setGhlError] = useState<string | null>(null)

  const [popupDate, setPopupDate] = useState<string | null>(null)
  const [newApptOpen, setNewApptOpen] = useState(false)
  const [newApptDate, setNewApptDate] = useState<string | undefined>()

  // Build calendar→color map
  const calColorMap = new Map<string, { name: string; color: typeof CAL_COLORS[0] }>()
  calendars.forEach((c, i) => calColorMap.set(c.id, { name: c.name, color: CAL_COLORS[i % CAL_COLORS.length] }))

  // Load calendars once
  useEffect(() => {
    fetch('/api/ghl/calendars')
      .then(r => r.json())
      .then(data => {
        const list: GHLCalendar[] = data.calendars ?? data ?? []
        setCalendars(list)
        setActiveCalendars(new Set(list.map(c => c.id)))
      })
      .catch(() => {})
  }, [])

  const loadAppointments = useCallback(async () => {
    setLoading(true)
    setGhlError(null)
    const startTime = new Date(viewYear, viewMonth, 1).toISOString()
    const endTime = new Date(viewYear, viewMonth + 1, 0, 23, 59, 59).toISOString()
    try {
      const res = await fetch(`/api/ghl/appointments?startTime=${encodeURIComponent(startTime)}&endTime=${encodeURIComponent(endTime)}`)
      const data = await res.json()
      if (!res.ok) {
        setGhlError(data.error ?? 'GHL error')
        setAppointments([])
      } else {
        const events: GHLAppointment[] = data.events ?? data.appointments ?? (Array.isArray(data) ? data : [])
        setAppointments(events)
      }
    } catch {
      setGhlError('Network error connecting to GHL')
    } finally {
      setLoading(false)
    }
  }, [viewYear, viewMonth])

  useEffect(() => { loadAppointments() }, [loadAppointments])

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  function toggleCalendar(id: string) {
    setActiveCalendars(prev => {
      const next = new Set(prev)
      if (next.has(id)) { if (next.size > 1) next.delete(id) } // keep at least one
      else next.add(id)
      return next
    })
  }

  // Filter by active calendars
  const visibleAppts = appointments.filter(a => !a.calendarId || activeCalendars.has(a.calendarId))

  // Group by day
  const byDay: Record<string, GHLAppointment[]> = {}
  visibleAppts.forEach(a => {
    const k = dateKey(a.startTime)
    if (!byDay[k]) byDay[k] = []
    byDay[k].push(a)
  })

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`

  function cellKey(day: number) {
    return `${viewYear}-${String(viewMonth+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  }

  function handleDeleteAppt(id: string) {
    setAppointments(prev => prev.filter(a => a.id !== id))
    const remaining = (byDay[popupDate!] ?? []).filter(a => a.id !== id)
    if (remaining.length === 0) setPopupDate(null)
  }

  return (
    <div className="max-w-6xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-1">GHL appointments — view, create, and cancel</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={loadAppointments} className="gap-2">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button size="sm" onClick={() => { setNewApptDate(undefined); setNewApptOpen(true) }} className="gap-2">
            <Plus className="w-4 h-4" /> New Appointment
          </Button>
        </div>
      </div>

      {/* GHL not configured */}
      {ghlError && (
        <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3 text-sm text-amber-400">
          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-medium">GHL not connected</div>
            <div className="text-amber-400/70 text-xs mt-0.5">{ghlError}</div>
            <div className="text-amber-400/60 text-xs mt-1">
              Add <code className="font-mono bg-amber-500/10 px-1 rounded">GHL_API_KEY</code> and{' '}
              <code className="font-mono bg-amber-500/10 px-1 rounded">GHL_LOCATION_ID</code> to{' '}
              <code className="font-mono bg-amber-500/10 px-1 rounded">.env.local</code>, then restart the dev server.
            </div>
          </div>
        </div>
      )}

      {/* Calendar filter pills */}
      {calendars.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {calendars.map((c, i) => {
            const color = CAL_COLORS[i % CAL_COLORS.length]
            const active = activeCalendars.has(c.id)
            return (
              <button
                key={c.id}
                onClick={() => toggleCalendar(c.id)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all',
                  active ? `${color.bg} ${color.text}` : 'bg-secondary/30 text-muted-foreground/50 border-border/30'
                )}
              >
                <span className={cn('w-1.5 h-1.5 rounded-full', active ? color.dot : 'bg-muted-foreground/30')} />
                {c.name}
              </button>
            )
          })}
        </div>
      )}

      {/* Calendar */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Nav */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold">{CAL_MONTHS[viewMonth]} {viewYear}</h2>
            {loading && <RefreshCw className="w-3.5 h-3.5 text-muted-foreground/50 animate-spin" />}
            {!loading && <span className="text-xs text-muted-foreground/50">{visibleAppts.length} appointment{visibleAppts.length !== 1 ? 's' : ''}</span>}
          </div>
          <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border/40">
          {CAL_DAYS.map(d => (
            <div key={d} className="py-2 text-center text-[10px] font-semibold text-muted-foreground/50 uppercase">{d}</div>
          ))}
        </div>

        {/* Grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} className="border-b border-r border-border/20 min-h-[110px]" />
            const key = cellKey(day)
            const dayAppts = [...(byDay[key] ?? [])].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
            const isToday = key === todayKey
            const isPast = new Date(viewYear, viewMonth, day) < today
            return (
              <div
                key={`d-${idx}`}
                onClick={() => setPopupDate(key)}
                className={cn(
                  'border-b border-r border-border/20 min-h-[110px] p-2 cursor-pointer transition-colors hover:bg-secondary/15',
                  isToday && 'bg-primary/5'
                )}
              >
                <div className={cn(
                  'text-xs font-medium mb-1.5 w-6 h-6 flex items-center justify-center rounded-full',
                  isToday ? 'bg-primary text-primary-foreground' : isPast ? 'text-muted-foreground/40' : 'text-muted-foreground'
                )}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {dayAppts.slice(0, 3).map(a => {
                    const cal = calColorMap.get(a.calendarId ?? '')
                    const color = cal?.color ?? CAL_COLORS[0]
                    return (
                      <div key={a.id} className={cn('border rounded px-1.5 py-0.5 flex items-center gap-1 min-w-0', color.bg)}>
                        <span className={cn('text-[10px] font-medium flex-shrink-0', color.text)}>{fmtTime(a.startTime)}</span>
                        <span className="text-[9px] text-foreground/60 truncate flex-1">{a.title}</span>
                      </div>
                    )
                  })}
                  {dayAppts.length > 3 && (
                    <div className="text-[9px] text-muted-foreground/50 pl-1">+{dayAppts.length - 3} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Popups */}
      {popupDate && (
        <DayPopup
          date={popupDate}
          appts={byDay[popupDate] ?? []}
          calendarMap={calColorMap}
          onClose={() => setPopupDate(null)}
          onDelete={handleDeleteAppt}
          onNew={d => { setNewApptDate(d); setNewApptOpen(true); setPopupDate(null) }}
        />
      )}
      <NewApptDialog
        open={newApptOpen}
        defaultDate={newApptDate}
        calendars={calendars}
        onClose={() => setNewApptOpen(false)}
        onCreated={loadAppointments}
      />
    </div>
  )
}
