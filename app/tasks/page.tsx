'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, CheckCircle2, Circle, Trash2, ExternalLink, Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { InlineCalendar } from '@/components/ui/inline-calendar'
import { TimePicker } from '@/components/ui/time-picker'
import { toast } from 'sonner'
import { cn, localToday, daysUntil, formatDate } from '@/lib/utils'
import type { Task, TaskStatus } from '@/types'

const ASSIGNEES = ['Diego', 'Thatcher', 'Trepp']
const ASSIGNEE_META: Record<string, { initials: string; color: string; ring: string }> = {
  Diego:    { initials: 'DC', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', ring: 'border-emerald-500/40' },
  Thatcher: { initials: 'TW', color: 'bg-blue-500/20 text-blue-300 border-blue-500/40',         ring: 'border-blue-500/40' },
  Trepp:    { initials: 'TG', color: 'bg-violet-500/20 text-violet-300 border-violet-500/40',   ring: 'border-violet-500/40' },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dueDateChip(dateStr?: string) {
  if (!dateStr) return null
  const today = localToday()
  const diff = daysUntil(dateStr)
  if (dateStr < today) return <span className="text-[11px] bg-red-500/15 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">Overdue · {dateStr}</span>
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

// ─── Form State ───────────────────────────────────────────────────────────────

interface TaskFormState {
  title: string
  client_id: string
  client_name: string
  assigned_to: string
  due_date: string
  due_time: string
  notes: string
}

interface ClientOption { id: string; name: string; business_name?: string; stage?: string }

function stageDot(stage?: string): string {
  if (stage === 'active_client' || stage === 'won_back') return 'bg-emerald-400'
  if (stage === 'free_trial' || stage === 'trial_ending_soon') return 'bg-violet-400'
  if (stage === 'free_trial_pending') return 'bg-amber-400'
  if (stage === 'overdue' || stage === 'churn_risk' || stage === 'payment_issue') return 'bg-red-400'
  return 'bg-muted-foreground/40'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [filterStatus, setFilterStatus] = useState<'open' | 'done' | 'all'>('open')
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  // client search
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDrop, setShowClientDrop] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<TaskFormState>({
    title: '', client_id: '', client_name: '',
    assigned_to: 'Diego', due_date: '', due_time: '', notes: '',
  })

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
    if (createOpen) {
      setForm(f => ({ ...f, assigned_to: getActiveUser() }))
      fetch('/api/clients').then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : []))
    } else {
      setForm({ title: '', client_id: '', client_name: '', assigned_to: 'Diego', due_date: '', due_time: '', notes: '' })
      setClientSearch('')
    }
  }, [createOpen])

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.business_name ?? '').toLowerCase().includes(clientSearch.toLowerCase())
  ).slice(0, 10)

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

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Description is required')
    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: form.title,
          client_id: form.client_id || null,
          assigned_to: form.assigned_to,
          due_date: form.due_date || null,
          due_time: form.due_time || null,
          notes: form.notes || null,
          status: 'open',
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Task created')
      setCreateOpen(false)
      load()
    } catch {
      toast.error('Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  const today = localToday()
  const overdue  = displayTasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length
  const dueToday = displayTasks.filter(t => t.due_date === today && t.status !== 'done').length
  const open     = displayTasks.filter(t => t.status !== 'done').length

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
        <Button onClick={() => setCreateOpen(true)} className="h-9 px-4 text-sm font-medium">
          <Plus className="w-4 h-4 mr-1.5" /> New Task
        </Button>
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
        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="h-8 text-xs w-36 bg-secondary/40 border-border/40">
            <span className="text-muted-foreground">{filterAssignee === 'all' ? 'All assignees' : filterAssignee}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All assignees</SelectItem>
            {ASSIGNEES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Task list */}
      {loading ? (
        [...Array(5)].map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />)
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
            return (
              <div
                key={task.id}
                className={cn(
                  'bg-card border border-border/60 rounded-xl px-4 py-3 flex items-start gap-3 transition-opacity',
                  done && 'opacity-40'
                )}
              >
                <button
                  onClick={() => toggleDone(task)}
                  className={cn('mt-0.5 flex-shrink-0 transition-colors', done ? 'text-emerald-400' : 'text-muted-foreground/40 hover:text-muted-foreground')}
                >
                  {done ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                </button>
                <div className="flex-1 min-w-0">
                  <span className={cn('text-sm font-medium', done && 'line-through text-muted-foreground')}>{label}</span>
                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    {clientName && (
                      <button
                        onClick={() => router.push(`/clients/${task.client_id}`)}
                        className="text-[11px] text-primary/70 hover:text-primary flex items-center gap-1 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" /> {clientName}
                      </button>
                    )}
                    {task.assigned_to && (
                      <span className="text-[11px] text-muted-foreground bg-secondary/60 px-2 py-0.5 rounded-full">{task.assigned_to}</span>
                    )}
                    {dueDateChip(task.due_date)}
                    {task.notes && (
                      <span className="text-[11px] text-muted-foreground/60 truncate max-w-[200px]">{task.notes}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => deleteTask(task.id)}
                  className="flex-shrink-0 text-muted-foreground/30 hover:text-red-400 transition-colors mt-0.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="w-[90vw] max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border p-0">
          <DialogHeader className="px-7 pt-6 pb-4 border-b border-border/40">
            <DialogTitle className="text-xl">New Task</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreate} className="p-7 space-y-6">
            {/* Description */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Description <span className="text-primary">*</span></Label>
              <Textarea
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="What needs to be done?"
                className="bg-secondary/50 min-h-[80px] text-sm resize-none"
                autoFocus
              />
            </div>

            {/* Client */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Client <span className="text-muted-foreground/50 font-normal text-xs">(optional)</span>
              </Label>
              {form.client_id ? (
                <div className="flex items-center gap-2 bg-secondary/50 border border-border rounded-xl px-4 py-3 text-sm">
                  <span className="flex-1 font-medium">{form.client_name}</span>
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, client_id: '', client_name: '' }))}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <div
                    className={cn('flex items-center gap-2 bg-secondary/50 border border-border rounded-xl px-4 h-12 cursor-text', showClientDrop && 'border-primary/50')}
                    onClick={() => { setShowClientDrop(true); setTimeout(() => searchRef.current?.focus(), 50) }}
                  >
                    <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <input
                      ref={searchRef}
                      value={clientSearch}
                      onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true) }}
                      onFocus={() => setShowClientDrop(true)}
                      onBlur={() => setTimeout(() => setShowClientDrop(false), 150)}
                      placeholder="Search clients..."
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                  {showClientDrop && filteredClients.length > 0 && (
                    <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                      {filteredClients.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full text-left px-4 py-2.5 hover:bg-secondary/60 transition-colors flex items-center gap-2"
                          onMouseDown={() => { setForm(f => ({ ...f, client_id: c.id, client_name: c.name })); setClientSearch(''); setShowClientDrop(false) }}
                        >
                          <span className={cn('w-2 h-2 rounded-full flex-shrink-0', stageDot(c.stage))} />
                          <span className="text-sm font-medium">{c.name}</span>
                          {c.business_name && <span className="text-xs text-muted-foreground ml-auto">{c.business_name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Assigned To */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">Assigned to</Label>
              <div className="flex gap-2">
                {ASSIGNEES.map(a => {
                  const meta = ASSIGNEE_META[a]
                  const active = form.assigned_to === a
                  return (
                    <button
                      key={a}
                      type="button"
                      onClick={() => setForm(f => ({ ...f, assigned_to: a }))}
                      className={cn(
                        'flex-1 flex items-center gap-2.5 px-3 py-3 rounded-xl border text-sm font-medium transition-all',
                        active ? meta.color : 'border-border/40 text-muted-foreground hover:text-foreground hover:border-border'
                      )}
                    >
                      <span className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold border flex-shrink-0',
                        active ? meta.color : 'border-border/40 text-muted-foreground/50'
                      )}>
                        {meta.initials}
                      </span>
                      {a}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Due Date */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Due date <span className="text-muted-foreground/50 font-normal text-xs">(optional)</span>
              </Label>
              <InlineCalendar
                size="lg"
                value={form.due_date}
                onChange={v => setForm(f => ({ ...f, due_date: v, due_time: v ? f.due_time : '' }))}
              />
              {form.due_date && (
                <div className="space-y-1.5 pt-1">
                  <Label className="text-xs text-muted-foreground">Time (optional)</Label>
                  <TimePicker
                    value={form.due_time}
                    onChange={v => setForm(f => ({ ...f, due_time: v }))}
                  />
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Notes <span className="text-muted-foreground/50 font-normal text-xs">(optional)</span>
              </Label>
              <Textarea
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                placeholder="Any extra context..."
                className="bg-secondary/50 text-sm resize-none min-h-[70px]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-border/40">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving} className="px-8">{saving ? 'Creating...' : 'Create Task'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
