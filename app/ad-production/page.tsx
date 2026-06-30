'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, ChevronDown, Check, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn, formatDate } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { DeliveryPipeline } from '@/components/delivery/DeliveryPipeline'
import type { AdProduction, AdProductionStatus, AdProductionPriority } from '@/types'

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<AdProductionStatus, { label: string; color: string; dot: string }> = {
  not_started: { label: 'Not Started', color: 'text-muted-foreground bg-secondary/50 border-border/40', dot: 'bg-muted-foreground/40' },
  in_progress:  { label: 'In Progress', color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',       dot: 'bg-blue-400' },
  review:       { label: 'In Review',   color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',    dot: 'bg-amber-400' },
  done:         { label: 'Done',        color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
}

const PRIORITY_CONFIG: Record<AdProductionPriority, { label: string; color: string }> = {
  low:    { label: 'Low',    color: 'text-muted-foreground/60' },
  med:    { label: 'Med',    color: 'text-amber-400' },
  high:   { label: 'High',   color: 'text-orange-400' },
  urgent: { label: 'Urgent', color: 'text-red-400' },
}

const AD_FORMATS = ['V300', 'V500', 'Square', 'Story', 'Reel', 'Banner', 'Other']
const ASSIGNEES = ['Thatcher', 'Diego', 'Trepp']

// ─── Row edit form ─────────────────────────────────────────────────────────────

interface AdForm {
  client_id: string
  ad_name: string
  format: string
  due_date: string
  status: AdProductionStatus
  assigned_to: string
  priority: AdProductionPriority
  notes: string
}

const BLANK_FORM: AdForm = {
  client_id: '', ad_name: '', format: 'V300', due_date: '', status: 'not_started',
  assigned_to: 'Thatcher', priority: 'med', notes: '',
}

// ─── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status, onChange }: { status: AdProductionStatus; onChange?: (s: AdProductionStatus) => void }) {
  const [open, setOpen] = useState(false)
  const cfg = STATUS_CONFIG[status]
  if (!onChange) return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border', cfg.color)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />{cfg.label}
    </span>
  )
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full border hover:opacity-80 transition-opacity', cfg.color)}
      >
        <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />{cfg.label}
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-20 bg-card border border-border rounded-xl shadow-xl overflow-hidden min-w-[140px]">
          {(Object.entries(STATUS_CONFIG) as [AdProductionStatus, typeof STATUS_CONFIG[AdProductionStatus]][]).map(([key, c]) => (
            <button
              key={key}
              onClick={() => { onChange(key); setOpen(false) }}
              className={cn('w-full text-left flex items-center gap-2 px-3 py-2 text-xs hover:bg-secondary/50 transition-colors', status === key && 'bg-secondary/30')}
            >
              <span className={cn('w-1.5 h-1.5 rounded-full', c.dot)} />{c.label}
              {status === key && <Check className="w-3 h-3 ml-auto text-primary" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── New/Edit row dialog ───────────────────────────────────────────────────────

function AdFormDialog({
  open, onClose, onSave, initial, clients,
}: {
  open: boolean; onClose: () => void; onSave: (form: AdForm) => Promise<void>;
  initial?: AdForm; clients: { id: string; name: string; business_name?: string }[]
}) {
  const [form, setForm] = useState<AdForm>(initial ?? BLANK_FORM)
  const [saving, setSaving] = useState(false)
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDrop, setShowClientDrop] = useState(false)

  useEffect(() => { if (open) setForm(initial ?? BLANK_FORM) }, [open, initial])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.business_name ?? '').toLowerCase().includes(clientSearch.toLowerCase())
  ).slice(0, 10)

  const selectedClient = clients.find(c => c.id === form.client_id)

  function set(k: keyof AdForm, v: string) { setForm(prev => ({ ...prev, [k]: v })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.ad_name.trim()) return toast.error('Ad name required')
    if (!form.client_id) return toast.error('Select a client')
    setSaving(true)
    try { await onSave(form); onClose() }
    catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-5 border-b border-border/40">
          <h2 className="text-base font-semibold">{initial?.ad_name ? 'Edit Ad' : 'New Ad'}</h2>
        </div>
        <form onSubmit={submit} className="p-6 space-y-4">
          {/* Client */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Client *</label>
            <div className="relative">
              <div
                className="flex items-center gap-2 bg-secondary/50 border border-border rounded-xl px-3 h-10 cursor-text"
                onClick={() => setShowClientDrop(true)}
              >
                <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                {selectedClient && !showClientDrop ? (
                  <span className="text-sm flex-1">{selectedClient.name}</span>
                ) : (
                  <input
                    autoFocus={showClientDrop}
                    value={clientSearch}
                    onChange={e => setClientSearch(e.target.value)}
                    onFocus={() => setShowClientDrop(true)}
                    onBlur={() => setTimeout(() => setShowClientDrop(false), 150)}
                    placeholder="Search clients..."
                    className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                  />
                )}
              </div>
              {showClientDrop && filtered.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-48 overflow-y-auto">
                  {filtered.map(c => (
                    <button key={c.id} type="button" onMouseDown={() => { set('client_id', c.id); setClientSearch(''); setShowClientDrop(false) }}
                      className="w-full text-left px-4 py-2.5 hover:bg-secondary/50 text-sm flex items-center gap-2">
                      <span className="font-medium">{c.name}</span>
                      {c.business_name && <span className="text-muted-foreground text-xs">· {c.business_name}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Ad Name */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Ad Name *</label>
            <input value={form.ad_name} onChange={e => set('ad_name', e.target.value)}
              placeholder="e.g. HMB_199_V300_HalfMoonBay"
              className="w-full bg-secondary/50 border border-border rounded-xl px-3 h-10 text-sm outline-none focus:border-primary/50" />
          </div>

          {/* Format + Due Date */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Format</label>
              <select value={form.format} onChange={e => set('format', e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-xl px-3 h-10 text-sm outline-none focus:border-primary/50">
                {AD_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Due Date</label>
              <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-xl px-3 h-10 text-sm outline-none focus:border-primary/50" />
            </div>
          </div>

          {/* Status + Priority + Assigned */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</label>
              <select value={form.status} onChange={e => set('status', e.target.value as AdProductionStatus)}
                className="w-full bg-secondary/50 border border-border rounded-xl px-3 h-10 text-sm outline-none focus:border-primary/50">
                {Object.entries(STATUS_CONFIG).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Priority</label>
              <select value={form.priority} onChange={e => set('priority', e.target.value as AdProductionPriority)}
                className="w-full bg-secondary/50 border border-border rounded-xl px-3 h-10 text-sm outline-none focus:border-primary/50">
                {Object.entries(PRIORITY_CONFIG).map(([k, c]) => <option key={k} value={k}>{c.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Assigned To</label>
              <select value={form.assigned_to} onChange={e => set('assigned_to', e.target.value)}
                className="w-full bg-secondary/50 border border-border rounded-xl px-3 h-10 text-sm outline-none focus:border-primary/50">
                {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
                <option value="VA">VA</option>
              </select>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</label>
            <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2}
              placeholder="Creative direction, hooks, references..."
              className="w-full bg-secondary/50 border border-border rounded-xl px-3 py-2 text-sm outline-none focus:border-primary/50 resize-none" />
          </div>

          <div className="flex gap-3 pt-1">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button type="submit" disabled={saving} className="flex-1">{saving ? 'Saving...' : 'Save Ad'}</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

type FilterStatus = 'all' | 'incomplete' | AdProductionStatus

export default function AdProductionPage() {
  const { user } = useAuth()
  if (!user) return null
  return <DeliveryPipeline user={user} />
}

function AdminAdProduction() {
  const router = useRouter()
  const [ads, setAds] = useState<AdProduction[]>([])
  const [clients, setClients] = useState<{ id: string; name: string; business_name?: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterStatus>('incomplete')
  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<AdProduction | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const [adsRes, clientsRes] = await Promise.all([
      fetch('/api/ad-productions'),
      fetch('/api/clients'),
    ])
    const [adsData, clientsData] = await Promise.all([adsRes.json(), clientsRes.json()])
    setAds(Array.isArray(adsData) ? adsData : [])
    setClients(Array.isArray(clientsData) ? clientsData : [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = ads.filter(ad => {
    if (filter === 'incomplete') return ad.status !== 'done'
    if (filter !== 'all') return ad.status === filter
    return true
  }).filter(ad => {
    if (!search) return true
    const q = search.toLowerCase()
    return ad.ad_name.toLowerCase().includes(q) || (ad.client?.name ?? '').toLowerCase().includes(q)
  })

  async function updateStatus(id: string, status: AdProductionStatus) {
    await fetch(`/api/ad-productions/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
    })
    setAds(prev => prev.map(a => a.id === id ? { ...a, status } : a))
  }

  async function deleteAd(id: string) {
    await fetch(`/api/ad-productions/${id}`, { method: 'DELETE' })
    setAds(prev => prev.filter(a => a.id !== id))
    toast.success('Deleted')
  }

  async function saveAd(form: AdForm) {
    if (editing) {
      const res = await fetch(`/api/ad-productions/${editing.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const updated = await res.json()
      setAds(prev => prev.map(a => a.id === editing.id ? updated : a))
      toast.success('Updated')
    } else {
      const res = await fetch('/api/ad-productions', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      const created = await res.json()
      setAds(prev => [created, ...prev])
      toast.success('Ad created')
    }
  }

  const counts = {
    incomplete: ads.filter(a => a.status !== 'done').length,
    not_started: ads.filter(a => a.status === 'not_started').length,
    in_progress: ads.filter(a => a.status === 'in_progress').length,
    review: ads.filter(a => a.status === 'review').length,
    done: ads.filter(a => a.status === 'done').length,
  }

  const filterTabs: { key: FilterStatus; label: string; count: number }[] = [
    { key: 'incomplete', label: 'Incomplete', count: counts.incomplete },
    { key: 'not_started', label: 'Not Started', count: counts.not_started },
    { key: 'in_progress', label: 'In Progress', count: counts.in_progress },
    { key: 'review', label: 'In Review', count: counts.review },
    { key: 'done', label: 'Done', count: counts.done },
    { key: 'all', label: 'All', count: ads.length },
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ad Production</h1>
          <p className="text-sm text-muted-foreground mt-1">Track and manage all creative production work</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true) }} className="gap-2">
          <Plus className="w-4 h-4" /> New Ad
        </Button>
      </div>

      {/* Filter tabs + search */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="flex items-center gap-1 bg-secondary/40 border border-border/40 rounded-xl p-1">
          {filterTabs.map(({ key, label, count }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-colors',
                filter === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {label}
              {count > 0 && (
                <span className={cn('ml-1.5 text-[10px]', filter === key ? 'text-primary' : 'text-muted-foreground/60')}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 bg-secondary/40 border border-border/40 rounded-xl px-3 h-9 flex-1 max-w-xs">
          <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search ads or clients..."
            className="bg-transparent text-sm outline-none placeholder:text-muted-foreground flex-1" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Table header */}
        <div className="grid grid-cols-[200px_1fr_130px_140px_120px_100px_80px] gap-0 border-b border-border/60 bg-secondary/20">
          {['Client', 'Ad Name', 'Due Date', 'Status', 'Assigned To', 'Priority', ''].map(h => (
            <div key={h} className="px-4 py-2.5 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-wider">
              {h}
            </div>
          ))}
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-muted-foreground">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <div className="text-2xl">🎬</div>
            <div className="text-sm font-medium">No ads in this view</div>
            <div className="text-xs text-muted-foreground">Create a new ad to get started</div>
          </div>
        ) : (
          <div className="divide-y divide-border/30">
            {filtered.map(ad => {
              const pri = PRIORITY_CONFIG[ad.priority]
              const todayStr = new Date().toISOString().slice(0, 10)
              const isOverdue = ad.due_date && ad.due_date < todayStr && ad.status !== 'done'
              return (
                <div key={ad.id} className="grid grid-cols-[200px_1fr_130px_140px_120px_100px_80px] gap-0 hover:bg-secondary/10 transition-colors group items-center">
                  {/* Client */}
                  <div className="px-4 py-3">
                    <button
                      onClick={() => ad.client && router.push(`/clients/${ad.client.id}`)}
                      className="text-sm font-medium hover:text-primary transition-colors text-left truncate block max-w-full"
                    >
                      {ad.client?.name ?? '—'}
                    </button>
                    {ad.client?.business_name && (
                      <div className="text-xs text-muted-foreground truncate">{ad.client.business_name}</div>
                    )}
                  </div>
                  {/* Ad Name */}
                  <div className="px-4 py-3">
                    <div className="text-sm font-mono text-foreground/90 truncate">{ad.ad_name}</div>
                    {ad.format && <div className="text-[10px] text-muted-foreground/50 mt-0.5">{ad.format}</div>}
                    {ad.notes && <div className="text-xs text-muted-foreground/60 truncate mt-0.5 italic">{ad.notes}</div>}
                  </div>
                  {/* Due Date */}
                  <div className="px-4 py-3">
                    <span className={cn('text-sm', isOverdue ? 'text-red-400 font-medium' : 'text-foreground/80')}>
                      {ad.due_date ? formatDate(ad.due_date) : '—'}
                    </span>
                    {isOverdue && <div className="text-[10px] text-red-400/70">Overdue</div>}
                  </div>
                  {/* Status */}
                  <div className="px-4 py-3">
                    <StatusBadge status={ad.status} onChange={s => updateStatus(ad.id, s)} />
                  </div>
                  {/* Assigned */}
                  <div className="px-4 py-3 text-sm text-foreground/80">{ad.assigned_to ?? '—'}</div>
                  {/* Priority */}
                  <div className="px-4 py-3">
                    <span className={cn('text-xs font-semibold', pri.color)}>{pri.label}</span>
                  </div>
                  {/* Actions */}
                  <div className="px-4 py-3 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditing(ad); setFormOpen(true) }}
                      className="p-1.5 rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteAd(ad.id)}
                      className="p-1.5 rounded hover:bg-secondary/60 text-muted-foreground hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      <AdFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        onSave={saveAd}
        initial={editing ? {
          client_id: editing.client_id,
          ad_name: editing.ad_name,
          format: editing.format ?? 'V300',
          due_date: editing.due_date ?? '',
          status: editing.status,
          assigned_to: editing.assigned_to ?? 'Thatcher',
          priority: editing.priority,
          notes: editing.notes ?? '',
        } : undefined}
        clients={clients}
      />
    </div>
  )
}
