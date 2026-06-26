'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Client } from '@/types'

export function ScheduleCallDialog({ open, onClose, onSaved, preselectedClient }: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  preselectedClient?: Client
}) {
  const [clients, setClients] = useState<Client[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    client_id: preselectedClient?.id ?? '',
    followup_date: '',
    followup_reason: '',
  })

  useEffect(() => {
    if (open && !preselectedClient) {
      fetch('/api/clients').then(r => r.json()).then(d => setClients(Array.isArray(d) ? d : []))
    }
  }, [open, preselectedClient])

  useEffect(() => {
    if (preselectedClient) setForm(f => ({ ...f, client_id: preselectedClient.id }))
  }, [preselectedClient])

  function set(field: string, value: string) { setForm(f => ({ ...f, [field]: value })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_id || !form.followup_date) return toast.error('Client and date required')
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${form.client_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          next_followup_date: form.followup_date,
          followup_reason: form.followup_reason || null,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Call scheduled')
      onSaved()
      onClose()
      setForm({ client_id: preselectedClient?.id ?? '', followup_date: '', followup_reason: '' })
    } catch {
      toast.error('Failed to schedule')
    } finally {
      setSaving(false)
    }
  }

  const clientName = preselectedClient?.name ?? clients.find(c => c.id === form.client_id)?.name

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[480px] max-w-[95vw] bg-card border-border">
        <DialogHeader><DialogTitle>Schedule a Call</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-4 mt-2">
          {!preselectedClient && (
            <div className="space-y-1.5">
              <Label>Client</Label>
              <Select value={form.client_id} onValueChange={v => v && set('client_id', v)}>
                <SelectTrigger className="bg-secondary/50 h-10"><SelectValue placeholder="Select client..." /></SelectTrigger>
                <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          {clientName && preselectedClient && (
            <div className="text-sm text-muted-foreground bg-secondary/30 rounded-md px-3 py-2">
              Scheduling for <span className="text-foreground font-medium">{clientName}</span>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Call Date</Label>
            <Input type="date" value={form.followup_date} onChange={e => set('followup_date', e.target.value)} className="bg-secondary/50 h-10" />
          </div>
          <div className="space-y-1.5">
            <Label>Reason / Notes</Label>
            <Textarea value={form.followup_reason} onChange={e => set('followup_reason', e.target.value)} placeholder="What's the goal of this call?" className="bg-secondary/50 h-20" />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Schedule Call'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
