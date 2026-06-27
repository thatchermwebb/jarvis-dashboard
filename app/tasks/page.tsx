'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, CheckCircle2, Circle, Trash2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { cn, localToday, daysUntil, formatDate } from '@/lib/utils'
import type { Task, TaskPriority, TaskStatus } from '@/types'

const ASSIGNEES = ['Diego', 'Thatcher', 'Trepp']
const PRIORITIES: { value: TaskPriority; label: string; color: string }[] = [
  { value: 'urgent', label: 'Urgent', color: 'text-red-400' },
  { value: 'high',   label: 'High',   color: 'text-orange-400' },
  { value: 'medium', label: 'Medium', color: 'text-yellow-400' },
  { value: 'low',    label: 'Low',    color: 'text-slate-400' },
]

function priorityDot(p?: TaskPriority) {
  if (p === 'urgent') return 'bg-red-400'
  if (p === 'high')   return 'bg-orange-400'
  if (p === 'medium') return 'bg-yellow-400'
  return 'bg-slate-500'
}

function dueDateChip(dateStr?: string) {
  if (!dateStr) return null
  const today = localToday()
  const diff = daysUntil(dateStr)
  if (dateStr < today) return <span className="text-[11px] bg-red-500/15 text-red-400 border border-red-500/20 px-2 py-0.5 rounded-full">Overdue · {dateStr}</span>
  if (dateStr === today) return <span className="text-[11px] bg-amber-500/15 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded-full">Due today</span>
  if (diff === 1) return <span className="text-[11px] bg-blue-500/15 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-full">Due tomorrow</span>
  return <span className="text-[11px] bg-secondary/60 text-muted-foreground border border-border/40 px-2 py-0.5 rounded-full">Due {formatDate(dateStr)}</span>
}

interface TaskFormState {
  title: string
  client_search: string
  client_id: string
  client_name: string
  assigned_to: string
  due_date: string
  priority: TaskPriority
  notes: string
}

interface ClientOption { id: string; name: string; business_name?: string }

export default function TasksPage() {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [filterAssignee, setFilterAssignee] = useState('all')
  const [filterStatus, setFilterStatus] = useState<'open' | 'done' | 'all'>('open')
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [clients, setClients] = useState<ClientOption[]>([])
  const [clientSearch, setClientSearch] = useState('')
  const [showClientDrop, setShowClientDrop] = useState(false)
  const [form, setForm] = useState<TaskFormState>({
    title: '', client_search: '', client_id: '', client_name: '',
    assigned_to: 'Diego', due_date: '', priority: 'medium', notes: '',
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
      fetch('/api/clients').then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : []))
    }
  }, [createOpen])

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.business_name ?? '').toLowerCase().includes(clientSearch.toLowerCase())
  ).slice(0, 8)

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
    if (!form.title.trim()) return toast.error('Task title is required')
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
          priority: form.priority,
          notes: form.notes || null,
          status: 'open',
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Task created')
      setCreateOpen(false)
      setForm({ title: '', client_search: '', client_id: '', client_name: '', assigned_to: 'Diego', due_date: '', priority: 'medium', notes: '' })
      setClientSearch('')
      load()
    } catch {
      toast.error('Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  const today = localToday()
  const overdue = displayTasks.filter(t => t.due_date && t.due_date < today && t.status !== 'done').length
  const dueToday = displayTasks.filter(t => t.due_date === today && t.status !== 'done').length
  const open = displayTasks.filter(t => t.status !== 'done').length

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tasks</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {open} open · {dueToday > 0 && <span className="text-amber-400">{dueToday} due today</span>}{dueToday > 0 && overdue > 0 && ' · '}{overdue > 0 && <span className="text-red-400">{overdue} overdue</span>}
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
              className={cn('px-3 py-1.5 rounded text-xs font-medium transition-colors capitalize',
                filterStatus === s ? 'bg-background text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {s === 'open' ? 'Not Done' : s === 'done' ? 'Completed' : 'All'}
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
                {/* Checkbox */}
                <button
                  onClick={() => toggleDone(task)}
                  className={cn('mt-0.5 flex-shrink-0 transition-colors', done ? 'text-emerald-400' : 'text-muted-foreground/40 hover:text-muted-foreground')}
                >
                  {done ? <CheckCircle2 className="w-5 h-5" /> : <Circle className="w-5 h-5" />}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className={cn('text-sm font-medium', done && 'line-through text-muted-foreground')}>{label}</span>
                    <span className={cn('w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0', priorityDot(task.priority))} />
                  </div>
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

                {/* Delete */}
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

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>New Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4 mt-1">
            <div className="space-y-1.5">
              <Label>What needs to be done <span className="text-primary">*</span></Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Task description..."
                className="bg-secondary/50"
                autoFocus
              />
            </div>

            {/* Client */}
            <div className="space-y-1.5 relative">
              <Label>For which client <span className="text-muted-foreground/50 text-xs font-normal">(optional)</span></Label>
              {form.client_id ? (
                <div className="flex items-center gap-2 bg-secondary/50 rounded-md px-3 py-2 text-sm">
                  <span className="flex-1">{form.client_name}</span>
                  <button type="button" onClick={() => setForm(f => ({ ...f, client_id: '', client_name: '' }))} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    value={clientSearch}
                    onChange={e => { setClientSearch(e.target.value); setShowClientDrop(true) }}
                    onFocus={() => setShowClientDrop(true)}
                    placeholder="Search clients..."
                    className="bg-secondary/50"
                  />
                  {showClientDrop && clientSearch && filteredClients.length > 0 && (
                    <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-lg shadow-lg overflow-hidden">
                      {filteredClients.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setForm(f => ({ ...f, client_id: c.id, client_name: c.name })); setClientSearch(''); setShowClientDrop(false) }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-secondary/50 transition-colors"
                        >
                          {c.name}{c.business_name && <span className="text-muted-foreground text-xs ml-2">{c.business_name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Assigned to</Label>
                <Select value={form.assigned_to} onValueChange={v => v && setForm(f => ({ ...f, assigned_to: v }))}>
                  <SelectTrigger className="bg-secondary/50">
                    <span>{form.assigned_to}</span>
                  </SelectTrigger>
                  <SelectContent>
                    {ASSIGNEES.map(a => <SelectItem key={a} value={a}>{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due date</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="bg-secondary/50" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <div className="flex gap-2">
                {PRIORITIES.map(p => (
                  <button
                    key={p.value}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, priority: p.value }))}
                    className={cn(
                      'flex-1 py-1.5 rounded-md text-xs font-medium border transition-colors',
                      form.priority === p.value
                        ? 'border-current bg-current/10 ' + p.color
                        : 'border-border/40 text-muted-foreground hover:text-foreground'
                    )}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes <span className="text-muted-foreground/50 text-xs font-normal">(optional)</span></Label>
              <Input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any extra context..." className="bg-secondary/50" />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Task'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
