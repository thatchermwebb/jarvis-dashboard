'use client'

import { useState, useEffect } from 'react'
import { Plus, X, Send, Save, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import type { AdProductionPriority } from '@/types'

interface AdRow {
  ad_name: string
  format: string
  due_date: string
  assigned_to: string
  priority: AdProductionPriority
  notes: string
  // name builder fields
  biz_short: string
  offer: string
  location_short: string
  human_hook: boolean
  name_overridden: boolean // true if user manually edited ad_name
}

interface Props {
  open: boolean
  onClose: () => void
  clientId: string
  clientName: string
  businessName?: string
  marketLocation?: string
  onSaved?: () => void
}

const AD_FORMATS = ['V300', 'V500', 'Square', 'Story', 'Reel', 'Banner', 'Other']
const ASSIGNEES = ['Thatcher', 'Diego', 'Trepp', 'VA']

function truncate(s?: string): string {
  if (!s) return ''
  return s.trim().split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, '')
}

function buildName(row: AdRow): string {
  const parts = [row.biz_short, row.offer, row.format, row.location_short].filter(Boolean)
  return parts.join('_') + (row.human_hook ? '_HH' : '')
}

function blankRow(businessName?: string, marketLocation?: string): AdRow {
  const d = new Date(); d.setDate(d.getDate() + 3)
  const biz_short = truncate(businessName)
  const location_short = truncate(marketLocation)
  const row: AdRow = {
    ad_name: '', format: 'V300', due_date: d.toISOString().slice(0, 10),
    assigned_to: 'Thatcher', priority: 'med', notes: '',
    biz_short, offer: '', location_short, human_hook: false, name_overridden: false,
  }
  row.ad_name = buildName(row)
  return row
}

function buildSlackMessage(clientName: string, businessName: string | undefined, ads: AdRow[]): string {
  const lines = [
    `🎬 *Ad Production — ${clientName}${businessName ? ` (${businessName})` : ''}*`,
    '',
    '*Ads to produce:*',
    ...ads.filter(a => a.ad_name.trim()).map(a =>
      `• ${a.ad_name} · ${a.format} · Due ${a.due_date || 'TBD'} · Assigned: ${a.assigned_to} · Priority: ${a.priority.toUpperCase()}`
    ),
  ]
  return lines.join('\n')
}

export function AdSetupDialog({ open, onClose, clientId, clientName, businessName, marketLocation, onSaved }: Props) {
  const [ads, setAds] = useState<AdRow[]>([blankRow(businessName, marketLocation)])
  const [slackMsg, setSlackMsg] = useState('')
  const [slackExpanded, setSlackExpanded] = useState(true)
  const [scheduledFor, setScheduledFor] = useState('')
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [msgEdited, setMsgEdited] = useState(false)

  useEffect(() => {
    if (open) {
      const rows = [blankRow(businessName, marketLocation)]
      setAds(rows)
      setSlackMsg(buildSlackMessage(clientName, businessName, rows))
      setScheduledFor('')
      setMsgEdited(false)
    }
  }, [open, clientName, businessName, marketLocation])

  useEffect(() => {
    if (!msgEdited) setSlackMsg(buildSlackMessage(clientName, businessName, ads))
  }, [ads, clientName, businessName, msgEdited])

  function updateAd(idx: number, field: keyof AdRow, value: string | boolean) {
    setAds(prev => prev.map((a, i) => {
      if (i !== idx) return a
      const updated = { ...a, [field]: value }
      // If updating the name directly, mark as overridden
      if (field === 'ad_name') return { ...updated, name_overridden: true }
      // Otherwise auto-rebuild unless user overrode
      if (!updated.name_overridden) updated.ad_name = buildName(updated)
      return updated
    }))
  }

  function addRow() { setAds(prev => [...prev, blankRow(businessName, marketLocation)]) }
  function removeRow(idx: number) { setAds(prev => prev.filter((_, i) => i !== idx)) }

  async function saveAds(): Promise<boolean> {
    const valid = ads.filter(a => a.ad_name.trim())
    if (valid.length === 0) { toast.error('Add at least one ad name'); return false }
    setSaving(true)
    try {
      await Promise.all(valid.map(a =>
        fetch('/api/ad-productions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ad_name: a.ad_name, format: a.format, due_date: a.due_date,
            assigned_to: a.assigned_to, priority: a.priority, notes: a.notes,
            client_id: clientId, status: 'not_started',
          }),
        })
      ))
      return true
    } catch {
      toast.error('Failed to save ads')
      return false
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveOnly() {
    const ok = await saveAds()
    if (ok) { toast.success('Ads saved'); onSaved?.(); onClose() }
  }

  async function handleSendSlack() {
    const ok = await saveAds()
    if (!ok) return
    setSending(true)
    try {
      const res = await fetch('/api/slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: slackMsg, scheduled_for: scheduledFor || undefined }),
      })
      const data = await res.json()
      if (!res.ok) {
        if (data.error?.includes('not configured')) {
          toast.error('Slack webhook not configured — add SLACK_OPERATIONS_WEBHOOK_URL to .env.local')
        } else {
          toast.error(data.error ?? 'Slack send failed')
        }
      } else {
        toast.success(data.scheduled ? 'Ads saved (scheduled send noted)' : 'Sent to #operations ✓')
        onSaved?.(); onClose()
      }
    } catch {
      toast.error('Failed to send to Slack')
    } finally {
      setSending(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60" />
      <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="px-6 py-5 border-b border-border/40 flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Set Up Ad Production</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              {clientName}{businessName ? ` · ${businessName}` : ''}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Ad rows */}
          <div className="space-y-3">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Ads to Produce</div>
            {ads.map((ad, idx) => (
              <div key={idx} className="bg-secondary/30 border border-border/40 rounded-xl p-4 space-y-3">

                {/* Name builder row */}
                <div className="flex items-end gap-2 flex-wrap">
                  <div className="space-y-1 w-24">
                    <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block">Biz</label>
                    <input
                      value={ad.biz_short}
                      onChange={e => updateAd(idx, 'biz_short', e.target.value)}
                      placeholder="HMB"
                      className="w-full bg-secondary/50 border border-border rounded-lg px-2 h-8 text-xs outline-none focus:border-primary/50 font-mono"
                    />
                  </div>
                  <div className="space-y-1 w-24">
                    <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block">Offer</label>
                    <input
                      value={ad.offer}
                      onChange={e => updateAd(idx, 'offer', e.target.value)}
                      placeholder="199"
                      className="w-full bg-secondary/50 border border-border rounded-lg px-2 h-8 text-xs outline-none focus:border-primary/50 font-mono"
                    />
                  </div>
                  <div className="space-y-1 w-24">
                    <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block">Format</label>
                    <select value={ad.format} onChange={e => updateAd(idx, 'format', e.target.value)}
                      className="w-full bg-secondary/50 border border-border rounded-lg px-2 h-8 text-xs outline-none">
                      {AD_FORMATS.map(f => <option key={f} value={f}>{f}</option>)}
                    </select>
                  </div>
                  <div className="space-y-1 w-28">
                    <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block">Location</label>
                    <input
                      value={ad.location_short}
                      onChange={e => updateAd(idx, 'location_short', e.target.value)}
                      placeholder="Austin"
                      className="w-full bg-secondary/50 border border-border rounded-lg px-2 h-8 text-xs outline-none focus:border-primary/50 font-mono"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 cursor-pointer pb-1">
                    <input
                      type="checkbox"
                      checked={ad.human_hook}
                      onChange={e => updateAd(idx, 'human_hook', e.target.checked)}
                      className="rounded accent-primary w-3.5 h-3.5"
                    />
                    <span className="text-xs text-muted-foreground font-mono">HH</span>
                  </label>
                  {ads.length > 1 && (
                    <button onClick={() => removeRow(idx)} className="text-muted-foreground/40 hover:text-red-400 transition-colors pb-1 ml-auto">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Generated name — editable override */}
                <div className="space-y-1">
                  <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block">
                    Ad Name {ad.name_overridden && <span className="text-primary/50 normal-case tracking-normal">(manually edited)</span>}
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      value={ad.ad_name}
                      onChange={e => updateAd(idx, 'ad_name', e.target.value)}
                      className="flex-1 bg-secondary/50 border border-border rounded-lg px-3 h-9 text-sm outline-none focus:border-primary/50 font-mono"
                    />
                    {ad.name_overridden && (
                      <button
                        onClick={() => setAds(prev => prev.map((a, i) => i === idx ? { ...a, name_overridden: false, ad_name: buildName(a) } : a))}
                        className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground whitespace-nowrap transition-colors"
                      >
                        ↺ reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Secondary fields */}
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block mb-1">Due Date</label>
                    <input type="date" value={ad.due_date} onChange={e => updateAd(idx, 'due_date', e.target.value)}
                      className="w-full bg-secondary/50 border border-border rounded-lg px-2 h-8 text-xs outline-none" />
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block mb-1">Assigned</label>
                    <select value={ad.assigned_to} onChange={e => updateAd(idx, 'assigned_to', e.target.value)}
                      className="w-full bg-secondary/50 border border-border rounded-lg px-2 h-8 text-xs outline-none">
                      {ASSIGNEES.map(a => <option key={a} value={a}>{a}</option>)}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block mb-1">Priority</label>
                    <select value={ad.priority} onChange={e => updateAd(idx, 'priority', e.target.value as AdProductionPriority)}
                      className="w-full bg-secondary/50 border border-border rounded-lg px-2 h-8 text-xs outline-none">
                      <option value="low">Low</option>
                      <option value="med">Med</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-muted-foreground/60 uppercase tracking-wider block mb-1">Notes</label>
                    <input
                      value={ad.notes}
                      onChange={e => updateAd(idx, 'notes', e.target.value)}
                      placeholder="Creative direction (optional)"
                      className="w-full bg-secondary/50 border border-border rounded-lg px-2 h-8 text-xs outline-none focus:border-primary/50"
                    />
                  </div>
                </div>
              </div>
            ))}
            <button onClick={addRow} className="flex items-center gap-2 text-sm text-primary/70 hover:text-primary transition-colors">
              <Plus className="w-4 h-4" /> Add another ad
            </button>
          </div>

          {/* Slack message */}
          <div className="border border-border/40 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setSlackExpanded(o => !o)}
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-secondary/20 transition-colors"
            >
              <span className="flex items-center gap-2">
                <span>💬</span> Slack Message — #operations
              </span>
              {slackExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
            </button>
            {slackExpanded && (
              <div className="px-4 pb-4 space-y-3 border-t border-border/30">
                <textarea
                  value={slackMsg}
                  onChange={e => { setSlackMsg(e.target.value); setMsgEdited(true) }}
                  rows={6}
                  className="w-full bg-secondary/30 border border-border/40 rounded-xl px-3 py-2.5 text-sm font-mono outline-none focus:border-primary/50 resize-none mt-3"
                />
                <button
                  type="button"
                  onClick={() => { setMsgEdited(false); setSlackMsg(buildSlackMessage(clientName, businessName, ads)) }}
                  className="text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors"
                >
                  ↺ Reset to auto-generated
                </button>
                <div className="flex items-center gap-3">
                  <Clock className="w-3.5 h-3.5 text-muted-foreground/50 flex-shrink-0" />
                  <input
                    type="datetime-local"
                    value={scheduledFor}
                    onChange={e => setScheduledFor(e.target.value)}
                    className="bg-secondary/30 border border-border/40 rounded-lg px-2.5 h-8 text-xs outline-none text-muted-foreground"
                  />
                  {scheduledFor && (
                    <button onClick={() => setScheduledFor('')} className="text-xs text-muted-foreground/50 hover:text-muted-foreground">Clear</button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border/40 flex items-center gap-3 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button variant="outline" onClick={handleSaveOnly} disabled={saving} className="gap-2">
            <Save className="w-3.5 h-3.5" /> Save Only
          </Button>
          <Button onClick={handleSendSlack} disabled={saving || sending} className="gap-2">
            <Send className="w-3.5 h-3.5" />
            {scheduledFor ? 'Save + Schedule Slack' : 'Save + Send to Slack'}
          </Button>
        </div>
      </div>
    </div>
  )
}
