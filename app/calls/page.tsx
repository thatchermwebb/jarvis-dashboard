'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, ExternalLink, Pencil, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CallQueueCard } from '@/components/call-queue/CallQueueCard'
import { LogCallDialog } from '@/components/clients/LogCallDialog'
import { ScheduleCallDialog } from '@/components/clients/ScheduleCallDialog'
import { cn, timeAgo } from '@/lib/utils'
import type { Client } from '@/types'

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
  client?: { id: string; name: string; business_name?: string }
}

export default function CallsPage() {
  const router = useRouter()
  const [tab, setTab] = useState('queue')
  const [queueClients, setQueueClients] = useState<Client[]>([])
  const [logs, setLogs] = useState<CommunicationLog[]>([])
  const [loadingQueue, setLoadingQueue] = useState(true)
  const [loadingLog, setLoadingLog] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [expandedLog, setExpandedLog] = useState<string | null>(null)
  const [editingLog, setEditingLog] = useState<CommunicationLog | null>(null)

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true)
    const res = await fetch('/api/clients?prioritized=true')
    const data = await res.json()
    const all: Client[] = Array.isArray(data) ? data : []
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const excluded = ['churned', 'free_trial_lost', 'trial_concluded', 'onboarding']
    const queue = all.filter((c) => {
      if (excluded.includes(c.stage)) return false
      if (!c.next_followup_date && !c.last_contact_date) return true
      if (c.next_followup_date) {
        const due = new Date(c.next_followup_date)
        due.setHours(0, 0, 0, 0)
        return due <= today
      }
      return false
    })
    setQueueClients(queue)
    setLoadingQueue(false)
  }, [])

  const loadLog = useCallback(async () => {
    setLoadingLog(true)
    const res = await fetch('/api/communication-logs')
    const data = await res.json()
    setLogs(Array.isArray(data) ? data : [])
    setLoadingLog(false)
  }, [])

  useEffect(() => { loadQueue() }, [loadQueue])
  useEffect(() => { if (tab === 'log') loadLog() }, [tab, loadLog])

  async function deleteLog(id: string) {
    await fetch(`/api/communication-logs/${id}`, { method: 'DELETE' })
    setLogs(prev => prev.filter(l => l.id !== id))
    if (expandedLog === id) setExpandedLog(null)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Calls</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your call queue and contact history</p>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" variant="outline" className="h-9 px-4 text-sm border-border/60 text-muted-foreground hover:text-foreground" onClick={() => setScheduleOpen(true)}>
            Schedule Call
          </Button>
          <Button size="sm" className="h-9 px-4 text-sm bg-primary text-primary-foreground hover:bg-primary/90 font-medium" onClick={() => setLogOpen(true)}>
            Log Call
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-transparent border-b border-border/40 w-full justify-start rounded-none h-auto p-0 gap-0">
          <TabsTrigger
            value="queue"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary text-muted-foreground px-0 mr-6 pb-2.5 pt-0 text-sm font-medium bg-transparent data-[state=active]:bg-transparent shadow-none"
          >
            Call Queue
            {queueClients.length > 0 && (
              <span className="ml-2 bg-primary/15 text-primary rounded px-1.5 py-0.5 text-[11px] font-bold">
                {queueClients.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger
            value="log"
            className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:text-primary text-muted-foreground px-0 pb-2.5 pt-0 text-sm font-medium bg-transparent data-[state=active]:bg-transparent shadow-none"
          >
            Call Log
          </TabsTrigger>
        </TabsList>

        <TabsContent value="queue" className="mt-4 space-y-3">
          {loadingQueue ? (
            [...Array(3)].map((_, i) => (
              <div key={i} className="h-36 bg-card border border-border rounded-xl animate-pulse" />
            ))
          ) : queueClients.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center space-y-2">
              <div className="text-2xl">✅</div>
              <div className="text-sm font-medium">Queue is clear</div>
              <div className="text-xs text-muted-foreground">No calls due today. Schedule one or check back tomorrow.</div>
            </div>
          ) : (
            queueClients.map((c) => <CallQueueCard key={c.id} client={c} onUpdated={loadQueue} />)
          )}
        </TabsContent>

        <TabsContent value="log" className="mt-4 space-y-2">
          {loadingLog ? (
            [...Array(5)].map((_, i) => (
              <div key={i} className="h-14 bg-card border border-border rounded-xl animate-pulse" />
            ))
          ) : logs.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-12 text-center text-muted-foreground text-sm">
              No calls logged yet. Use &quot;Log Call&quot; to record a contact.
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
                      </div>
                      {log.summary && (
                        <div className="text-xs text-muted-foreground truncate mt-0.5">{log.summary}</div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {log.created_by && (
                        <span className="text-[9px] font-mono text-muted-foreground/30">
                          {log.created_by === 'Diego' ? '(DC)' : log.created_by === 'Thatcher' ? '(TW)' : log.created_by === 'Trepp' ? '(TG)' : `(${log.created_by.slice(0,2).toUpperCase()})`}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground">{timeAgo(log.created_at)}</span>
                      {isExpanded
                        ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                        : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
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
                      {log.objections && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Objections</div>
                          <div className="text-sm">{log.objections}</div>
                        </div>
                      )}
                      {log.next_step && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Next Step</div>
                          <div className="text-sm">{log.next_step}</div>
                        </div>
                      )}
                      {log.followup_date && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-0.5">Follow-Up Scheduled</div>
                          <div className="text-sm">{new Date(log.followup_date).toLocaleDateString()}</div>
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
        </TabsContent>
      </Tabs>

      <LogCallDialog
        open={logOpen}
        onClose={() => setLogOpen(false)}
        onLogged={() => { loadQueue(); if (tab === 'log') loadLog() }}
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
