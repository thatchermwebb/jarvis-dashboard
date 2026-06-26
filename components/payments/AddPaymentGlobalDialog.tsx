'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Client, PaymentType } from '@/types'

const PAYMENT_TYPES: { value: PaymentType; label: string }[] = [
  { value: 'retainer_monthly', label: 'Retainer (1 month)' },
  { value: 'retainer_biweekly', label: 'Retainer (2 weeks)' },
  { value: 'retainer_weekly', label: 'Retainer (1 week)' },
  { value: 'deposit', label: 'Deposit' },
  { value: 'remaining_balance', label: 'Remaining Balance' },
  { value: 'one_time', label: 'One-Time' },
]

export function AddPaymentGlobalDialog({ open, onClose, onSaved }: {
  open: boolean; onClose: () => void; onSaved: () => void
}) {
  const [clients, setClients] = useState<Client[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    client_id: '', payment_type: 'retainer_monthly' as PaymentType,
    amount: '', due_date: '', notes: '',
  })

  useEffect(() => {
    if (open) fetch('/api/clients').then((r) => r.json()).then((d) => setClients(Array.isArray(d) ? d : []))
  }, [open])

  function set(field: string, value: string) { setForm((f) => ({ ...f, [field]: value })) }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.client_id || !form.amount || !form.due_date) return toast.error('Client, amount, and due date required')
    setSaving(true)
    try {
      const res = await fetch('/api/payments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount), status: 'pending' }),
      })
      if (!res.ok) throw new Error()
      toast.success('Payment added')
      onSaved(); onClose()
      setForm({ client_id: '', payment_type: 'retainer_monthly', amount: '', due_date: '', notes: '' })
    } catch { toast.error('Failed') } finally { setSaving(false) }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-card border-border">
        <DialogHeader><DialogTitle>Add Payment</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label>Client</Label>
            <Select value={form.client_id} onValueChange={(v) => v && set('client_id', v)}>
              <SelectTrigger className="bg-secondary/50"><SelectValue placeholder="Select client..." /></SelectTrigger>
              <SelectContent>{clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Type</Label>
            <Select value={form.payment_type} onValueChange={(v) => v && set('payment_type', v)}>
              <SelectTrigger className="bg-secondary/50"><SelectValue /></SelectTrigger>
              <SelectContent>{PAYMENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Amount ($)</Label>
              <Input type="number" value={form.amount} onChange={(e) => set('amount', e.target.value)} placeholder="500" className="bg-secondary/50" />
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} className="bg-secondary/50" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Input value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Optional..." className="bg-secondary/50" />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Add Payment'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
