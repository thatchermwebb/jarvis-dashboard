'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, CheckCircle2, Circle, Trash2, ExternalLink, Search, X, Calendar, Clock } from 'lucide-react'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { InlineCalendar } from '@/components/ui/inline-calendar'
import { TimePicker } from '@/components/ui/time-picker'
import { toast } from 'sonner'
import { cn, localToday, daysUntil, formatDate, formatTime } from '@/lib/utils'
import type { Task, TaskStatus } from '@/types'

const ASSIGNEES = ['Diego', 'Thatcher', 'Trepp']
const ASSIGNEE_META: Record<string, { initials: string; color: string; activeColor: string }> = {
  Diego:    { initials: 'DC', color: 'border-border/40 text-muted-foreground/60 hover:border-emerald-500/40 hover:text-emerald-300', activeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
  Thatcher: { initials: 'TW', color: 'border-border/40 text-muted-foreground/60 hover:border-blue-500/40 hover:text-blue-300',    activeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/40'         },
  Trepp:    { initials: 'TG', color: 'border-border/40 text-muted-foreground/60 hover:border-violet-500/40 hover:text-violet-300', activeColor: 'bg-violet-500/20 text-violet-300 border-violet-500/40'   },
}

interface ClientOption { id: string; name: string; business_name?: string; stage?: string }
interface TaskFormState {
  title: string; client_id: string; client_name: string
  assigned_to: string; due_date: string; due_time: string; notes: string
}

function stageDot(stage?: string) {
  if (stage === 'active_client' || stage === 'won_back') return 'bg-emerald-400'
  if (stage === 'free_trial' || stage === 'trial_ending_soon') return 'bg-violet-400'
  if (stage === 'free_trial_pending') return 'bg-amber-400'
  if (stage === 'overdue' || stage === 'churn_risk' || stage === 'payment_issue') return 'bg-red-400'
  return 'bg-muted-foreground/40'
}

function dueDateChip(dateStr?: string) {
  if (!dateStr) return null
  const today = localToday()
  const diff = daysUntil(dateStr)
  if (dateStr < today) return <span className="text-[11px] bg-red-500/15 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">Overdue · {formatDate(dateStr)}</span>
  if (dateStr === today) return <span className="text-[11px] bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">Due today</span>
  if (diff === 1) return <span className="text-[11px] bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">Due tomorrow</span>
  return <span className="text-[11px] bg-secondary/60 text-muted-foreground border border-border/40 px-2 py-0.5 rounded-full">Due {formatDate(dateStr)}</span>
}

function getActiveUser(): string {
  try {
    const cookie = document.cookie.split(';').find(c => c.trim().startsWith('cza_user='))
    const id = cookie?.split('=')[1]?.trim()
    if (id === 'thatcher') return 'Thatcher'
    if (id === 'trepp') return 'Trepp'
  } catch {}
  return 'Diego'
}

// ─── Inline date picker popover ───────────────────────────────────────────────

function DatePopover({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const today = localToday()
  const isOverdue = value && value < today
  const isToday = value === today

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors',
          value
            ? isOverdue ? 'border-red-500/30 text-red-400 bg-red-500/10'
            : isToday  ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
            : 'border-border/50 text-foreground/70 bg-secondary/40'
            : 'border-border/40 text-muted-foreground/60 hover:text-foreground hover:border-border'
        )}
      >
        <Calendar className="w-3 h-3" />
        {value ? formatDate(value) : 'Due date'}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-card border border-border rounded-xl shadow-2xl p-1">
          <InlineCalendar value={value} onChange={v => { onChange(v); if (v) {} }} size="sm" />
          {value && (
            <div className="px-3 pb-3 pt-1">
              <TimePicker value={''} onChange={() => {}} placeholder="Add time (optional)" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function DateTimePopover({ date, time, onDate, onTime }: { date: string; time: string; onDate: (v: string) => void; onTime: (v: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const today = localToday()
  const isOverdue = date && date < today
  const isToday = date === today

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs transition-colors',
          date
            ? isOverdue ? 'border-red-500/30 text-red-400 bg-red-500/10'
            : isToday  ? 'border-amber-500/30 text-amber-400 bg-amber-500/10'
            : 'border-border/50 text-foreground/70 bg-secondary/40'
            : 'border-border/40 text-muted-foreground/60 hover:text-foreground hover:border-border'
        )}
      >
        <Calendar className="w-3 h-3" />
        {date ? formatDate(date) : 'Due date'}
        {time && <><Clock className="w-3 h-3 ml-1" />{formatTime(time)}</>}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden" style={{ width: 240 }}>
          <div className="p-2">
            <InlineCalendar value={date} onChange={onDate} size="sm" />
          </div>
          {date && (
            <div className="px-3 pb-3 border-t border-border/30 pt-2">
              <TimePicker value={time} onChange={onTime} placeholder="Add time (optional)" />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Client picker ────────────────────────────────────────────────────────────

function ClientPicker({ clientId, clientName, clients, onSelect }: {
  clientId: string; clientName: string; clients: ClientOption[]
  onSelect: (id: string, name: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!open) return
    function h(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 30) }, [open])

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.business_name ?? '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 8)

  if (clientId) {
    return (
      <button
        type="button"
        onClick={() => onSelect('', '')}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-primary/30 text-xs text-primary/80 bg-primary/10 hover:bg-primary/5 transition-colors"
      >
        {clientName} <X className="w-3 h-3" />
      </button>
    )
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/40 text-xs text-muted-foreground/60 hover:text-foreground hover:border-border transition-colors"
      >
        <Search className="w-3 h-3" /> Client
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1.5 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden" style={{ width: 240 }}>
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
            <Search className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
            <input
              ref={inputRef}
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="text-xs text-muted-foreground text-center py-4">No clients found</div>
            ) : filtered.map(c => (
              <button
                key={c.id}
                type="button"
                onMouseDown={() => { onSelect(c.id, c.name); setOpen(false); setSearch('') }}
                className="w-full text-left px-3 py-2 hover:bg-secondary/60 transition-colors flex items-center gap-2"
              >
                <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', stageDot(c.stage))} />
                <span className="text-xs font-medium">{c.name}</span>
                {c.business_name && <span className="text-[10px] text-muted-foreground ml-auto truncate max-w-[80px]">{c.business_name}</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Inline new task row ──────────────────────────────────────────────────────

function InlineNewTask({ clients, onSave, onCancel }: {
  clients: ClientOption[]
  onSave: (form: TaskFormState) => Promise<void>
  onCancel: () => void
}) {
  const [form, setForm] = useState<TaskFormState>({
    title: '', client_id: '', client_name: '',
    assigned_to: getActiveUser(), due_date: '', due_time: '', notes: '',
  })
  const [saving, setSaving] = useState(false)
  const titleRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setTimeout(() => titleRef.current?.focus(), 30) }, [])

  function set<K extends keyof TaskFormState>(k: K, v: TaskFormState[K]) {
    setForm(f => ({ ...f, [k]: v }))
  }

  async function save() {
    if (!form.title.trim()) { titleRef.current?.focus(); return }
    setSaving(true)
    await onSave(form)
    setSaving(false)
  }

  return (
    <div className="bg-card border border-primary/30 rounded-xl px-4 py-3 space-y-3 shadow-sm">
      {/* Description */}
      <div className="flex items-start gap-3">
        <Circle className="w-5 h-5 text-muted-foreground/20 flex-shrink-0 mt-1" />
        <textarea
          ref={titleRef}
          value={form.title}
          onChange={e => { set('title', e.target.value); e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px' }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); save() } if (e.key === 'Escape') onCancel() }}
          placeholder="Task description..."
          rows={1}
          className="flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-muted-foreground/40 resize-none overflow-hidden leading-relaxed"
        />
        <button type="button" onClick={onCancel} className="text-muted-foreground/40 hover:text-muted-foreground transition-colors mt-0.5">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Fields row */}
      <div className="flex items-center gap-2 flex-wrap pl-8">
        {/* Assignee */}
        <div className="flex gap-1">
          {ASSIGNEES.map(a => {
            const meta = ASSIGNEE_META[a]
            const active = form.assigned_to === a
            return (
              <button
                key={a}
                type="button"
                onClick={() => set('assigned_to', a)}
                title={a}
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all',
                  active ? meta.activeColor : meta.color
                )}
              >
                {meta.initials}
              </button>
            )
          })}
        </div>

        <span className="text-border/60">·</span>

        {/* Client */}
        <ClientPicker
          clientId={form.client_id}
          clientName={form.client_name}
          clients={clients}
          onSelect={(id, name) => setForm(f => ({ ...f, client_id: id, client_name: name }))}
        />

        <span className="text-border/60">·</span>

        {/* Due date + time */}
        <DateTimePopover
          date={form.due_date}
          time={form.due_time}
          onDate={v => set('due_date', v)}
          onTime={v => set('due_time', v)}
        />
      </div>

      {/* Notes */}
      <div className="pl-8">
        <input
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Notes (optional)"
          className="w-full bg-transparent text-xs text-muted-foreground outline-none placeholder:text-muted-foreground/30"
        />
      </div>

      {/* Actions */}
      <div className="pl-8 flex items-center gap-2">
        <button
          type="button"
          onClick={save}
          disabled={saving || !form.title.trim()}
          className="text-xs bg-primary text-primary-foreground px-3 py-1.5 rounded-lg font-medium disabled:opacity-40 hover:bg-primary/90 transition-colors"
        >
          {saving ? 'Adding...' : 'Add task'}
        </button>
        <button type="button" onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [filterStatus, setFilterStatus] = useState<'open' | 'done' | 'all'>('open')
  const [creating, setCreating] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filterAssignee !== 'all') params.set('assigned_to', filterAssignee)
    const res = await fetch(`/api/tasks?${params}`)
    const data = await res.json()
    setTasks(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [filterAssignee])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    fetch('/api/clients').then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : []))
  }, [])

  const displayTasks = filterStatus === 'all'
    ? tasks
    : filterStatus === 'open'
    ? tasks.filter(t => t.status !== 'done')
    : tasks.filter(t => t.status === 'done')

  async function toggleDone(task: Task) {
    const newStatus: TaskStatus = task.status === 'done' ? 'open' : 'done'
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  async function deleteTask(id: string) {
    if (!confirm('Delete this task?')) return
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(prev => prev.filter(t => t.id !== id))
    toast.success('Task deleted')
  }

  async function handleCreate(form: TaskFormState) {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:       form.title,
          client_id:   form.client_id   || null,
          assigned_to: form.assigned_to || null,
          due_date:    form.due_date    || null,
          due_time:    form.due_time    || null,
          notes:       form.notes       || null,
          status:      'open',
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Failed to create task'); return }
      toast.success('Task added')
      setCreating(false)
      load()
    } catch {
      toast.error('Failed to create task')
    }
  }

  const today = localToday()
  const overdue  = tasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length
  const dueToday = tasks.filter(t => t.due_date === today && t.status !== 'done').length
  const open     = tasks.filter(t => t.status !== 'done').length

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {open} open
            {dueToday > 0 && <> · <span className="text-amber-400">{dueToday} due today</span></>}
            {overdue  > 0 && <> · <span className="text-red-400">{overdue} overdue</span></>}
          </p>
        </div>
        {!creating && (
          <button
            onClick={() => setCreating(true)}
            className="flex items-center gap-1.5 h-9 px-4 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Task
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex bg-secondary/40 border border-border/40 rounded-lg p-0.5 gap-0.5">
          {(['open', 'all', 'done'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn('px-3 py-1.5 rounded text-xs font-medium transition-colors',
                filterStatus === s ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {s === 'open' ? 'Incomplete' : s === 'done' ? 'Completed' : 'All'}
            </button>
          ))}
        </div>
        <Select value={filterAssignee} onValueChange={(v) => setFilterAssignee(v ?? 'all')}>
          <SelectTrigger className="h-8 text-xs w-36 bg-secondary/40 border-border/40">
            <span className="text-muted-foreground">{filterAssignee === 'all' ? 'All assignees' : filterAssignee}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            {ASSIGNEES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Inline new task */}
      {creating && (
        <InlineNewTask
          clients={clients}
          onSave={handleCreate}
          onCancel={() => setCreating(false)}
        />
      )}

      {/* Task list */}
      {loading ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />)}
        </div>
      ) : displayTasks.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-14 text-center space-y-2">
          <div className="text-3xl">✅</div>
          <div className="text-sm font-semibold">All clear!</div>
          <div className="text-sm text-muted-foreground">No tasks here.</div>
        </div>
      ) : (
        <div className="space-y-2">
          {displayTasks.map(task => {
            const done = task.status === 'done'
            const label = task.title || task.task_type?.replace(/_/g, ' ') || 'Task'
            const clientName = (task.client as { name?: string } | null)?.name
            const assigneeMeta = task.assigned_to ? ASSIGNEE_META[task.assigned_to] : null
            return (
              <div
                key={task.id}
                className={cn(
                  'bg-card border border-border/60 rounded-xl px-4 py-3 flex items-start gap-3 group transition-opacity',
                  done && 'opacity-40'
                )}
              >
                <button
                  onClick={() => toggleDone(task)}
                  className={cn('mt-0.5 flex-shrink-0 transition-colors', done ? 'text-emerald-400' : 'text-muted-foreground/30 hover:text-muted-foreground')}
                >
                  {done ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={cn('text-sm font-medium', done && 'line-through text-muted-foreground')}>{label}</span>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {clientName && (
                      <button
                        onClick={() => router.push(`/clients/${task.client_id}`)}
                        className="text-[11px] text-primary/70 hover:text-primary flex items-center gap-1 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> {clientName}
                      </button>
                    )}
                    {assigneeMeta && (
                      <span className={cn('w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold border', assigneeMeta.activeColor)} title={task.assigned_to}>
                        {assigneeMeta.initials}
                      </span>
                    )}
                    {dueDateChip(task.due_date)}
                    {task.due_time && <span className="text-[11px] text-muted-foreground/60 flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(task.due_time)}</span>}
                    {task.notes && (
                      <span className="text-[11px] text-muted-foreground/50 truncate max-w-[200px]">{task.notes}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="flex-shrink-0 text-muted-foreground/20 hover:text-red-400 transition-colors mt-0.5 opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
