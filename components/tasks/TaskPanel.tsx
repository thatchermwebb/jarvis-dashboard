'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Plus, Send, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { cn, priorityColor, taskStatusColor } from '@/lib/utils'
import type { Task, TaskType, TaskPriority, TaskStatus } from '@/types'

const TASK_TYPES: { value: TaskType; label: string }[] = [
  { value: 'build_ads', label: 'Build Ads' },
  { value: 'upload_creatives', label: 'Upload Creatives' },
  { value: 'fix_ai', label: 'Fix AI Chatbot' },
  { value: 'fix_crm', label: 'Fix CRM' },
  { value: 'check_leads', label: 'Check Lead Routing' },
  { value: 'change_location', label: 'Change Ad Location' },
  { value: 'pause_campaign', label: 'Pause Campaign' },
  { value: 'launch_campaign', label: 'Launch Campaign' },
  { value: 'add_hooks', label: 'Add New Hooks' },
  { value: 'check_rejected_ad', label: 'Check Rejected Ad' },
  { value: 'add_drive_assets', label: 'Add Drive Assets' },
  { value: 'verify_calendar', label: 'Verify Calendar' },
  { value: 'check_payment', label: 'Check Payment Setup' },
]

interface Props {
  clientId: string
}

interface TaskFormState {
  task_type: TaskType
  priority: TaskPriority
  assigned_va: string
  due_date: string
  notes: string
}

export function TaskPanel({ clientId }: Props) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<TaskFormState>({
    task_type: 'build_ads',
    priority: 'medium',
    assigned_va: '',
    due_date: '',
    notes: '',
  })

  const load = useCallback(async () => {
    const res = await fetch(`/api/tasks?client_id=${clientId}`)
    const data = await res.json()
    setTasks(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [clientId])

  useEffect(() => { load() }, [load])

  async function createTask(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, client_id: clientId }),
      })
      if (!res.ok) throw new Error()
      toast.success('Task created')
      setCreateOpen(false)
      setForm({ task_type: 'build_ads', priority: 'medium', assigned_va: '', due_date: '', notes: '' })
      load()
    } catch {
      toast.error('Failed to create task')
    } finally {
      setSaving(false)
    }
  }

  async function updateStatus(taskId: string, status: TaskStatus) {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status } : t))
      toast.success('Task updated')
    } catch {
      toast.error('Failed to update task')
    }
  }

  function sendToSlack(task: Task) {
    const typeLabel = TASK_TYPES.find((t) => t.value === task.task_type)?.label ?? task.task_type
    const msg = `📋 *VA Task*\n*Client:* ${(task.client as { name?: string })?.name ?? 'Unknown'}\n*Type:* ${typeLabel}\n*Priority:* ${task.priority}\n${task.notes ? `*Notes:* ${task.notes}` : ''}`
    navigator.clipboard.writeText(msg)
    toast.success('Slack message copied to clipboard!')
  }

  return (
    <>
      <div className="space-y-2">
        <div className="flex justify-between items-center">
          <span className="text-xs text-muted-foreground">{tasks.filter((t) => t.status !== 'done').length} open tasks</span>
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setCreateOpen(true)}>
            <Plus className="w-3 h-3" /> Create Task
          </Button>
        </div>

        {loading ? (
          <div className="h-20 bg-card border border-border rounded-xl animate-pulse" />
        ) : tasks.length === 0 ? (
          <div className="bg-card border border-border rounded-xl p-6 text-center text-xs text-muted-foreground">
            No VA tasks yet. Create one to assign work.
          </div>
        ) : (
          tasks.map((task) => {
            const typeLabel = TASK_TYPES.find((t) => t.value === task.task_type)?.label ?? task.task_type
            return (
              <div key={task.id} className={cn('bg-card border border-border rounded-xl px-4 py-3', task.status === 'done' && 'opacity-50')}>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground">{typeLabel}</span>
                      <Badge variant="outline" className={cn('text-[10px]', priorityColor(task.priority))}>
                        {task.priority}
                      </Badge>
                      <Badge variant="outline" className={cn('text-[10px]', taskStatusColor(task.status))}>
                        {task.status?.replace('_', ' ')}
                      </Badge>
                    </div>
                    {task.assigned_va && (
                      <div className="text-xs text-muted-foreground mt-0.5">Assigned to: {task.assigned_va}</div>
                    )}
                    {task.notes && <div className="text-xs text-muted-foreground mt-1">{task.notes}</div>}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-400"
                      title="Copy to Slack"
                      onClick={() => sendToSlack(task)}
                    >
                      <Send className="w-3 h-3" />
                    </Button>
                    {task.status !== 'done' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-400"
                        title="Mark done"
                        onClick={() => updateStatus(task.id, 'done')}
                      >
                        <CheckCircle className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle>Create VA Task</DialogTitle>
          </DialogHeader>
          <form onSubmit={createTask} className="space-y-3 mt-2">
            <div className="space-y-1.5">
              <Label>Task Type</Label>
              <Select value={form.task_type} onValueChange={(v) => v && setForm((f) => ({ ...f, task_type: v as TaskType }))}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v) => v && setForm((f) => ({ ...f, priority: v as TaskPriority }))}>
                  <SelectTrigger className="bg-secondary/50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="urgent">Urgent</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="low">Low</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={form.due_date} onChange={(e) => setForm((f) => ({ ...f, due_date: e.target.value }))} className="bg-secondary/50" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Assign to VA</Label>
              <Input value={form.assigned_va} onChange={(e) => setForm((f) => ({ ...f, assigned_va: e.target.value }))} placeholder="VA name" className="bg-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Context, instructions, links..." className="bg-secondary/50 h-20" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={saving}>{saving ? 'Creating...' : 'Create Task'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
