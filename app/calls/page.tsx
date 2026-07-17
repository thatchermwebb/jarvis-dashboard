'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { ChevronDown, ChevronUp, ExternalLink, Pencil, Trash2, ChevronLeft, ChevronRight, LayoutList, CalendarDays, ArrowUpDown, History, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CallQueueCard, type PaymentDue } from '@/components/call-queue/CallQueueCard'
import { LogCallDialog } from '@/components/clients/LogCallDialog'
import { ScheduleCallDialog } from '@/components/clients/ScheduleCallDialog'
import { AuthorBadge } from '@/components/ui/author-badge'
import { cn, timeAgo, localToday, daysUntil } from '@/lib/utils'
import type { Client } from '@/types'

// ─── Constants ────────────────────────────────────────────────────────────────

const OUTCOME_CONFIG: Record<string, { label: string; color: string }> = {
  answered:       { label: 'Answered',       color: 'text-emerald-400' },
  voicemail:      { label: 'Left VM',        color: 'text-yellow-400' },
  texted:         { label: 'Texted',         color: 'text-blue-400' },
  no_answer:      { label: 'No Answer',      color: 'text-muted-foreground' },
  meeting_booked: { label: 'Meeting Booked', color: 'text-violet-400' },
}

const TYPE_ICON: Record<string, string> = {
  call: '📞', text: '💬', voicemail: '📬', meeting: '📅', note: '📝', email: '✉️',
}

const CAL_MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const CAL_DAYS = ['Su','Mo','Tu','We','Th','Fr','Sa']

type QueueTab = 'today' | 'tomorrow' | 'this_week' | 'all'
type ViewMode = 'queue' | 'calendar' | 'log'
type SortMode = 'priority' | 'due_date'
type TypeFilter = 'all' | 'thatcher' | 'trepp'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function offsetStr(days: number): string {
  const [y, m, d] = localToday().split('-').map(Number)
  const ms = Date.UTC(y, m - 1, d) + days * 86_400_000
  const dt = new Date(ms)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

function stageDotColor(stage: string): string {
  if (stage === 'active_client' || stage === 'won_back') return 'bg-emerald-400'
  if (stage === 'free_trial' || stage === 'trial_ending_soon') return 'bg-violet-400'
  if (stage === 'free_trial_pending') return 'bg-amber-400'
  if (stage === 'overdue' || stage === 'churn_risk' || stage === 'payment_issue') return 'bg-red-400'
  if (stage === 'paused') return 'bg-slate-400'
  return 'bg-muted-foreground/40'
}

// ─── Calendar View ────────────────────────────────────────────────────────────

function stagePlainText(stage: string) {
  const map: Record<string, string> = {
    active_client: 'Active', won_back: 'Won Back', free_trial: 'Free Trial',
    trial_ending_soon: 'Trial Ending', free_trial_pending: 'Trial Pending',
    overdue: 'Overdue', churn_risk: 'Churn Risk', payment_issue: 'Payment Issue',
    paused: 'Paused', onboarding: 'Onboarding',
  }
  return map[stage] ?? stage
}

function DayPopup({ day, year, month, clients, onClose }: {
  day: number; year: number; month: number; clients: Client[]; onClose: () => void
}) {
  const router = useRouter()
  const label = new Date(year, month, day).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
  const todayLocal = localToday()
  const dateStr = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`
  const isOverdue = dateStr < todayLocal
  const isToday = dateStr === todayLocal

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50" />
      <div
        className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border/40">
          <div>
            <div className="text-sm font-semibold">{label}</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {clients.length} {clients.length === 1 ? 'follow-up' : 'follow-ups'}
              {isOverdue && <span className="ml-2 text-red-400">· Overdue</span>}
              {isToday && <span className="ml-2 text-amber-400">· Today</span>}
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1 rounded-lg hover:bg-secondary/50">
            <X className="w-4 h-4" />
          </button>
        </div>
        {/* Client list */}
        <div className="divide-y divide-border/30 max-h-[60vh] overflow-y-auto">
          {clients.map(c => (
            <button
              key={c.id}
              onClick={() => { router.push(`/clients/${c.id}`); onClose() }}
              className="w-full text-left px-5 py-3.5 hover:bg-secondary/30 transition-colors flex items-center gap-3"
            >
              <span className={cn('w-2 h-2 rounded-full flex-shrink-0', stageDotColor(c.stage))} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{c.name}</div>
                {c.business_name && <div className="text-xs text-muted-foreground truncate">{c.business_name}</div>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[10px] text-muted-foreground/60">{stagePlainText(c.stage)}</span>
                {c.priority_score != null && (
                  <span className="text-[10px] font-mono text-muted-foreground/40">{c.priority_score}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function QueueCalendarView({ clients }: { clients: Client[] }) {
  const today = new Date(); today.setHours(0,0,0,0)
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [popupDay, setPopupDay] = useState<number | null>(null)

  const firstDay = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]
  while (cells.length % 7 !== 0) cells.push(null)

  const byDay: Record<string, Client[]> = {}
  clients.forEach(c => {
    if (c.next_followup_date) {
      const [y, m, d] = c.next_followup_date.split('-').map(Number)
      if (y === viewYear && m === viewMonth + 1) {
        const k = String(d)
        if (!byDay[k]) byDay[k] = []
        byDay[k].push(c)
      }
    }
  })

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }

  const todayLocal = new Date(); todayLocal.setHours(0,0,0,0)
  const popupClients = popupDay ? (byDay[String(popupDay)] ?? []) : []

  return (
    <>
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/40">
          <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <h3 className="text-sm font-semibold">{CAL_MONTHS[viewMonth]} {viewYear}</h3>
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
        {/* Day grid */}
        <div className="grid grid-cols-7">
          {cells.map((day, idx) => {
            if (!day) return <div key={`e-${idx}`} className="border-b border-r border-border/20 min-h-[80px]" />
            const cellDate = new Date(viewYear, viewMonth, day); cellDate.setHours(0,0,0,0)
            const isToday = cellDate.getTime() === todayLocal.getTime()
            const isPast = cellDate < todayLocal
            const clientsHere = byDay[String(day)] ?? []
            const hasClients = clientsHere.length > 0
            return (
              <div
                key={`d-${idx}`}
                onClick={() => hasClients && setPopupDay(day)}
                className={cn(
                  'border-b border-r border-border/20 min-h-[80px] p-1.5 transition-colors',
                  isToday && 'bg-primary/5',
                  isPast && !isToday && 'opacity-50',
                  hasClients && 'cursor-pointer hover:bg-secondary/20'
                )}
              >
                <div className={cn(
                  'text-xs font-medium mb-1 w-5 h-5 flex items-center justify-center rounded-full',
                  isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
                )}>
                  {day}
                </div>
                <div className="space-y-0.5">
                  {clientsHere.slice(0, 3).map(c => (
                    <div
                      key={c.id}
                      className="w-full text-left flex items-center gap-1 bg-secondary/50 rounded px-1.5 py-0.5"
                    >
                      <span className={cn('w-1.5 h-1.5 rounded-full flex-shrink-0', stageDotColor(c.stage))} />
                      <span className="text-[10px] text-foreground/80 truncate">{c.name}</span>
                    </div>
                  ))}
                  {clientsHere.length > 3 && (
                    <div className="text-[9px] text-muted-foreground/50 pl-1">+{clientsHere.length - 3} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {popupDay && (
        <DayPopup
          day={popupDay}
          year={viewYear}
          month={viewMonth}
          clients={popupClients}
          onClose={() => setPopupDay(null)}
        />
      )}
    </>
  )
}

// ─── Log entry types ──────────────────────────────────────────────────────────

interface CommunicationLog {
  id: string
  created_at: string
  client_id: string
  log_type: string
  outcome: string
  summary: string
  sentiment: string
  promises_made: string
  objections: string
  next_step: string
  followup_date: string
  created_by: string
  ad_creative?: string
  trial_notes?: string
  client?: { id: string; name: string; business_name?: string; stage?: string }
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function CallsPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const filterClientId = searchParams.get('client_id')

  // View / tab state
  const [queueTab, setQueueTab] = useState<QueueTab>('today')
  const [viewMode, setViewMode] = useState<ViewMode>(filterClientId ? 'log' : 'queue')
  const [sortMode, setSortMode] = useState<SortMode>('priority')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')

  // Data
  const [allClients, setAllClients] = useState<Client[]>([])
  const [logs, setLogs] = useState<CommunicationLog[]>([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [loadingLog, setLoadingLog] = useState(false)

  // Dialogs
  const [logOpen, setLogOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [editingLog, setEditingLog] = useState<CommunicationLog | null>(null)
  const [paymentFlags, setPaymentFlags] = useState<Record<string, PaymentDue>>({})

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true)
    const [clientsRes, paymentsRes] = await Promise.all([
      fetch('/api/clients?prioritized=true'),
      fetch('/api/payments'),
    ])
    const data = await clientsRes.json()
    const all: Client[] = Array.isArray(data) ? data : []
    const excluded = ['churned', 'free_trial_lost', 'trial_concluded', 'onboarding']
    setAllClients(all.filter(c => !excluded.includes(c.stage)))

    // Build a per-client "most urgent unpaid payment" flag for the call cards.
    const payments = await paymentsRes.json().catch(() => [])
    const t = localToday()
    const tom = offsetStr(1)
    const flags: Record<string, PaymentDue> = {}
    const rank: Record<PaymentDue, number> = { overdue: 3, today: 2, tomorrow: 1 }
    for (const p of (Array.isArray(payments) ? payments : [])) {
      if (!p.client_id || !p.due_date) continue
      if (!['pending', 'overdue'].includes(p.status)) continue // unpaid only
      let flag: PaymentDue | null = null
      if (p.status === 'overdue' || p.due_date < t) flag = 'overdue'
      else if (p.due_date === t) flag = 'today'
      else if (p.due_date === tom) flag = 'tomorrow'
      if (!flag) continue
      if (!flags[p.client_id] || rank[flag] > rank[flags[p.client_id]]) flags[p.client_id] = flag
    }
    setPaymentFlags(flags)
    setLoadingQueue(false)
  }, [])

  const loadLog = useCallback(async () => {
    setLoadingLog(true)
    const url = filterClientId ? `/api/communication-logs?client_id=${filterClientId}` : '/api/communication-logs'
    const res = await fetch(url)
    const data = await res.json()
    setLogs(Array.isArray(data) ? data : [])
    setLoadingLog(false)
  }, [filterClientId])

  useEffect(() => { loadQueue() }, [loadQueue])
  useEffect(() => { if (viewMode === 'log') loadLog() }, [viewMode, loadLog])

  // Filter clients by tab
  function getTabClients(tab: QueueTab): Client[] {
    const t = localToday()
    const tom = offsetStr(1)
    const in7 = offsetStr(7)

    let filtered: Client[]
    switch (tab) {
      case 'today':
        filtered = allClients.filter(c => {
          if (!c.next_followup_date) return true // never contacted / no date = due now
          return c.next_followup_date <= t
        })
        break
      case 'tomorrow':
        filtered = allClients.filter(c => c.next_followup_date === tom)
        break
      case 'this_week':
        filtered = allClients.filter(c => {
          if (!c.next_followup_date) return false
          return c.next_followup_date > t && c.next_followup_date <= in7
        })
        break
      case 'all':
        filtered = allClients.filter(c => c.next_followup_date)
        break
    }

    // Type filter — who owns the call
    if (typeFilter === 'thatcher') {
      filtered = filtered.filter(c => c.thatcher_needed)
    } else if (typeFilter === 'trepp') {
      filtered = filtered.filter(c => c.trepp_needed || c.va_needed)
    }

    if (sortMode === 'due_date') {
      return [...filtered].sort((a, b) => {
        if (!a.next_followup_date && !b.next_followup_date) return (b.priority_score ?? 0) - (a.priority_score ?? 0)
        if (!a.next_followup_date) return 1
        if (!b.next_followup_date) return -1
        const cmp = a.next_followup_date.localeCompare(b.next_followup_date)
        if (cmp !== 0) return cmp
        return (b.priority_score ?? 0) - (a.priority_score ?? 0)
      })
    }
    // priority: already sorted by API
    return filtered
  }

  // Calendar shows all clients with followup dates
  const calendarClients = allClients.filter(c => c.next_followup_date)

  const tabClients = getTabClients(queueTab)

  const tabCount = (tab: QueueTab) => getTabClients(tab).length

  async function deleteLog(id: string) {
    await fetch(`/api/communication-logs/${id}`, { method: 'DELETE' })
    setLogs(prev => prev.filter(l => l.id !== id))
    if (expandedLog === id) setExpandedLog(null)
  }

  // Tab trigger style
  const tabStyle = (active: boolean) => cn(
    'relative px-0 mr-5 pb-2.5 pt-0 text-sm font-medium transition-colors',
    active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground/80'
  )

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Calls</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your call queue and contact history</p>
        </div>
        <div className="flex gap-2 pt-1 flex-wrap">
          <Button size="sm" variant="outline" className="h-9 px-4 text-sm border-border/60 text-muted-foreground hover:text-foreground" onClick={() => setScheduleOpen(true)}>
            Schedule Call
          </Button>
          <Button size="sm" className="h-9 px-4 text-sm bg-primary text-primary-foreground hover:bg-primary/90 font-medium" onClick={() => setLogOpen(true)}>
            Log Call
          </Button>
        </div>
      </div>

      {/* Client filter banner */}
      {filterClientId && (
        <div className="flex items-center gap-2 bg-secondary/40 border border-border/40 rounded-xl px-4 py-2.5 text-sm">
          <span className="text-muted-foreground">Showing history for</span>
          <button
            onClick={() => router.push(`/clients/${filterClientId}`)}
            className="font-medium text-primary hover:underline"
          >
            {logs[0]?.client?.name ?? 'client'}
          </button>
          <button
            onClick={() => router.push('/calls')}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            ✕ Clear filter
          </button>
        </div>
      )}

      {/* ── Controls ──────────────────────────────────────────────────────── */}
      {/* Row 1: view switcher (left) + sort (right, queue only) */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex bg-secondary/40 border border-border/40 rounded-lg p-0.5">
          {([
            { key: 'queue', label: 'Queue', icon: LayoutList },
            { key: 'calendar', label: 'Calendar', icon: CalendarDays },
            { key: 'log', label: 'History', icon: History },
          ] as { key: ViewMode; label: string; icon: typeof LayoutList }[]).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setViewMode(key)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                viewMode === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {viewMode === 'queue' && (
          <button
            onClick={() => setSortMode(s => s === 'priority' ? 'due_date' : 'priority')}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors flex-shrink-0"
            title="Toggle sort order"
          >
            <ArrowUpDown className="w-3 h-3" />
            <span>{sortMode === 'priority' ? 'Priority' : 'Due Date'}</span>
          </button>
        )}
      </div>

      {/* Row 2 (queue only): time tabs (left) + type filter (right) */}
      {viewMode === 'queue' && (
        <div className="flex items-center justify-between gap-3 flex-wrap border-b border-border/40 -mt-2">
          {/* Time-range tabs */}
          <div className="flex items-end overflow-x-auto">
            {([
              { key: 'today', label: 'Today' },
              { key: 'tomorrow', label: 'Tomorrow' },
              { key: 'this_week', label: 'This Week' },
              { key: 'all', label: 'All' },
            ] as { key: QueueTab; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setQueueTab(key)}
                className={tabStyle(queueTab === key)}
              >
                {label}
                {tabCount(key) > 0 && (
                  <span className={cn(
                    'ml-1.5 text-[10px] font-bold px-1.5 py-0.5 rounded',
                    queueTab === key ? 'bg-primary/15 text-primary' : 'bg-secondary/60 text-muted-foreground'
                  )}>
                    {tabCount(key)}
                  </span>
                )}
                {queueTab === key && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
                )}
              </button>
            ))}
          </div>

          {/* Type filter: All / Thatcher / Trepp */}
          <div className="flex bg-secondary/40 border border-border/40 rounded-lg p-0.5 mb-2 flex-shrink-0">
            {([
              { key: 'all', label: 'All' },
              { key: 'thatcher', label: 'Thatcher' },
              { key: 'trepp', label: 'Trepp' },
            ] as { key: TypeFilter; label: string }[]).map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setTypeFilter(key)}
                className={cn(
                  'px-2.5 py-1 rounded-md text-xs font-medium transition-colors',
                  typeFilter === key ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── QUEUE VIEW ────────────────────────────────────────────────────── */}
      {viewMode === 'queue' && (
        <div className="space-y-3">
          {loadingQueue ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-36 bg-card border border-border rounded-xl animate-pulse" />
            ))
          ) : tabClients.length === 0 ? (
            queueTab === 'today' ? (
              <div className="bg-card border border-border rounded-xl p-14 text-center space-y-3">
                <div className="text-4xl">✅</div>
                <div className="text-base font-semibold">You&apos;re all set!</div>
                <div className="text-sm text-muted-foreground">Everyone has been reached out to for today.</div>
              </div>
            ) : (
              <div className="bg-card border border-border rounded-xl p-12 text-center space-y-2">
                <div className="text-2xl">📭</div>
                <div className="text-sm font-medium text-muted-foreground">No follow-ups in this range</div>
              </div>
            )
          ) : (
            tabClients.map(c => <CallQueueCard key={c.id} client={c} onUpdated={loadQueue} paymentDue={paymentFlags[c.id] ?? null} />)
          )}
        </div>
      )}

      {/* ── CALENDAR VIEW ─────────────────────────────────────────────────── */}
      {viewMode === 'calendar' && (
        loadingQueue ? (
          <div className="h-80 bg-card border border-border rounded-xl animate-pulse" />
        ) : (
          <QueueCalendarView clients={calendarClients} />
        )
      )}

      {/* ── LOG / HISTORY VIEW ────────────────────────────────────────────── */}
      {viewMode === 'log' && (
        <div className="space-y-2">
          {loadingLog ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-card border border-border rounded-xl animate-pulse" />
            ))
          ) : logs.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
              No contacts logged yet. Use &quot;Log Call&quot; to record a contact.
            </div>
          ) : (
            logs.map((log) => {
              const cfg = OUTCOME_CONFIG[log.outcome] ?? { label: log.outcome, color: 'text-muted-foreground' }
              const isExpanded = expandedLog === log.id
              const clientName = log.client?.name ?? 'Unknown'
              return (
                <div key={log.id} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div
                    className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/20 transition-colors"
                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                  >
                    <span className="text-base">{TYPE_ICON[log.log_type] ?? '📞'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          className="font-medium text-sm hover:text-primary transition-colors"
                          onClick={(e) => { e.stopPropagation(); router.push(`/clients/${log.client_id}`) }}
                        >
                          {clientName}
                        </button>
                        <span className={cn('text-xs font-medium', cfg.color)}>{cfg.label}</span>
                        {log.sentiment && <span className="text-xs text-muted-foreground">{log.sentiment}</span>}
                        {log.ad_creative && <span className="text-[10px] bg-secondary/60 text-muted-foreground px-1.5 py-0.5 rounded">{log.ad_creative}</span>}
                      </div>
                      {log.summary && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{log.summary}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <AuthorBadge createdBy={log.created_by} />
                      <span className="text-xs text-muted-foreground">{timeAgo(log.created_at)}</span>
                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3 space-y-3 bg-secondary/10">
                      {log.summary && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Summary</div>
                          <div className="text-sm">{log.summary}</div>
                        </div>
                      )}
                      {log.promises_made && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Promises Made</div>
                          <div className="text-sm">{log.promises_made}</div>
                        </div>
                      )}
                      {log.next_step && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Next Step</div>
                          <div className="text-sm">{log.next_step}</div>
                        </div>
                      )}
                      {log.ad_creative && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Ad Creative</div>
                          <div className="text-sm">{log.ad_creative}</div>
                        </div>
                      )}
                      {log.trial_notes && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Trial Notes</div>
                          <div className="text-sm">{log.trial_notes}</div>
                        </div>
                      )}
                      {log.followup_date && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Follow-Up Scheduled</div>
                          <div className="text-sm">{new Date(log.followup_date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
                        </div>
                      )}
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-muted-foreground">
                          Logged by {log.created_by ?? 'Diego'} · {new Date(log.created_at).toLocaleString()}
                        </span>
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs gap-1 text-muted-foreground"
                            onClick={() => router.push(`/clients/${log.client_id}`)}
                          >
                            <ExternalLink className="w-3 h-3" /> View Client
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                            onClick={(e) => { e.stopPropagation(); setEditingLog(log) }}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-red-400"
                            onClick={(e) => { e.stopPropagation(); deleteLog(log.id) }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Dialogs */}
      <LogCallDialog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onLogged={() => { loadQueue(); if (viewMode === 'log') loadLog() }}
      />
      <LogCallDialog
        open={!!editingLog}
        onClose={() => setEditingLog(null)}
        editLog={editingLog ?? undefined}
        onLogged={() => { setEditingLog(null); loadLog() }}
      />
      <ScheduleCallDialog
        open={scheduleOpen}
        onClose={() => setScheduleOpen(false)}
        onSaved={loadQueue}
      />
    </div>
  )
}

export default function CallsPage() {
  return (
    <Suspense>
      <CallsPageInner />
    </Suspense>
  )
}
