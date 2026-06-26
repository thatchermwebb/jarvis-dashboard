'use client'

import { useState, useEffect, useRef } from 'react'
import { toast } from 'sonner'
import { Search, X } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Client, LogType, LogOutcome, ClientSentiment } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  client?: Client
  onLogged?: () => void
}

export function LogCallDialog({ open, onClose, client: preselectedClient, onLogged }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [search, setSearch] = useState('')
  const [showDropdown, setShowDropdown] = useState(false)
  const [selectedClient, setSelectedClient] = useState<Client | null>(preselectedClient ?? null)
  const [loading, setLoading] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState({
    log_type: 'call' as LogType,
    outcome: 'answered' as LogOutcome,
    summary: '',
    sentiment: '' as ClientSentiment | '',
    promises_made: '',
    next_step: '',
    followup_date: '',
    created_by: 'Diego',
  })

  useEffect(() => {
    if (open && !preselectedClient) {
      fetch('/api/clients').then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : [])).catch(() => {})
    }
    if (open) {
      setSelectedClient(preselectedClient ?? null)
      setSearch('')
    }
  }, [open, preselectedClient])

  // Reset form on close
  useEffect(() => {
    if (!open) {
      setForm({ log_type: 'call', outcome: 'answered', summary: '', sentiment: '', promises_made: '', next_step: '', followup_date: '', created_by: 'Diego' })
      setSearch('')
      setShowDropdown(false)
    }
  }, [open])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  const filtered = clients.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.business_name ?? '').toLowerCase().includes(search.toLowerCase())
  ).slice(0, 12)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clientId = selectedClient?.id ?? preselectedClient?.id
    if (!clientId) return toast.error('Select a client')
    setLoading(true)
    try {
      const payload = { ...form, client_id: clientId, sentiment: form.sentiment || undefined }
      const res = await fetch('/api/communication-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to log')
      toast.success('Call logged')
      onLogged?.()
      onClose()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setLoading(false)
    }
  }

  const displayName = preselectedClient?.name ?? selectedClient?.name

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[640px] max-w-[95vw] max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl">Log Call / Contact</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5 mt-3">
          {/* Client selector */}
          {preselectedClient ? (
            <div className="bg-secondary/40 rounded-lg px-4 py-3 text-sm">
              Logging for <span className="font-semibold text-foreground">{preselectedClient.name}</span>
              {preselectedClient.business_name && <span className="text-muted-foreground"> · {preselectedClient.business_name}</span>}
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Client</Label>
              <div className="relative">
                <div
                  className={cn('flex items-center gap-2 bg-secondary/50 border border-border rounded-lg px-3 h-11 cursor-text', showDropdown && 'border-primary/50')}
                  onClick={() => { setShowDropdown(true); setTimeout(() => searchRef.current?.focus(), 50) }}
                >
                  <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  {selectedClient && !showDropdown ? (
                    <div className="flex-1 flex items-center justify-between">
                      <span className="text-sm font-medium">{selectedClient.name}</span>
                      <button type="button" onClick={(e) => { e.stopPropagation(); setSelectedClient(null); setSearch('') }} className="text-muted-foreground hover:text-foreground">
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <input
                      ref={searchRef}
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      onFocus={() => setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                      placeholder="Search clients..."
                      className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    />
                  )}
                </div>
                {showDropdown && filtered.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden max-h-56 overflow-y-auto">
                    {filtered.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-4 py-2.5 hover:bg-secondary/60 transition-colors flex items-center justify-between"
                        onMouseDown={() => { setSelectedClient(c); setSearch(''); setShowDropdown(false) }}
                      >
                        <span className="text-sm font-medium">{c.name}</span>
                        {c.business_name && <span className="text-xs text-muted-foreground">{c.business_name}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Type + Outcome */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Type</Label>
              <Select value={form.log_type} onValueChange={v => v && set('log_type', v)}>
                <SelectTrigger className="bg-secondary/50 h-11 text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">📞 Call</SelectItem>
                  <SelectItem value="voicemail">📳 Voicemail</SelectItem>
                  <SelectItem value="text">💬 Text</SelectItem>
                  <SelectItem value="meeting">📅 Meeting</SelectItem>
                  <SelectItem value="note">📝 Note</SelectItem>
                  <SelectItem value="email">✉️ Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Outcome</Label>
              <Select value={form.outcome} onValueChange={v => v && set('outcome', v)}>
                <SelectTrigger className="bg-secondary/50 h-11 text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="answered">✅ Answered</SelectItem>
                  <SelectItem value="voicemail">📳 Left Voicemail</SelectItem>
                  <SelectItem value="texted">💬 Texted</SelectItem>
                  <SelectItem value="no_answer">❌ No Answer</SelectItem>
                  <SelectItem value="meeting_booked">📅 Meeting Booked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">Summary / Notes</Label>
            <Textarea
              value={form.summary}
              onChange={e => set('summary', e.target.value)}
              placeholder="What happened? What did they say? Key points..."
              className="bg-secondary/50 h-28 text-base resize-none"
            />
          </div>

          {/* Sentiment + Follow-up */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Client Sentiment</Label>
              <Select value={form.sentiment} onValueChange={v => v && set('sentiment', v)}>
                <SelectTrigger className="bg-secondary/50 h-11 text-base"><SelectValue placeholder="Mood..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="happy">😊 Happy</SelectItem>
                  <SelectItem value="neutral">😐 Neutral</SelectItem>
                  <SelectItem value="confused">😕 Confused</SelectItem>
                  <SelectItem value="concerned">😟 Concerned</SelectItem>
                  <SelectItem value="frustrated">😤 Frustrated</SelectItem>
                  <SelectItem value="angry">😠 Angry</SelectItem>
                  <SelectItem value="ghosting">👻 Ghosting</SelectItem>
                  <SelectItem value="close_ready">🎯 Close-Ready</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Follow-Up Date</Label>
              <Input type="date" value={form.followup_date} onChange={e => set('followup_date', e.target.value)} className="bg-secondary/50 h-11 text-base" />
            </div>
          </div>

          {/* Promises + Next Step */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Promises Made</Label>
              <Input value={form.promises_made} onChange={e => set('promises_made', e.target.value)} placeholder="What was promised?" className="bg-secondary/50 h-11 text-base" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Next Step</Label>
              <Input value={form.next_step} onChange={e => set('next_step', e.target.value)} placeholder="What needs to happen next?" className="bg-secondary/50 h-11 text-base" />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? 'Logging...' : 'Log Contact'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
