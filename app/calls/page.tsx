'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Phone, CalendarPlus, ChevronDown, ChevronUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CallQueueCard } from '@/components/call-queue/CallQueueCard'
import { LogCallDialog } from '@/components/clients/LogCallDialog'
import { ScheduleCallDialog } from '@/components/calls/ScheduleCallDialog'
import { cn, timeAgo } from '@/lib/utils'
import type { Client } from '@/types'

interface CommunicationLog {
  id: string
  client_id: string
  created_at: string
  log_type: string
  outcome: string
  summary: string
  sentiment: string
  promises_made: string
  next_step: string
  followup_date: string
  created_by: string
  client?: { id: string; name: string; business_name?: string }
}

const OUTCOME_CONFIG: Record<string, { label: string; color: string }> = {
  answered:       { label: 'Answered',       color: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' },
  voicemail:      { label: 'Left VM',        color: 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10' },
  texted:         { label: 'Texted',         color: 'text-blue-400 border-blue-500/30 bg-blue-500/10' },
  no_answer:      { label: 'No Answer',      color: 'text-muted-foreground border-border' },
  meeting_booked: { label: 'Meeting Booked', color: 'text-violet-400 border-violet-500/30 bg-violet-500/10' },
}

const TYPE_ICON: Record<string, string> = {
  call: '📞', text: '💬', voicemail: '📳', meeting: '📅', note: '📝', email: '✉️',
}

const SENTIMENT_EMOJI: Record<string, string> = {
  happy: '😊', neutral: '😐', confused: '😕', concerned: '😟',
  frustrated: '😤', angry: '😠', ghosting: '👻', close_ready: '🎯',
}

export default function CallsPage() {
  const router = useRouter()
  const [tab, setTab] = useState('queue')
  const [clients, setClients] = useState<Client[]>([])
  const [logs, setLogs] = useState<CommunicationLog[]>([])
  const [loadingClients, setLoadingClients] = useState(true)
  const [loadingLogs, setLoadingLogs] = useState(true)
  const [logOpen, setLogOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)

  const loadClients = useCallback(async () => {
    setLoadingClients(true)
    const res = await fetch('/api/clients?prioritized=true')
    const data = await res.json()
    setClients(Array.isArray(data) ? data : [])
    setLoadingClients(false)
  }, [])

  const loadLogs = useCallback(async () => {
    setLoadingLogs(true)
    const res = await fetch('/api/communication-logs')
    const data = await res.json()
    setLogs(Array.isArray(data) ? data : [])
    setLoadingLogs(false)
  }, [])

  useEffect(() => { loadClients() }, [loadClients])
  useEffect(() => { if (tab === 'log') loadLogs() }, [tab, loadLogs])

  // Queue: clients with a next_followup_date set (today or past), sorted by that date
  const queue = clients
    .filter(c => c.next_followup_date)
    .sort((a, b) => new Date(a.next_followup_date!).getTime() - new Date(b.next_followup_date!).getTime())

  const queueOverdue = queue.filter(c => new Date(c.next_followup_date!) <= new Date())
  const queueUpcoming = queue.filter(c => new Date(c.next_followup_date!) > new Date())
  const noFollowup = clients.filter(c => !c.next_followup_date && !['churned', 'trial_concluded', 'onboarding'].includes(c.stage))

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Calls</h1>
          <p className="text-xs text-muted-foreground">Schedule, track, and log all client calls</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setScheduleOpen(true)}>
            <CalendarPlus className="w-3.5 h-3.5" /> Schedule Call
          </Button>
          <Button size="sm" className="h-8 gap-1.5 text-xs" onClick={() => setLogOpen(true)}>
            <Phone className="w-3.5 h-3.5" /> Log Call
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="queue" className="text-xs">
            Call Queue {queue.length > 0 && <span className="ml-1.5 bg-primary/20 text-primary rounded-full px-1.5 py-0.5 text-[10px]">{queue.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="log" className="text-xs">Call Log</TabsTrigger>
        </TabsList>

        {/* ── QUEUE TAB ── */}
        <TabsContent value="queue" className="mt-4 space-y-6">
          {loadingClients ? (
            <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-36 bg-card border border-border rounded-xl animate-pulse" />)}</div>
          ) : queue.length === 0 && noFollowup.length === 0 ? (
            <EmptyState label="No calls scheduled. Use 'Schedule Call' to tee one up." />
          ) : (
            <>
              {queueOverdue.length > 0 && (
                <Section title="Overdue" color="text-red-400" count={queueOverdue.length}>
                  {queueOverdue.map(c => <CallQueueCard key={c.id} client={c} onUpdated={loadClients} />)}
                </Section>
              )}
              {queueUpcoming.length > 0 && (
                <Section title="Upcoming" color="text-yellow-400" count={queueUpcoming.length}>
                  {queueUpcoming.map(c => <CallQueueCard key={c.id} client={c} onUpdated={loadClients} />)}
                </Section>
              )}
              {noFollowup.length > 0 && (
                <Section title="No Call Scheduled" color="text-muted-foreground" count={noFollowup.length}>
                  {noFollowup.map(c => <CallQueueCard key={c.id} client={c} onUpdated={loadClients} />)}
                </Section>
              )}
            </>
          )}
        </TabsContent>

        {/* ── LOG TAB ── */}
        <TabsContent value="log" className="mt-4 space-y-2">
          {loadingLogs ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />)}</div>
          ) : logs.length === 0 ? (
            <EmptyState label="No calls logged yet. Use 'Log Call' to record a contact." />
          ) : (
            logs.map(log => (
              <LogItem key={log.id} log={log} onClientClick={() => router.push(`/clients/${log.client_id}`)} />
            ))
          )}
        </TabsContent>
      </Tabs>

      <LogCallDialog open={logOpen} onClose={() => setLogOpen(false)} onLogged={() => { loadClients(); loadLogs() }} />
      <ScheduleCallDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} onSaved={loadClients} />
    </div>
  )
}

function Section({ title, color, count, children }: { title: string; color: string; count: number; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className={cn('text-xs font-semibold uppercase tracking-wider', color)}>
        {title} <span className="text-muted-foreground font-normal">({count})</span>
      </div>
      {children}
    </div>
  )
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">{label}</div>
  )
}

function LogItem({ log, onClientClick }: { log: CommunicationLog; onClientClick: () => void }) {
  const [expanded, setExpanded] = useState(false)
  const cfg = OUTCOME_CONFIG[log.outcome] ?? { label: log.outcome, color: 'text-muted-foreground border-border' }
  const clientName = log.client?.name ?? 'Unknown Client'

  const hasDetails = !!(log.summary || log.promises_made || log.next_step || log.followup_date || log.sentiment)

  return (
    <div className="bg-card border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 flex items-center gap-3">
        <span className="text-lg leading-none flex-shrink-0">{TYPE_ICON[log.log_type] ?? '📞'}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={onClientClick} className="font-medium text-foreground hover:text-primary transition-colors text-sm">
              {clientName}
            </button>
            {log.client?.business_name && (
              <span className="text-xs text-muted-foreground">{log.client.business_name}</span>
            )}
            <Badge variant="outline" className={cn('text-[10px] px-1.5', cfg.color)}>{cfg.label}</Badge>
            {log.sentiment && <span className="text-sm">{SENTIMENT_EMOJI[log.sentiment]}</span>}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {timeAgo(log.created_at)} · {log.created_by ?? 'Diego'}
            {log.summary && <span className="text-foreground/70"> · {log.summary.slice(0, 80)}{log.summary.length > 80 ? '…' : ''}</span>}
          </div>
        </div>
        {hasDetails && (
          <button onClick={() => setExpanded(e => !e)} className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        )}
      </div>

      {expanded && hasDetails && (
        <div className="border-t border-border px-4 py-3 space-y-2 bg-secondary/20">
          {log.summary && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Summary</div>
              <div className="text-sm">{log.summary}</div>
            </div>
          )}
          {log.promises_made && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Promises Made</div>
              <div className="text-sm">{log.promises_made}</div>
            </div>
          )}
          {log.next_step && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Next Step</div>
              <div className="text-sm">{log.next_step}</div>
            </div>
          )}
          {log.followup_date && (
            <div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Follow-Up</div>
              <div className="text-sm">{new Date(log.followup_date).toLocaleDateString()}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
