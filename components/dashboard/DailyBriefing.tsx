'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ChevronRight } from 'lucide-react'
import { cn, formatCurrency, localToday } from '@/lib/utils'
import type { DashboardStats, Client, Task } from '@/types'

export interface BriefingClientLists {
  trials_ending: Client[]
  payment_issues: Client[]
  close_ready: Client[]
  at_risk: Client[]
  thatcher: Client[]
  overdue: Client[]
}

interface Props {
  stats: DashboardStats
  clientLists: BriefingClientLists
  mrrChange?: number | null
  allTasks?: Task[]
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

function ExpandableRow({ text, clients }: { text: string; clients: Client[] }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-left w-full group"
      >
        <span className="text-base text-foreground/90 group-hover:text-foreground transition-colors">{text}</span>
        <ChevronRight
          className={cn(
            'w-4 h-4 text-muted-foreground/50 transition-transform flex-shrink-0',
            open && 'rotate-90'
          )}
        />
      </button>
      {open && (
        <div className="mt-2 ml-4 space-y-3 border-l border-border/40 pl-4">
          {clients.map((c) => (
            <button
              key={c.id}
              onClick={() => router.push(`/clients/${c.id}`)}
              className="block text-left w-full hover:bg-white/3 rounded-lg py-1 -mx-2 px-2 transition-colors"
            >
              <div className="text-sm font-medium text-foreground hover:text-primary transition-colors">
                {c.name}
              </div>
              {(c.business_name || c.market_location) && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {[c.business_name, c.market_location].filter(Boolean).join(' · ')}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function TasksExpandableRow({ text, tasks }: { text: string; tasks: Task[] }) {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 text-left w-full group"
      >
        <span className="text-base text-foreground/90 group-hover:text-foreground transition-colors">{text}</span>
        <ChevronRight
          className={cn(
            'w-4 h-4 text-muted-foreground/50 transition-transform flex-shrink-0',
            open && 'rotate-90'
          )}
        />
      </button>
      {open && (
        <div className="mt-2 ml-4 border-l border-border/40 pl-4 space-y-2">
          {tasks.map((t) => {
            const label = t.title || 'Task'
            const clientName = (t.client as { name?: string } | null)?.name
            return (
              <div key={t.id} className="py-1">
                <div className="text-sm text-foreground/90">{label}</div>
                {clientName && (
                  <div className="text-xs text-muted-foreground">{clientName}</div>
                )}
              </div>
            )
          })}
          <button
            onClick={() => router.push('/tasks')}
            className="text-xs text-primary hover:underline pt-1 block"
          >
            See all tasks →
          </button>
        </div>
      )}
    </div>
  )
}

export function DailyBriefing({ stats, clientLists, mrrChange, allTasks = [] }: Props) {
  const today = format(new Date(), 'EEEE, MMMM d')
  const todayStr = localToday()
  const [activeUser, setActiveUser] = useState('Diego')

  useEffect(() => {
    setActiveUser(getActiveUser())
  }, [])

  const userTasks = allTasks.filter(t => !t.assigned_to || t.assigned_to === activeUser)
  const userTasksDueToday = userTasks.filter(t => t.due_date === todayStr)
  const userTasksOverdue = userTasks.filter(t => t.due_date && t.due_date < todayStr)

  type BriefingRow =
    | { kind: 'clients'; text: string; clients: Client[] }
    | { kind: 'tasks'; text: string; tasks: Task[] }

  const rows: BriefingRow[] = []

  if (stats.trials_ending_today > 0)
    rows.push({ kind: 'clients',
      text: `🔥 ${stats.trials_ending_today} trial${stats.trials_ending_today > 1 ? 's' : ''} end${stats.trials_ending_today === 1 ? 's' : ''} today`,
      clients: clientLists.trials_ending,
    })
  if (stats.overdue_followups > 0)
    rows.push({ kind: 'clients',
      text: `📅 ${stats.overdue_followups} overdue follow-up${stats.overdue_followups > 1 ? 's' : ''}`,
      clients: clientLists.overdue,
    })
  if (stats.payment_issues > 0)
    rows.push({ kind: 'clients',
      text: `💳 ${stats.payment_issues} payment issue${stats.payment_issues > 1 ? 's' : ''} to resolve`,
      clients: clientLists.payment_issues,
    })
  if (stats.close_ready_trials > 0)
    rows.push({ kind: 'clients',
      text: `🎯 ${stats.close_ready_trials} trial${stats.close_ready_trials > 1 ? 's' : ''} close-ready — book Thatcher`,
      clients: clientLists.close_ready,
    })
  if (stats.thatcher_needed > 0)
    rows.push({ kind: 'clients',
      text: `⭐ ${stats.thatcher_needed} client${stats.thatcher_needed > 1 ? 's' : ''} need${stats.thatcher_needed === 1 ? 's' : ''} Thatcher`,
      clients: clientLists.thatcher,
    })
  if (userTasksDueToday.length > 0)
    rows.push({ kind: 'tasks',
      text: `✅ ${userTasksDueToday.length} task${userTasksDueToday.length > 1 ? 's' : ''} due today`,
      tasks: userTasksDueToday,
    })
  if (userTasksOverdue.length > 0)
    rows.push({ kind: 'tasks',
      text: `🚨 ${userTasksOverdue.length} overdue task${userTasksOverdue.length > 1 ? 's' : ''}`,
      tasks: userTasksOverdue,
    })
  if (stats.at_risk_clients > 0)
    rows.push({ kind: 'clients',
      text: `⚠️ ${stats.at_risk_clients} client${stats.at_risk_clients > 1 ? 's' : ''} at churn risk`,
      clients: clientLists.at_risk,
    })

  const allClear = rows.length === 0

  return (
    <div className="bg-card border border-border rounded-2xl p-7">
      <div className="flex items-start justify-between gap-6">
        <div>
          <div className="text-[11px] text-muted-foreground uppercase tracking-widest mb-2">Daily Briefing</div>
          <div className="text-3xl font-bold text-foreground">{today}</div>
        </div>
        <div className="text-right flex-shrink-0">
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-1">MRR</div>
          <div className="text-4xl font-bold text-emerald-400 leading-none">
            {formatCurrency(stats.monthly_recurring_revenue)}
          </div>
          {mrrChange !== null && mrrChange !== undefined && (
            <div className={cn('text-xs font-medium mt-1', mrrChange >= 0 ? 'text-emerald-400/70' : 'text-red-400/70')}>
              {mrrChange >= 0 ? '+' : ''}{mrrChange}% last 30 days
            </div>
          )}
          <div className="text-sm text-muted-foreground mt-1">{stats.active_clients} active clients</div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {allClear ? (
          <div className="text-base text-foreground/80">✅ No critical items. Great shape today.</div>
        ) : (
          rows.map((row, i) =>
            row.kind === 'tasks'
              ? <TasksExpandableRow key={i} text={row.text} tasks={row.tasks} />
              : <ExpandableRow key={i} text={row.text} clients={row.clients} />
          )
        )}
      </div>

      <div className="mt-6 pt-5 border-t border-border grid grid-cols-3 gap-4 text-center">
        <div>
          <div className="text-2xl font-bold text-violet-400">{stats.free_trials}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Active Trials</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-amber-400">{stats.trials_ending_this_week}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Ending This Week</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-foreground">{stats.active_clients + stats.free_trials}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Total Managed</div>
        </div>
      </div>
    </div>
  )
}
