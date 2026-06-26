'use client'

import { useState, useEffect, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft, Edit, Phone, ExternalLink, Star, Wrench, CreditCard,
  AlertTriangle, TrendingDown, CheckCircle, Bot, Plus, Clock,
  MessageSquare, Calendar
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { ClientForm } from '@/components/clients/ClientForm'
import { LogCallDialog } from '@/components/clients/LogCallDialog'
import { TaskPanel } from '@/components/tasks/TaskPanel'
import { PaymentPanel } from '@/components/payments/PaymentPanel'
import { BriefGenerator } from '@/components/briefs/BriefGenerator'
import { JARVISPanel } from '@/components/assistant/JARVISPanel'
import {
  cn, stageLabel, stageColor, sentimentEmoji, sentimentColor,
  cplStatusColor, timeAgo, formatDate, formatCurrency, urgencyColor
} from '@/lib/utils'
import { getTrialHealthLabel, getChurnRiskLabel } from '@/lib/scoring'
import type { Client, CommunicationLog } from '@/types'

function Field({ label, value, mono = false }: { label: string; value?: string | number | null; mono?: boolean }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</div>
      <div className={cn('text-sm text-foreground', mono && 'font-mono')}>{value}</div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h3>
      {children}
    </div>
  )
}

export default function ClientWarRoom() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [logs, setLogs] = useState<CommunicationLog[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [jarvisOpen, setJarvisOpen] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)
  const [updating, setUpdating] = useState(false)

  const load = useCallback(async () => {
    const [clientRes, logsRes] = await Promise.all([
      fetch(`/api/clients/${id}`),
      fetch(`/api/communication-logs?client_id=${id}`),
    ])
    if (!clientRes.ok) { router.push('/clients'); return }
    const [clientData, logsData] = await Promise.all([clientRes.json(), logsRes.json()])
    setClient(clientData)
    setLogs(Array.isArray(logsData) ? logsData : [])
  }, [id, router])

  useEffect(() => { load() }, [load])

  async function quickUpdate(field: Partial<Client>) {
    if (!client) return
    setUpdating(true)
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(field),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      setClient(updated)
      toast.success('Updated')
    } catch {
      toast.error('Failed to update')
    } finally {
      setUpdating(false)
    }
  }

  if (!client) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground text-sm animate-pulse">Loading client...</div>
      </div>
    )
  }

  const trialDaysLeft = client.trial_end
    ? Math.ceil((new Date(client.trial_end).getTime() - Date.now()) / 86400000)
    : null

  const LOG_TYPE_ICON = {
    call: <Phone className="w-3 h-3" />,
    voicemail: <Phone className="w-3 h-3 opacity-50" />,
    text: <MessageSquare className="w-3 h-3" />,
    meeting: <Calendar className="w-3 h-3" />,
    note: <MessageSquare className="w-3 h-3" />,
    email: <MessageSquare className="w-3 h-3" />,
  }

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" className="gap-1.5 h-8 text-xs -ml-1" onClick={() => router.back()}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{client.name}</h1>
              <Badge variant="outline" className={cn(stageColor(client.stage))}>
                {stageLabel(client.stage)}
              </Badge>
              {client.payment_issue && (
                <Badge variant="outline" className="bg-red-500/20 text-red-300 border-red-500/30">
                  💳 Payment Issue
                </Badge>
              )}
              {client.thatcher_needed && (
                <Badge variant="outline" className="bg-amber-500/20 text-amber-300 border-amber-500/30">
                  ⭐ Thatcher Needed
                </Badge>
              )}
            </div>
            {(client.business_name || client.market_location) && (
              <div className="text-sm text-muted-foreground mt-0.5">
                {[client.business_name, client.market_location, client.timezone].filter(Boolean).join(' · ')}
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setLogOpen(true)}>
              <Phone className="w-3 h-3" /> Log Call
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setJarvisOpen(true)}>
              <Bot className="w-3 h-3" /> JARVIS
            </Button>
            {(client.stage === 'free_trial' || client.stage === 'trial_ending_soon') && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-violet-500/30 text-violet-300 hover:bg-violet-500/10" onClick={() => setBriefOpen(true)}>
                <Star className="w-3 h-3" /> Close Brief
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setEditOpen(true)}>
              <Edit className="w-3 h-3" /> Edit
            </Button>
          </div>
        </div>

        {/* Quick action chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => quickUpdate({ thatcher_needed: !client.thatcher_needed })}
            className={cn('text-xs px-3 py-1.5 rounded-full border transition-all', client.thatcher_needed ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' : 'border-border text-muted-foreground hover:border-amber-500/30 hover:text-amber-300')}
            disabled={updating}
          >
            ⭐ Needs Thatcher
          </button>
          <button
            onClick={() => quickUpdate({ va_needed: !client.va_needed })}
            className={cn('text-xs px-3 py-1.5 rounded-full border transition-all', client.va_needed ? 'bg-blue-500/20 border-blue-500/30 text-blue-300' : 'border-border text-muted-foreground hover:border-blue-500/30')}
            disabled={updating}
          >
            🔧 VA Needed
          </button>
          <button
            onClick={() => quickUpdate({ payment_issue: !client.payment_issue })}
            className={cn('text-xs px-3 py-1.5 rounded-full border transition-all', client.payment_issue ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'border-border text-muted-foreground hover:border-red-500/30')}
            disabled={updating}
          >
            💳 Payment Issue
          </button>
          <button
            onClick={() => quickUpdate({ last_client_sentiment: 'close_ready' })}
            className={cn('text-xs px-3 py-1.5 rounded-full border transition-all', client.last_client_sentiment === 'close_ready' ? 'bg-violet-500/20 border-violet-500/30 text-violet-300' : 'border-border text-muted-foreground hover:border-violet-500/30')}
            disabled={updating}
          >
            🎯 Mark Close-Ready
          </button>
          <button
            onClick={() => quickUpdate({ stage: client.stage === 'active_client' ? 'active_client' : 'active_client' })}
            className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:border-emerald-500/30 hover:text-emerald-300 transition-all"
            disabled={updating}
          >
            ✅ Push to Active
          </button>
        </div>

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left column — snapshot + metrics */}
          <div className="lg:col-span-2 space-y-4">
            {/* Snapshot */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-4">
              <Section title="Contact">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Phone" value={client.phone} />
                  <Field label="Email" value={client.email} />
                  <Field label="Owner Name" value={client.owner_name} />
                  <Field label="Timezone" value={client.timezone} />
                </div>
              </Section>

              <Separator className="bg-border" />

              <Section title="Deal">
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Monthly Retainer" value={client.monthly_retainer ? formatCurrency(client.monthly_retainer) : null} />
                  <Field label="Payment" value={client.payment_frequency} />
                  <Field label="Payment Status" value={client.payment_status} />
                  <Field label="Assigned VA" value={client.assigned_va} />
                </div>
                {client.deal_notes && (
                  <div className="text-xs text-muted-foreground bg-secondary/30 rounded-md px-3 py-2 mt-2">
                    {client.deal_notes}
                  </div>
                )}
              </Section>

              {client.trial_start && (
                <>
                  <Separator className="bg-border" />
                  <Section title="Trial">
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Trial Start" value={formatDate(client.trial_start)} />
                      <Field label="Trial End" value={formatDate(client.trial_end)} />
                    </div>
                    {trialDaysLeft !== null && (
                      <div className={cn(
                        'text-sm font-medium',
                        trialDaysLeft <= 0 ? 'text-red-400' : trialDaysLeft <= 2 ? 'text-orange-400' : 'text-muted-foreground'
                      )}>
                        {trialDaysLeft <= 0 ? '🔥 Trial ended' : trialDaysLeft === 1 ? '⚡ Ends tomorrow' : `${trialDaysLeft} days left`}
                      </div>
                    )}
                    {client.trial_health_score != null && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Trial Health</span>
                          <span className="text-xs font-medium">{getTrialHealthLabel(client.trial_health_score)} · {client.trial_health_score}/100</span>
                        </div>
                        <Progress value={client.trial_health_score} className="h-1.5" />
                      </div>
                    )}
                    {client.close_probability != null && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Close Probability</span>
                          <span className="text-xs font-medium">{client.close_probability}%</span>
                        </div>
                        <Progress value={client.close_probability} className="h-1.5" />
                      </div>
                    )}
                  </Section>
                </>
              )}

              {/* Links */}
              <Separator className="bg-border" />
              <div className="flex items-center gap-2 flex-wrap">
                {client.ghl_location_link && (
                  <a href={client.ghl_location_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> GHL
                  </a>
                )}
                {client.ad_account_link && (
                  <a href={client.ad_account_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Ad Account
                  </a>
                )}
                {client.slack_thread && (
                  <a href={client.slack_thread} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Slack
                  </a>
                )}
                {client.google_drive_folder && (
                  <a href={client.google_drive_folder} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <ExternalLink className="w-3 h-3" /> Drive
                  </a>
                )}
              </div>
            </div>

            {/* Ad performance */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-4">
              <Section title="Ad Performance">
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <div className={cn('text-xl font-bold', cplStatusColor(client.cpl))}>
                      {client.cpl != null ? `$${client.cpl}` : '—'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">CPL</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-foreground">{client.leads ?? '—'}</div>
                    <div className="text-[10px] text-muted-foreground">Leads</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-foreground">{client.phone_numbers_collected ?? '—'}</div>
                    <div className="text-[10px] text-muted-foreground">Phone #s</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-foreground">{client.bookings ?? '—'}</div>
                    <div className="text-[10px] text-muted-foreground">Bookings</div>
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-foreground">
                      {client.spend != null ? `$${client.spend}` : '—'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Spend</div>
                  </div>
                  <div className="text-center">
                    <div className={cn('text-lg font-bold', client.ad_status === 'live' ? 'text-emerald-400' : client.ad_status === 'off' ? 'text-red-400' : 'text-muted-foreground')}>
                      {client.ad_status ?? '—'}
                    </div>
                    <div className="text-[10px] text-muted-foreground">Ad Status</div>
                  </div>
                </div>
                {client.new_ads !== null && (
                  <div className={cn('text-xs px-2 py-1 rounded-md w-fit', client.new_ads ? 'bg-emerald-500/10 text-emerald-300' : 'bg-secondary text-muted-foreground')}>
                    {client.new_ads ? '✓ New ads running' : 'Old ads running'}
                  </div>
                )}
                {client.location_targeting && (
                  <Field label="Location Targeting" value={client.location_targeting} />
                )}
              </Section>
            </div>
          </div>

          {/* Right column — communication + tabs */}
          <div className="lg:col-span-3 space-y-4">
            {/* Current situation */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-3">
              <Section title="Current Situation">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Sentiment</div>
                    <div className={cn('text-sm font-medium', sentimentColor(client.last_client_sentiment))}>
                      {sentimentEmoji(client.last_client_sentiment)} {client.last_client_sentiment ?? '—'}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Last Contact</div>
                    <div className="text-sm text-foreground">{timeAgo(client.last_contact_date)}</div>
                  </div>
                </div>
                {client.last_call_summary && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Last Summary</div>
                    <div className="text-sm text-foreground/90 bg-secondary/30 rounded-md px-3 py-2">
                      {client.last_call_summary}
                    </div>
                  </div>
                )}
                {client.promises_made && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Promises Made</div>
                    <div className="text-sm text-amber-300">{client.promises_made}</div>
                  </div>
                )}
                {client.objections && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Objections</div>
                    <div className="text-sm text-orange-300">{client.objections}</div>
                  </div>
                )}
                {client.next_followup_date && (
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Follow-up:</span>
                    <span className={new Date(client.next_followup_date) < new Date() ? 'text-red-400' : 'text-foreground'}>
                      {formatDate(client.next_followup_date)}
                    </span>
                    {client.followup_reason && (
                      <span className="text-muted-foreground">· {client.followup_reason}</span>
                    )}
                  </div>
                )}
                {client.suggested_message && (
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Suggested Message</div>
                    <div className="text-sm text-violet-300 italic bg-violet-500/10 border border-violet-500/20 rounded-md px-3 py-2">
                      "{client.suggested_message}"
                    </div>
                  </div>
                )}
              </Section>
            </div>

            {/* Tabs */}
            <Tabs defaultValue="history">
              <TabsList className="bg-secondary/50 border border-border">
                <TabsTrigger value="history" className="text-xs">Call History</TabsTrigger>
                <TabsTrigger value="payments" className="text-xs">Payments</TabsTrigger>
                <TabsTrigger value="tasks" className="text-xs">VA Tasks</TabsTrigger>
                <TabsTrigger value="risk" className="text-xs">Risk & Scores</TabsTrigger>
              </TabsList>

              <TabsContent value="history" className="mt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-muted-foreground">{logs.length} entries</span>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setLogOpen(true)}>
                    <Plus className="w-3 h-3" /> Log
                  </Button>
                </div>
                {logs.length === 0 ? (
                  <div className="bg-card border border-border rounded-xl p-6 text-center text-xs text-muted-foreground">
                    No communication logged yet.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {logs.map((log) => (
                      <div key={log.id} className="bg-card border border-border rounded-xl px-4 py-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            {LOG_TYPE_ICON[log.log_type as keyof typeof LOG_TYPE_ICON]}
                            <span className="capitalize">{log.log_type}</span>
                            {log.outcome && <span>· {log.outcome.replace('_', ' ')}</span>}
                            {log.sentiment && (
                              <span className={sentimentColor(log.sentiment)}>
                                · {sentimentEmoji(log.sentiment)}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{timeAgo(log.created_at)}</span>
                        </div>
                        {log.summary && (
                          <div className="text-sm text-foreground/90 mt-1.5">{log.summary}</div>
                        )}
                        {log.next_step && (
                          <div className="text-xs text-violet-400 mt-1">Next: {log.next_step}</div>
                        )}
                        {log.promises_made && (
                          <div className="text-xs text-amber-400 mt-0.5">Promise: {log.promises_made}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="payments" className="mt-3">
                <PaymentPanel clientId={client.id} clientName={client.name} />
              </TabsContent>

              <TabsContent value="tasks" className="mt-3">
                <TaskPanel clientId={id} />
              </TabsContent>

              <TabsContent value="risk" className="mt-3">
                <div className="bg-card border border-border rounded-xl p-4 space-y-4">
                  <Section title="Risk Assessment">
                    <div className="grid grid-cols-2 gap-3">
                      {client.churn_risk_score != null && (
                        <div>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs text-muted-foreground">Churn Risk</span>
                            <span className="text-xs">{getChurnRiskLabel(client.churn_risk_score)}</span>
                          </div>
                          <Progress value={client.churn_risk_score} className="h-1.5" />
                        </div>
                      )}
                    </div>
                    {client.risk_reason && <Field label="Risk Reason" value={client.risk_reason} />}
                    {client.save_action && <Field label="Save Action" value={client.save_action} />}
                    <div className="flex gap-2 text-xs">
                      <div className={cn('px-2 py-1 rounded', client.urgency_level === 'critical' ? 'bg-red-500/20 text-red-300' : client.urgency_level === 'high' ? 'bg-orange-500/20 text-orange-300' : 'bg-secondary text-muted-foreground')}>
                        Urgency: {client.urgency_level ?? 'low'}
                      </div>
                    </div>
                  </Section>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <ClientForm open={editOpen} onClose={() => setEditOpen(false)} client={client} onSaved={(updated) => setClient(updated)} />
      <LogCallDialog open={logOpen} onClose={() => setLogOpen(false)} client={client} onLogged={load} />
      <JARVISPanel open={jarvisOpen} onClose={() => setJarvisOpen(false)} clientName={client.name} />
      <BriefGenerator open={briefOpen} onClose={() => setBriefOpen(false)} client={client} />
    </>
  )
}
