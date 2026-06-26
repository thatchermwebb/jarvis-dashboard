'use client'

import { useState, useEffect, useCallback } from 'react'
import { toast } from 'sonner'
import { Send, CheckCircle, Filter } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn, priorityColor, taskStatusColor } from '@/lib/utils'
import type { Task, TaskStatus } from '@/types'

const TASK_TYPE_LABELS: Record<string, string> = {
  build_ads: 'Build Ads',
  upload_creatives: 'Upload Creatives',
  fix_ai: 'Fix AI Chatbot',
  fix_crm: 'Fix CRM',
  check_leads: 'Check Lead Routing',
  change_location: 'Change Ad Location',
  pause_campaign: 'Pause Campaign',
  launch_campaign: 'Launch Campaign',
  add_hooks: 'Add New Hooks',
  check_rejected_ad: 'Check Rejected Ad',
  add_drive_assets: 'Add Drive Assets',
  verify_calendar: 'Verify Calendar',
  check_payment: 'Check Payment Setup',
}

export default function VATasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('open')

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (statusFilter !== 'all') params.set('status', statusFilter)
    const res = await fetch(`/api/tasks?${params}`)
    const data = await res.json()
    setTasks(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [statusFilter])

  useEffect(() => { load() }, [load])

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
      toast.error('Failed')
    }
  }

  function copyToSlack(task: Task) {
    const typeLabel = TASK_TYPE_LABELS[task.task_type ?? ''] ?? task.task_type
    const clientName = (task.client as { name?: string })?.name ?? 'Unknown'
    const msg = `📋 *VA Task*\n*Client:* ${clientName}\n*Type:* ${typeLabel}\n*Priority:* ${task.priority?.toUpperCase()}\n${task.due_date ? `*Due:* ${task.due_date}\n` : ''}${task.notes ? `*Notes:* ${task.notes}` : ''}`
    navigator.clipboard.writeText(msg)
    toast.success('Copied to clipboard — paste in Slack!')
  }

  const grouped = tasks.reduce((acc, task) => {
    const priority = task.priority ?? 'medium'
    if (!acc[priority]) acc[priority] = []
    acc[priority].push(task)
    return acc
  }, {} as Record<string, Task[]>)

  const priorityOrder = ['urgent', 'high', 'medium', 'low']

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">VA Tasks</h1>
          <p className="text-xs text-muted-foreground">{tasks.length} tasks</p>
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-32 h-8 text-xs bg-secondary/50">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="in_progress">In Progress</SelectItem>
            <SelectItem value="blocked">Blocked</SelectItem>
            <SelectItem value="done">Done</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <div key={i} className="bg-card border border-border rounded-xl h-16 animate-pulse" />)}
        </div>
      ) : tasks.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
          No tasks with status: {statusFilter}. Create tasks from a client's Details page.
        </div>
      ) : (
        <div className="space-y-5">
          {priorityOrder.map((priority) => {
            const group = grouped[priority]
            if (!group?.length) return null
            return (
              <div key={priority} className="space-y-2">
                <h2 className={cn('text-xs font-semibold uppercase tracking-wider',
                  priority === 'urgent' ? 'text-red-400' :
                  priority === 'high' ? 'text-orange-400' :
                  priority === 'medium' ? 'text-yellow-400' : 'text-muted-foreground'
                )}>
                  {priority === 'urgent' ? '🔴' : priority === 'high' ? '🟠' : priority === 'medium' ? '🟡' : '⚪'} {priority.charAt(0).toUpperCase() + priority.slice(1)} Priority
                </h2>
                {group.map((task) => {
                  const typeLabel = TASK_TYPE_LABELS[task.task_type ?? ''] ?? task.task_type
                  const clientName = (task.client as { name?: string })?.name ?? 'Unknown'
                  return (
                    <div key={task.id} className={cn('bg-card border border-border rounded-xl px-4 py-3', task.status === 'done' && 'opacity-50')}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-foreground">{typeLabel}</span>
                            <Badge variant="outline" className={cn('text-[10px]', taskStatusColor(task.status))}>
                              {task.status?.replace('_', ' ')}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {clientName}
                            {task.assigned_va && ` · → ${task.assigned_va}`}
                            {task.due_date && ` · Due ${task.due_date}`}
                          </div>
                          {task.notes && <div className="text-xs text-muted-foreground mt-1">{task.notes}</div>}
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 w-7 p-0 text-muted-foreground hover:text-blue-400"
                            onClick={() => copyToSlack(task)}
                            title="Copy to Slack"
                          >
                            <Send className="w-3 h-3" />
                          </Button>
                          {task.status !== 'done' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-muted-foreground hover:text-emerald-400"
                              onClick={() => updateStatus(task.id, 'done')}
                              title="Mark done"
                            >
                              <CheckCircle className="w-3 h-3" />
                            </Button>
                          )}
                          {task.status === 'open' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 text-xs text-muted-foreground hover:text-yellow-400 px-2"
                              onClick={() => updateStatus(task.id, 'in_progress')}
                            >
                              Start
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
