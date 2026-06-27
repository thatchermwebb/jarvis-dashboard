'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react'
import { cn, localToday } from '@/lib/utils'
import type { Task, TaskStatus } from '@/types'

interface Props {
  tasks: Task[]
}

export function TasksWidget({ tasks }: Props) {
  const router = useRouter()
  const today = localToday()
  const [overdueOpen, setOverdueOpen] = useState(true)
  const [todayOpen, setTodayOpen] = useState(true)
  const [localTasks, setLocalTasks] = useState(tasks)

  const open = localTasks.filter(t => t.status !== 'done')
  const overdue = open.filter(t => t.due_date && t.due_date < today)
  const dueToday = open.filter(t => t.due_date === today)
  const upcoming = open.filter(t => !t.due_date || t.due_date > today)

  async function toggleDone(task: Task) {
    const newStatus: TaskStatus = task.status === 'done' ? 'open' : 'done'
    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    setLocalTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
  }

  function TaskRow({ task }: { task: Task }) {
    const done = task.status === 'done'
    const label = task.title || task.task_type?.replace(/_/g, ' ') || 'Task'
    const clientName = (task.client as { name?: string } | null)?.name
    return (
      <div className="flex items-center gap-2.5 py-2 border-b border-border/30 last:border-0">
        <button
          onClick={() => toggleDone(task)}
          className={cn('flex-shrink-0 transition-colors', done ? 'text-emerald-400' : 'text-muted-foreground/40 hover:text-muted-foreground')}
        >
          {done ? <CheckCircle2 className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-sm truncate">{label}</div>
          <div className="flex items-center gap-2 mt-0.5">
            {clientName && (
              <button
                onClick={() => router.push(`/clients/${task.client_id}`)}
                className="text-[10px] text-primary/60 hover:text-primary flex items-center gap-0.5 transition-colors"
              >
                <ExternalLink className="w-2.5 h-2.5" /> {clientName}
              </button>
            )}
            {task.assigned_to && (
              <span className="text-[10px] text-muted-foreground/50">{task.assigned_to}</span>
            )}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Tasks</h2>
        <Link href="/tasks" className="text-sm text-primary hover:underline">See all →</Link>
      </div>

      {overdue.length === 0 && dueToday.length === 0 && upcoming.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-6 text-center space-y-1">
          <div className="text-2xl">✅</div>
          <div className="text-sm text-muted-foreground">No open tasks</div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border/40">

          {/* Overdue */}
          {overdue.length > 0 && (
            <div>
              <button
                onClick={() => setOverdueOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-red-400">⚠ Overdue</span>
                  <span className="text-[11px] bg-red-500/15 text-red-400 border border-red-500/20 px-1.5 py-0.5 rounded-full font-bold">{overdue.length}</span>
                </div>
                {overdueOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
              {overdueOpen && (
                <div className="px-4 pb-1">
                  {overdue.map(t => <TaskRow key={t.id} task={t} />)}
                </div>
              )}
            </div>
          )}

          {/* Due today */}
          {dueToday.length > 0 && (
            <div>
              <button
                onClick={() => setTodayOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/20 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-amber-400">📅 Due today</span>
                  <span className="text-[11px] bg-amber-500/15 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded-full font-bold">{dueToday.length}</span>
                </div>
                {todayOpen ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
              {todayOpen && (
                <div className="px-4 pb-1">
                  {dueToday.map(t => <TaskRow key={t.id} task={t} />)}
                </div>
              )}
            </div>
          )}

          {/* Upcoming (no date or future) */}
          {upcoming.length > 0 && (
            <div className="px-4 py-2">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground/50 mb-1">Upcoming</div>
              {upcoming.slice(0, 3).map(t => <TaskRow key={t.id} task={t} />)}
              {upcoming.length > 3 && (
                <Link href="/tasks" className="text-[11px] text-muted-foreground hover:text-foreground block mt-1">
                  +{upcoming.length - 3} more
                </Link>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
