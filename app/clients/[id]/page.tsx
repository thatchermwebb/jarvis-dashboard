'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  ArrowLeft, ArrowRight, Edit, Phone, ExternalLink, Star, Wrench, CreditCard,
  AlertTriangle, TrendingDown, CheckCircle, Bot, Plus, Clock,
  MessageSquare, Calendar, ChevronDown, Trash2, Pencil, Clapperboard
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { ClientForm } from '@/components/clients/ClientForm'
import { LogCallDialog } from '@/components/clients/LogCallDialog'
import { AdSetupDialog } from '@/components/ad-production/AdSetupDialog'
import { ScheduleCallDialog } from '@/components/clients/ScheduleCallDialog'
import { PaymentPanel } from '@/components/payments/PaymentPanel'
import { BriefGenerator } from '@/components/briefs/BriefGenerator'
import { JARVISPanel } from '@/components/assistant/JARVISPanel'
import {
  cn, stageLabel, stageColor, sentimentEmoji, sentimentColor,
  cplStatusColor, timeAgo, formatDate, formatCurrency, urgencyColor,
  daysUntil,
} from '@/lib/utils'
import { getTrialHealthLabel, getChurnRiskLabel, calculatePriorityScore, getScoreBreakdown } from '@/lib/scoring'
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

const STAGE_OPTIONS: { value: import('@/types').ClientStage; label: string; color: string; dot: string }[] = [
  { value: 'active_client',      label: 'Active',                color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20 hover:bg-emerald-500/20', dot: 'bg-emerald-400' },
  { value: 'trial_concluded',    label: 'Free Trial (Complete)',  color: 'text-teal-300 bg-teal-500/10 border-teal-500/20 hover:bg-teal-500/20',           dot: 'bg-teal-400'    },
  { value: 'free_trial',         label: 'Free Trial (Active)',    color: 'text-violet-300 bg-violet-500/10 border-violet-500/20 hover:bg-violet-500/20',   dot: 'bg-violet-400'  },
  { value: 'free_trial_pending', label: 'Free Trial (Pending)',   color: 'text-amber-300 bg-amber-500/10 border-amber-500/20 hover:bg-amber-500/20',       dot: 'bg-amber-400'   },
  { value: 'onboarding',         label: 'Onboarding',             color: 'text-blue-300 bg-blue-500/10 border-blue-500/20 hover:bg-blue-500/20',           dot: 'bg-blue-400'    },
  { value: 'overdue',            label: 'Overdue',                color: 'text-red-300 bg-red-500/10 border-red-500/20 hover:bg-red-500/20',               dot: 'bg-red-400'     },
  { value: 'paused',             label: 'Paused',                 color: 'text-slate-300 bg-slate-500/10 border-slate-500/20 hover:bg-slate-500/20',       dot: 'bg-slate-400'   },
  { value: 'churned',            label: 'Churned',                color: 'text-slate-400 bg-slate-700/10 border-slate-700/20 hover:bg-slate-700/20',       dot: 'bg-slate-500'   },
  { value: 'free_trial_lost',    label: 'Free Trial (Lost)',      color: 'text-slate-400 bg-slate-700/10 border-slate-700/20 hover:bg-slate-700/20',       dot: 'bg-slate-500'   },
]

export default function ClientWarRoom() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const [client, setClient] = useState<Client | null>(null)
  const [logs, setLogs] = useState<CommunicationLog[]>([])
  const [editOpen, setEditOpen] = useState(false)
  const [logOpen, setLogOpen] = useState(false)
  const [scheduleOpen, setScheduleOpen] = useState(false)
  const [jarvisOpen, setJarvisOpen] = useState(false)
  const [briefOpen, setBriefOpen] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [stagePickerOpen, setStagePickerOpen] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [editingLog, setEditingLog] = useState<CommunicationLog | null>(null)
  const [adSetupOpen, setAdSetupOpen] = useState(false)
  const stagePickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (stagePickerRef.current && !stagePickerRef.current.contains(e.target as Node)) {
        setStagePickerOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

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

  async function deleteLog(logId: string) {
    await fetch(`/api/communication-logs/${logId}`, { method: 'DELETE' })
    setLogs(prev => prev.filter(l => l.id !== logId))
  }

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

  const trialDaysLeft = client.trial_end ? daysUntil(client.trial_end) : null

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
          {/* Back / Forward nav */}
          <div className="flex items-center gap-1 -ml-1 flex-shrink-0">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => router.back()} title="Go back">
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => router.forward()} title="Go forward">
              <ArrowRight className="w-4 h-4" />
            </Button>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-foreground">{client.name}</h1>

              {/* Inline stage picker */}
              <div className="relative" ref={stagePickerRef}>
                <button
                  onClick={() => setStagePickerOpen(o => !o)}
                  className={cn(
                    'flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full border transition-all',
                    stageColor(client.stage)
                  )}
                >
                  {stageLabel(client.stage)}
                  <ChevronDown className={cn('w-3 h-3 transition-transform', stagePickerOpen && 'rotate-180')} />
                </button>
                {stagePickerOpen && (
                  <div className="absolute top-full left-0 mt-1.5 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden min-w-[200px]">
                    {STAGE_OPTIONS.map(opt => (
                      <button
                        key={opt.value}
                        className={cn(
                          'w-full flex items-center gap-2.5 px-3 py-2.5 text-left text-xs transition-colors border-b border-border/50 last:border-0',
                          opt.value === client.stage ? opt.color : 'text-muted-foreground hover:bg-secondary/50 hover:text-foreground'
                        )}
                        onClick={async () => {
                          setStagePickerOpen(false)
                          await quickUpdate({ stage: opt.value })
                        }}
                      >
                        <span className={cn('w-2 h-2 rounded-full flex-shrink-0', opt.dot)} />
                        {opt.label}
                        {opt.value === client.stage && <span className="ml-auto text-[10px] opacity-60">current</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>

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
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setScheduleOpen(true)}>
              <Calendar className="w-3 h-3" /> Schedule Call
            </Button>
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setJarvisOpen(true)}>
              <Bot className="w-3 h-3" /> JARVIS
            </Button>
            {(client.stage === 'free_trial' || client.stage === 'trial_ending_soon') && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-violet-500/30 text-violet-300 hover:bg-violet-500/10" onClick={() => setBriefOpen(true)}>
                <Star className="w-3 h-3" /> Close Brief
              </Button>
            )}
            {client.stage === 'onboarding' && (
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-blue-500/30 text-blue-300 hover:bg-blue-500/10" onClick={() => setAdSetupOpen(true)}>
                <Clapperboard className="w-3 h-3" /> Set Up Ads
              </Button>
            )}
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setEditOpen(true)}>
              <Edit className="w-3 h-3" /> Edit
            </Button>
            {deleteConfirm ? (
              <div className="flex items-center gap-1">
                <span className="text-xs text-red-400">Delete client?</span>
                <Button size="sm" variant="outline" className="h-8 text-xs border-red-500/40 text-red-400 hover:bg-red-950/30"
                  onClick={async () => {
                    await fetch(`/api/clients/${id}`, { method: 'DELETE' })
                    router.push('/clients')
                  }}>
                  Yes, delete
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setDeleteConfirm(false)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground/40 hover:text-red-400 hover:bg-red-950/20 gap-1" onClick={() => setDeleteConfirm(true)}>
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Quick action chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => quickUpdate({ payment_issue: !client.payment_issue })}
            className={cn('text-xs px-3 py-1.5 rounded-full border transition-all', client.payment_issue ? 'bg-red-500/20 border-red-500/30 text-red-300' : 'border-border text-muted-foreground hover:border-red-500/30 hover:text-red-300')}
            disabled={updating}
          >
            💳 Payment Issue
          </button>
          <button
            onClick={() => quickUpdate({ thatcher_needed: !client.thatcher_needed })}
            className={cn('text-xs px-3 py-1.5 rounded-full border transition-all', client.thatcher_needed ? 'bg-amber-500/20 border-amber-500/30 text-amber-300' : 'border-border text-muted-foreground hover:border-amber-500/30 hover:text-amber-300')}
            disabled={updating}
          >
            ⭐ Thatcher Needed
          </button>
          <button
            onClick={() => quickUpdate({ urgency_level: client.urgency_level === 'high' || client.urgency_level === 'critical' ? 'low' : 'high' })}
            className={cn('text-xs px-3 py-1.5 rounded-full border transition-all', (client.urgency_level === 'high' || client.urgency_level === 'critical') ? 'bg-orange-500/20 border-orange-500/30 text-orange-300' : 'border-border text-muted-foreground hover:border-orange-500/30 hover:text-orange-300')}
            disabled={updating}
          >
            🔔 Needs Attention
          </button>
          <button
            onClick={() => quickUpdate({ va_needed: !client.va_needed })}
            className={cn('text-xs px-3 py-1.5 rounded-full border transition-all', client.va_needed ? 'bg-blue-500/20 border-blue-500/30 text-blue-300' : 'border-border text-muted-foreground hover:border-blue-500/30 hover:text-blue-300')}
            disabled={updating}
          >
            🎓 Needs Coaching
          </button>
          <button
            onClick={() => quickUpdate({ new_ads: !client.new_ads })}
            className={cn('text-xs px-3 py-1.5 rounded-full border transition-all', client.new_ads ? 'bg-violet-500/20 border-violet-500/30 text-violet-300' : 'border-border text-muted-foreground hover:border-violet-500/30 hover:text-violet-300')}
            disabled={updating}
          >
            📣 Needs Ads
          </button>
          <button
            onClick={() => quickUpdate({ stage: 'churn_risk' })}
            className={cn('text-xs px-3 py-1.5 rounded-full border transition-all', client.stage === 'churn_risk' ? 'bg-rose-500/20 border-rose-500/30 text-rose-300' : 'border-border text-muted-foreground hover:border-rose-500/30 hover:text-rose-300')}
            disabled={updating}
          >
            📉 Churn Risk
          </button>
        </div>

        {/* Main two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          {/* Left column — snapshot + metrics */}
          <div className="lg:col-span-2 space-y-4">
            {/* Snapshot */}
            <div className="bg-card border border-border rounded-xl p-4 space-y-4">
              <Section title="Contact">
                <div className="space-y-2.5">
                  <Field label="Phone" value={client.phone} />
                  <div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Email</div>
                    <div className="text-sm text-foreground break-all">{client.email ?? '—'}</div>
                  </div>
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
                {(client.ad_status || client.campaign_link || client.ad_account_link || client.budget != null || client.spend != null) && (
                  <>
                    <div className="border-t border-border my-2" />
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">Ad Info</div>
                    <div className="grid grid-cols-2 gap-3">
                      <Field label="Ad Status" value={client.ad_status} />
                      <Field label="Budget" value={client.budget ? formatCurrency(client.budget) : null} />
                      <Field label="Spend" value={client.spend ? formatCurrency(client.spend) : null} />
                      <Field label="CPL" value={client.cpl ? `$${client.cpl}` : null} />
                    </div>
                    {client.campaign_link && (
                      <a href={client.campaign_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-1">
                        <ExternalLink className="w-3 h-3" /> Campaign Link
                      </a>
                    )}
                    {client.ad_account_link && (
                      <a href={client.ad_account_link} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1 mt-0.5">
                        <ExternalLink className="w-3 h-3" /> Ad Account
                      </a>
                    )}
                  </>
                )}
                {client.deal_notes && (
                  <>
                    <div className="border-t border-border my-2" />
                    <div className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1.5">Deal Notes</div>
                    <div className="text-xs text-muted-foreground bg-secondary/30 rounded-md px-3 py-2">
                      {client.deal_notes}
                    </div>
                  </>
                )}
              </Section>

              {client.trial_start && ['free_trial','trial_ending_soon','onboarding'].includes(client.stage) && (
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
                        {trialDaysLeft <= 0 ? '🚨 Trial ended' : trialDaysLeft <= 2 ? `⏰ Ends ${trialDaysLeft === 1 ? 'tomorrow' : `in ${trialDaysLeft} days`}` : `${trialDaysLeft} days left`}
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

            {/* Next Step card */}
            <div className={cn(
              'border rounded-xl p-4 space-y-3',
              client.next_followup_date ? 'bg-card border-border' : 'bg-secondary/20 border-border/40'
            )}>
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Next Step</span>
                <button
                  onClick={() => setLogOpen(true)}
                  className="text-[10px] text-primary hover:text-primary/80 transition-colors font-medium"
                >
                  + Log Call
                </button>
              </div>

              {client.next_followup_date ? (() => {
                const d = daysUntil(client.next_followup_date)
                const overdue = d !== null && d < 0
                const isToday = d === 0
                const isTomorrow = d === 1
                const dateLabel = overdue
                  ? `${Math.abs(d!)} day${Math.abs(d!) !== 1 ? 's' : ''} overdue`
                  : isToday ? 'Today'
                  : isTomorrow ? 'Tomorrow'
                  : d !== null ? `In ${d} days`
                  : formatDate(client.next_followup_date)
                return (
                  <>
                    <div>
                      <div className={cn(
                        'text-xl font-bold leading-tight',
                        overdue ? 'text-red-400' : isToday ? 'text-amber-400' : 'text-foreground'
                      )}>
                        {formatDate(client.next_followup_date)}
                      </div>
                      <div className={cn(
                        'text-xs font-medium mt-0.5',
                        overdue ? 'text-red-400' : isToday ? 'text-amber-400' : 'text-muted-foreground'
                      )}>
                        {overdue && '⚠ '}{dateLabel}
                      </div>
                    </div>
                    {client.followup_reason && (
                      <div className="text-sm text-foreground/80 bg-secondary/30 rounded-lg px-3 py-2">
                        {client.followup_reason}
                      </div>
                    )}
                  </>
                )
              })() : (
                <div className="text-sm text-muted-foreground/50 py-1">No next step scheduled</div>
              )}
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
                    <span className={new Date(client.next_followup_date + 'T00:00:00') < new Date() ? 'text-red-400' : 'text-foreground'}>
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
              <TabsList className="bg-secondary/50 border border-border h-11 gap-1 px-1">
                <TabsTrigger value="history" className="text-sm px-5 h-9">History</TabsTrigger>
                <TabsTrigger value="payments" className="text-sm px-5 h-9">Payments</TabsTrigger>
                <TabsTrigger value="risk" className="text-sm px-5 h-9">Risk & Scores</TabsTrigger>
              </TabsList>

              <TabsContent value="history" className="mt-3 space-y-2">
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">{logs.length} entries</span>
                    <a
                      href={`/calls?client_id=${client?.id}`}
                      className="text-xs text-muted-foreground/50 hover:text-primary transition-colors flex items-center gap-1"
                    >
                      View all <ArrowRight className="w-3 h-3" />
                    </a>
                  </div>
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
                      <div key={log.id} className="bg-card border border-border rounded-xl px-4 py-3 group">
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
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {log.created_by && (
                              <span className="text-[9px] font-mono text-muted-foreground/30">
                                {log.created_by === 'Diego' ? '(DC)' : log.created_by === 'Thatcher' ? '(TW)' : `(${log.created_by.slice(0,2).toUpperCase()})`}
                              </span>
                            )}
                            <span className="text-[10px] text-muted-foreground">{timeAgo(log.created_at)}</span>
                            <button
                              onClick={() => setEditingLog(log)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-foreground transition-all"
                            >
                              <Pencil className="w-3 h-3" />
                            </button>
                            <button
                              onClick={() => deleteLog(log.id)}
                              className="opacity-0 group-hover:opacity-100 text-muted-foreground/40 hover:text-red-400 transition-all"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
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

              <TabsContent value="risk" className="mt-3 space-y-3">
                {/* Priority Score breakdown */}
                {(() => {
                  const score = calculatePriorityScore(client)
                  const factors = getScoreBreakdown(client)
                  const maxPoints = 80
                  return (
                    <div className="bg-card border border-border rounded-xl p-4 space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Priority Score</div>
                          <div className={cn(
                            'text-3xl font-bold',
                            score >= 100 ? 'text-red-400' : score >= 60 ? 'text-orange-400' : score >= 30 ? 'text-amber-400' : 'text-muted-foreground'
                          )}>{score}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">Urgency</div>
                          <div className={cn('text-sm font-medium capitalize',
                            client.urgency_level === 'critical' ? 'text-red-400' :
                            client.urgency_level === 'high' ? 'text-orange-400' : 'text-muted-foreground'
                          )}>
                            {client.urgency_level ?? 'low'}
                          </div>
                        </div>
                      </div>

                      {factors.length === 0 ? (
                        <div className="text-xs text-muted-foreground/50 py-2">No active risk factors.</div>
                      ) : (
                        <div className="space-y-2">
                          <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Contributing factors</div>
                          {factors.map((f, i) => (
                            <div key={i} className="flex items-center gap-2.5">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-0.5">
                                  <span className="text-xs text-foreground/80 truncate">{f.label}</span>
                                  <span className="text-[11px] font-mono text-muted-foreground ml-2 flex-shrink-0">+{f.points}</span>
                                </div>
                                <div className="h-1 bg-secondary rounded-full overflow-hidden">
                                  <div
                                    className={cn('h-full rounded-full transition-all', f.points >= 60 ? 'bg-red-400' : f.points >= 35 ? 'bg-orange-400' : f.points >= 20 ? 'bg-amber-400' : 'bg-muted-foreground/40')}
                                    style={{ width: `${Math.min(100, (f.points / maxPoints) * 100)}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })()}

                {/* Churn risk score if set */}
                {(client.churn_risk_score != null || client.risk_reason || client.save_action) && (
                  <div className="bg-card border border-border rounded-xl p-4 space-y-3">
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Churn Assessment</div>
                    {client.churn_risk_score != null && (
                      <div>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-muted-foreground">Churn Risk Score</span>
                          <span className="text-xs font-medium">{getChurnRiskLabel(client.churn_risk_score)} · {client.churn_risk_score}/100</span>
                        </div>
                        <Progress value={client.churn_risk_score} className="h-1.5" />
                      </div>
                    )}
                    {client.risk_reason && <Field label="Risk Reason" value={client.risk_reason} />}
                    {client.save_action && <Field label="Save Action" value={client.save_action} />}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <ClientForm open={editOpen} onClose={() => setEditOpen(false)} client={client} onSaved={(updated) => setClient(updated)} />
      <LogCallDialog open={logOpen} onClose={() => setLogOpen(false)} client={client} onLogged={load} />
      <LogCallDialog open={!!editingLog} onClose={() => setEditingLog(null)} editLog={editingLog ? { ...editingLog, log_type: editingLog.log_type ?? 'call', outcome: editingLog.outcome ?? 'answered' } : undefined} onLogged={() => { setEditingLog(null); load() }} />
      <AdSetupDialog open={adSetupOpen} onClose={() => setAdSetupOpen(false)} clientId={client.id} clientName={client.name} businessName={client.business_name} marketLocation={client.market_location} onSaved={load} />
      <ScheduleCallDialog open={scheduleOpen} onClose={() => setScheduleOpen(false)} client={client} onSaved={load} />
      <JARVISPanel open={jarvisOpen} onClose={() => setJarvisOpen(false)} clientName={client.name} />
      <BriefGenerator open={briefOpen} onClose={() => setBriefOpen(false)} client={client} />
    </>
  )
}
