'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Search, X, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, GripVertical, Plus } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Client, LogType, LogOutcome, ClientSentiment } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const LOG_TYPE_LABELS: Record<string, string> = {
  call: '📞 Call', voicemail: '📳 Voicemail', text: '💬 Text',
  meeting: '📅 Meeting', note: '📝 Note', email: '✉️ Email',
}
const OUTCOME_LABELS: Record<string, string> = {
  answered: '✅ Answered', voicemail: '📳 Left Voicemail', texted: '💬 Texted',
  no_answer: '❌ No Answer', meeting_booked: '📅 Meeting Booked',
}
const SENTIMENT_LABELS: Record<string, string> = {
  happy: '😊 Happy', neutral: '😐 Neutral', confused: '😕 Confused',
  concerned: '😟 Concerned', frustrated: '😤 Frustrated', angry: '😠 Angry',
  ghosting: '👻 Ghosting', close_ready: '🎯 Close-Ready',
}
const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CAL_DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

const TRIAL_STAGES = new Set(['free_trial','free_trial_pending','trial_ending_soon','trial_concluded','onboarding'])

// ─── Helpers ─────────────────────────────────────────────────────────────────

function stageDotColor(stage: string): string {
  if (stage === 'active_client' || stage === 'won_back') return 'bg-emerald-400'
  if (stage === 'free_trial' || stage === 'trial_ending_soon') return 'bg-violet-400'
  if (stage === 'free_trial_pending') return 'bg-amber-400'
  if (stage === 'overdue' || stage === 'churn_risk' || stage === 'payment_issue') return 'bg-red-400'
  if (stage === 'paused') return 'bg-slate-400'
  if (stage === 'trial_concluded') return 'bg-teal-400'
  if (stage === 'onboarding') return 'bg-blue-400'
  return 'bg-muted-foreground/40'
}

function getActiveUser(): string {
  try {
    const cookie = document.cookie.split(';').find(c => c.trim().startsWith('cza_user='))
    const userId = cookie?.split('=')[1]?.trim()
    if (userId === 'thatcher') return 'Thatcher'
    if (userId === 'trepp') return 'Trepp'
  } catch {}
  return 'Diego'
}

// ─── Ad Creative types ────────────────────────────────────────────────────────

interface AdCreative { id: string; label: string; order: number }

function loadCreatives(): AdCreative[] {
  try {
    const raw = localStorage.getItem('cza_ad_creatives')
    if (!raw) return []
    return JSON.parse(raw) as AdCreative[]
  } catch { return [] }
}

function saveCreatives(list: AdCreative[]) {
  localStorage.setItem('cza_ad_creatives', JSON.stringify(list))
}

// ─── Inline Calendar ──────────────────────────────────────────────────────────

function InlineCalendar({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const [viewYear, setViewYear] = useState(() => value ? +value.split('-')[0] : today.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => value ? +value.split('-')[1] - 1 : today.getMonth())

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedDate = value ? new Date(value + 'T00:00:00') : null

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }
  function selectDay(day: number) {
    onChange(`${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`)
  }
  function setToday() {
    const d = new Date(); d.setHours(0,0,0,0)
    const ds = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
    onChange(ds)
    setViewYear(d.getFullYear()); setViewMonth(d.getMonth())
  }

  return (
    <div className="bg-secondary/30 border border-border/40 rounded-xl p-3 select-none">
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button type="button" onClick={prevMonth} className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-xs font-semibold">{CAL_MONTHS[viewMonth]} {viewYear}</span>
        <button type="button" onClick={nextMonth} className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {CAL_DAYS.map(d => (
          <div key={d} className="text-center text-[9px] font-semibold text-muted-foreground/50 py-0.5">{d}</div>
        ))}
      </div>
      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />
          const cellDate = new Date(viewYear, viewMonth, day); cellDate.setHours(0,0,0,0)
          const isToday = cellDate.getTime() === today.getTime()
          const isSelected = selectedDate && cellDate.getTime() === selectedDate.getTime()
          return (
            <button
              key={`d-${idx}`}
              type="button"
              onClick={() => selectDay(day)}
              className={cn(
                'w-7 h-7 mx-auto flex items-center justify-center rounded-full text-xs font-medium transition-all',
                isSelected ? 'bg-primary text-primary-foreground' :
                isToday ? 'border border-primary/50 text-primary' :
                'text-foreground/80 hover:bg-white/10'
              )}
            >
              {day}
            </button>
          )
        })}
      </div>
      {/* Footer */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/30">
        <button type="button" onClick={() => onChange('')} className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">Clear</button>
        {value && (
          <span className="text-[10px] text-primary font-medium">
            {new Date(value + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
        <button type="button" onClick={setToday} className="text-[10px] text-primary hover:text-primary/80 transition-colors font-medium">Today</button>
      </div>
    </div>
  )
}

// ─── Ad Creative Dropdown ─────────────────────────────────────────────────────

function AdCreativeSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const [creatives, setCreatives] = useState<AdCreative[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [dragId, setDragId] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => { setCreatives(loadCreatives()) }, [])

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function addCreative() {
    const label = newLabel.trim()
    if (!label) return
    const updated: AdCreative[] = [...creatives, { id: crypto.randomUUID(), label, order: creatives.length }]
    setCreatives(updated); saveCreatives(updated)
    onChange(label); setNewLabel(''); setOpen(false)
  }

  function deleteCreative(id: string) {
    const updated = creatives.filter(c => c.id !== id).map((c, i) => ({ ...c, order: i }))
    setCreatives(updated); saveCreatives(updated)
    if (creatives.find(c => c.id === id)?.label === value) onChange('')
  }

  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id)
    e.dataTransfer.effectAllowed = 'move'
  }

  function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault()
    if (!dragId || dragId === targetId) return
    const from = creatives.findIndex(c => c.id === dragId)
    const to = creatives.findIndex(c => c.id === targetId)
    const updated = [...creatives]
    const [moved] = updated.splice(from, 1)
    updated.splice(to, 0, moved)
    const reordered = updated.map((c, i) => ({ ...c, order: i }))
    setCreatives(reordered); saveCreatives(reordered)
    setDragId(null)
  }

  const sorted = [...creatives].sort((a, b) => a.order - b.order)

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full h-10 px-3 flex items-center justify-between gap-2 bg-secondary/50 border border-border/50 rounded-xl hover:bg-secondary/70 transition-colors text-sm"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{value || 'Select or create...'}</span>
        <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
          {sorted.length === 0 && (
            <div className="px-3 py-2 text-xs text-muted-foreground">No creatives yet — add one below</div>
          )}
          {sorted.map(c => (
            <div
              key={c.id}
              draggable
              onDragStart={e => onDragStart(e, c.id)}
              onDragOver={e => e.preventDefault()}
              onDrop={e => onDrop(e, c.id)}
              className={cn(
                'flex items-center gap-2 px-3 py-2 hover:bg-secondary/50 transition-colors cursor-pointer group',
                value === c.label && 'bg-primary/10'
              )}
              onClick={() => { onChange(c.label); setOpen(false) }}
            >
              <GripVertical className="w-3 h-3 text-muted-foreground/30 cursor-grab flex-shrink-0" />
              <span className="flex-1 text-sm">{c.label}</span>
              <button
                type="button"
                onClick={e => { e.stopPropagation(); deleteCreative(c.id) }}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground/50 hover:text-red-400 transition-all flex-shrink-0"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          {/* Add new */}
          <div className="border-t border-border/40 px-3 py-2 flex items-center gap-2">
            <input
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCreative() } }}
              placeholder="Add new creative..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/50 py-0.5"
              onClick={e => e.stopPropagation()}
            />
            <button type="button" onClick={addCreative} className="text-primary hover:text-primary/80 flex-shrink-0">
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── EditableLog interface ────────────────────────────────────────────────────

interface EditableLog {
  id: string
  log_type: string
  outcome: string
  summary?: string
  sentiment?: string
  promises_made?: string
  next_step?: string
  followup_date?: string
  created_by?: string
  ad_creative?: string
  trial_notes?: string
  client_id: string
  client?: { id: string; name: string; business_name?: string; stage?: string }
}

interface Props {
  open: boolean
  onClose: () => void
  client?: Client
  editLog?: EditableLog
  onLogged?: () => void
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────

export function LogCallDialog({ open, onClose, client: preselectedClient, editLog, onLogged }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(preselectedClient ?? null)
  const [loading, setLoading] = useState(false)
  const [trialNotesOpen, setTrialNotesOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState({
    log_type: 'call' as LogType,
    outcome: 'answered' as LogOutcome,
    summary: '',
    sentiment: '' as ClientSentiment | '',
    promises_made: '',
    next_step: '',
    followup_date: '',
    created_by: 'Diego',
    ad_creative: '',
    trial_notes: '',
  })

  // Determine effective client stage for trial notes logic
  const effectiveStage = preselectedClient?.stage ?? editLog?.client?.stage ?? selectedClient?.stage ?? ''
  const isTrialStage = TRIAL_STAGES.has(effectiveStage)

  useEffect(() => {
    if (open && editLog) {
      setForm({
        log_type: (editLog.log_type as LogType) ?? 'call',
        outcome: (editLog.outcome as LogOutcome) ?? 'answered',
        summary: editLog.summary ?? '',
        sentiment: (editLog.sentiment as ClientSentiment) ?? '',
        promises_made: editLog.promises_made ?? '',
        next_step: editLog.next_step ?? '',
        followup_date: editLog.followup_date ?? '',
        created_by: editLog.created_by ?? 'Diego',
        ad_creative: editLog.ad_creative ?? '',
        trial_notes: editLog.trial_notes ?? '',
      })
      setTrialNotesOpen(TRIAL_STAGES.has(editLog.client?.stage ?? ''))
    }
    if (open && !editLog) {
      setTrialNotesOpen(isTrialStage)
      setForm(prev => ({ ...prev, created_by: getActiveUser() }))
    }
    if (open && !preselectedClient && !editLog) {
      fetch('/api/clients').then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : [])).catch(() => {})
    }
    if (open) {
      setSelectedClient(preselectedClient ?? null)
      setSearch('')
    }
  }, [open, preselectedClient, editLog, isTrialStage])

  // When selected client changes, update trial notes expand
  useEffect(() => {
    if (open && !editLog) {
      setTrialNotesOpen(TRIAL_STAGES.has(selectedClient?.stage ?? preselectedClient?.stage ?? ''))
    }
  }, [selectedClient, preselectedClient, open, editLog])

  useEffect(() => {
    if (!open) {
      setForm({ log_type: 'call', outcome: 'answered', summary: '', sentiment: '', promises_made: '', next_step: '', followup_date: '', created_by: 'Diego', ad_creative: '', trial_notes: '' })
      setSearch(''); setShowDropdown(false); setTrialNotesOpen(false)
    }
  }, [open])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.business_name ?? '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 12)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.summary.trim()) return toast.error('Summary / Notes is required')
    const clientId = editLog?.client_id ?? selectedClient?.id ?? preselectedClient?.id
    if (!clientId) return toast.error('Select a client')
    setLoading(true)
    try {
      const payload: Record<string, unknown> = {
        ...form,
        client_id: clientId,
        sentiment: form.sentiment || undefined,
        ad_creative: form.ad_creative || undefined,
        trial_notes: form.trial_notes || undefined,
        // Only include followup_date if set — don't overwrite existing
        followup_date: form.followup_date || undefined,
      }
      if (editLog) {
        const res = await fetch(`/api/communication-logs/${editLog.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to update')
        toast.success('Entry updated')
      } else {
        const res = await fetch('/api/communication-logs', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
        })
        if (!res.ok) throw new Error('Failed to log')
        toast.success('Call logged')
      }
      onLogged?.()
      onClose()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setLoading(false)
    }
  }

  const displayName = editLog?.client?.name ?? preselectedClient?.name ?? selectedClient?.name
  const creatorTag = form.created_by === 'Diego' ? '(DC)' : form.created_by === 'Thatcher' ? '(TW)' : form.created_by === 'Trepp' ? '(TG)' : ''

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[90vw] max-w-4xl max-h-[92vh] overflow-y-auto bg-card border-border p-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
          <DialogTitle className="text-xl">{editLog ? 'Edit Entry' : 'Log Call / Contact'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* ── LEFT COLUMN ───────────────────────────────────────── */}
            <div className="space-y-5">

              {/* Client */}
              {(preselectedClient || editLog) ? (
                <div className="bg-secondary/40 rounded-xl px-4 py-3 text-sm flex items-center gap-2">
                  {effectiveStage && (
                    <span className={cn('w-2 h-2 rounded-full flex-shrink-0', stageDotColor(effectiveStage))} />
                  )}
                  <span>
                    {editLog ? 'Editing entry for' : 'Logging for'}{' '}
                    <span className="font-semibold text-foreground">{displayName}</span>
                    {(preselectedClient?.business_name || editLog?.client?.business_name) && (
                      <span className="text-muted-foreground"> · {preselectedClient?.business_name ?? editLog?.client?.business_name}</span>
                    )}
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Client</Label>
                  <div className="relative">
                    <div
                      className={cn('flex items-center gap-2 bg-secondary/50 border border-border rounded-xl px-3 h-11 cursor-text', showDropdown && 'border-primary/50')}
                      onClick={() => { setShowDropdown(true); setTimeout(() => searchRef.current?.focus(), 50) }}
                    >
                      {selectedClient && !showDropdown ? (
                        <div className="flex-1 flex items-center gap-2">
                          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', stageDotColor(selectedClient.stage))} />
                          <span className="text-sm font-medium">{selectedClient.name}</span>
                          <button type="button" onClick={e => { e.stopPropagation(); setSelectedClient(null); setSearch('') }} className="ml-auto text-muted-foreground hover:text-foreground">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <>
                          <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <input
                            ref={searchRef}
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            onFocus={() => setShowDropdown(true)}
                            onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                            placeholder="Search clients..."
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                          />
                        </>
                      )}
                    </div>
                    {showDropdown && filtered.length > 0 && (
                      <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                        {filtered.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            className="w-full text-left px-4 py-2.5 hover:bg-secondary/60 transition-colors flex items-center gap-2"
                            onMouseDown={() => { setSelectedClient(c); setSearch(''); setShowDropdown(false) }}
                          >
                            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', stageDotColor(c.stage))} />
                            <span className="text-sm font-medium">{c.name}</span>
                            {c.business_name && <span className="text-xs text-muted-foreground ml-auto">{c.business_name}</span>}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Type + Outcome */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Type</Label>
                  <Select value={form.log_type} onValueChange={v => v && set('log_type', v)}>
                    <SelectTrigger className="bg-secondary/50 h-10 text-sm">
                      <span>{LOG_TYPE_LABELS[form.log_type] ?? form.log_type}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(LOG_TYPE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Outcome <span className="text-muted-foreground/50 font-normal text-xs">(optional)</span></Label>
                  <Select value={form.outcome} onValueChange={v => v && set('outcome', v)}>
                    <SelectTrigger className="bg-secondary/50 h-10 text-sm">
                      <span>{OUTCOME_LABELS[form.outcome] ?? form.outcome}</span>
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(OUTCOME_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Summary — always visible, required */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">
                  Summary / Notes <span className="text-primary text-xs ml-1">*</span>
                </Label>
                <Textarea
                  value={form.summary}
                  onChange={e => set('summary', e.target.value)}
                  placeholder="What happened? What did they say? Key points..."
                  className="bg-secondary/50 min-h-[100px] text-sm resize-none"
                />
              </div>

              {/* Ad Creative */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Ad Creative <span className="text-muted-foreground/50 font-normal text-xs">(optional)</span></Label>
                <AdCreativeSelect value={form.ad_creative} onChange={v => set('ad_creative', v)} />
              </div>
            </div>

            {/* ── RIGHT COLUMN ──────────────────────────────────────── */}
            <div className="space-y-5">

              {/* Sentiment */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Client Sentiment <span className="text-muted-foreground/50 font-normal text-xs">(optional)</span></Label>
                <Select value={form.sentiment} onValueChange={v => v && set('sentiment', v)}>
                  <SelectTrigger className="bg-secondary/50 h-10 text-sm">
                    <span className={form.sentiment ? undefined : 'text-muted-foreground'}>
                      {form.sentiment ? (SENTIMENT_LABELS[form.sentiment] ?? form.sentiment) : 'Mood...'}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(SENTIMENT_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Follow-Up Calendar */}
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Follow-Up Date <span className="text-muted-foreground/50 font-normal text-xs">(optional)</span></Label>
                <InlineCalendar value={form.followup_date} onChange={v => set('followup_date', v)} />
              </div>

              {/* Promises + Next Step */}
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Promises Made <span className="text-muted-foreground/50 font-normal text-xs">(optional)</span></Label>
                  <Input value={form.promises_made} onChange={e => set('promises_made', e.target.value)} placeholder="What was promised?" className="bg-secondary/50 h-10 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">Next Step <span className="text-muted-foreground/50 font-normal text-xs">(optional)</span></Label>
                  <Input value={form.next_step} onChange={e => set('next_step', e.target.value)} placeholder="What needs to happen next?" className="bg-secondary/50 h-10 text-sm" />
                </div>
              </div>

              {/* Trial Notes (collapsible) */}
              <div className="border border-border/40 rounded-xl overflow-hidden">
                <button
                  type="button"
                  onClick={() => setTrialNotesOpen(o => !o)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-secondary/30 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    Trial Notes
                    {isTrialStage && <span className="text-[9px] bg-violet-500/20 text-violet-400 px-1.5 py-0.5 rounded font-normal">Trial</span>}
                  </span>
                  {trialNotesOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                </button>
                {trialNotesOpen && (
                  <div className="px-4 pb-3 pt-1">
                    <Textarea
                      value={form.trial_notes}
                      onChange={e => set('trial_notes', e.target.value)}
                      placeholder="Trial progress, health notes, close probability context..."
                      className="bg-secondary/50 min-h-[80px] text-sm resize-none border-0"
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between mt-6 pt-5 border-t border-border/40">
            <span className="text-xs text-muted-foreground/40 font-mono">{creatorTag} {form.created_by}</span>
            <div className="flex gap-3">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={loading} className="px-8">
                {loading ? 'Saving...' : editLog ? 'Save Changes' : 'Log Contact'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
