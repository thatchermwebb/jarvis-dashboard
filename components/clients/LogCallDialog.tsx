'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import type { Client, LogType, LogOutcome, ClientSentiment } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  client?: Client
  onLogged?: () => void
}

export function LogCallDialog({ open, onClose, client: preselectedClient, onLogged }: Props) {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    client_id: preselectedClient?.id ?? '',
    log_type: 'call' as LogType,
    outcome: 'answered' as LogOutcome,
    summary: '',
    sentiment: '' as ClientSentiment | '',
    promises_made: '',
    objections: '',
    next_step: '',
    followup_date: '',
    created_by: 'Diego',
  })

  useEffect(() => {
    if (open && !preselectedClient) {
      fetch('/api/clients')
        .then((r) => r.json())
        .then(setClients)
        .catch(() => {})
    }
  }, [open, preselectedClient])

  useEffect(() => {
    if (preselectedClient) setForm((f) => ({ ...f, client_id: preselectedClient.id }))
  }, [preselectedClient])

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_id) return toast.error('Select a client')
    setLoading(true)
    try {
      const payload = { ...form, sentiment: form.sentiment || undefined }
      const res = await fetch('/api/communication-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) throw new Error('Failed to log')
      toast.success('Call logged')
      onLogged?.()
      onClose()
      setForm((f) => ({ ...f, summary: '', promises_made: '', objections: '', next_step: '', followup_date: '', sentiment: '' }))
    } catch (err) {
      toast.error(String(err))
    } finally {
      setLoading(false)
    }
  }

  const selectedClientName = preselectedClient?.name
    ?? clients.find((c) => c.id === form.client_id)?.name
    ?? ''

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-lg bg-card border-border">
        <DialogHeader>
          <DialogTitle>Log Call / Contact</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {!preselectedClient && (
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={form.client_id} onValueChange={(v) => v !== null && set('client_id', v)}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="Select client..." />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedClientName && preselectedClient && (
            <div className="text-sm text-muted-foreground bg-secondary/30 rounded-md px-3 py-2">
              Logging for <span className="text-foreground font-medium">{selectedClientName}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={form.log_type} onValueChange={(v) => v !== null && set('log_type', v)}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="call">Call</SelectItem>
                  <SelectItem value="voicemail">Voicemail</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="meeting">Meeting</SelectItem>
                  <SelectItem value="note">Note</SelectItem>
                  <SelectItem value="email">Email</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Outcome</Label>
              <Select value={form.outcome} onValueChange={(v) => v !== null && set('outcome', v)}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="answered">Answered</SelectItem>
                  <SelectItem value="voicemail">Left Voicemail</SelectItem>
                  <SelectItem value="texted">Texted</SelectItem>
                  <SelectItem value="no_answer">No Answer</SelectItem>
                  <SelectItem value="meeting_booked">Meeting Booked</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Summary / Notes</Label>
            <Textarea
              value={form.summary}
              onChange={(e) => set('summary', e.target.value)}
              placeholder="What happened? What did they say? Key points..."
              className="bg-secondary/50 h-24"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Client Sentiment</Label>
              <Select value={form.sentiment} onValueChange={(v) => v !== null && set('sentiment', v)}>
                <SelectTrigger className="bg-secondary/50">
                  <SelectValue placeholder="Mood..." />
                </SelectTrigger>
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
              <Label>Follow-Up Date</Label>
              <Input
                type="date"
                value={form.followup_date}
                onChange={(e) => set('followup_date', e.target.value)}
                className="bg-secondary/50"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Promises Made</Label>
            <Input
              value={form.promises_made}
              onChange={(e) => set('promises_made', e.target.value)}
              placeholder="What did you or Thatcher promise?"
              className="bg-secondary/50"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Next Step</Label>
            <Input
              value={form.next_step}
              onChange={(e) => set('next_step', e.target.value)}
              placeholder="What needs to happen next?"
              className="bg-secondary/50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Logging...' : 'Log Contact'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
