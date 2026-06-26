'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type { Client, ClientStage } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  client?: Client
  onSaved?: (client: Client) => void
}

const STAGES: { value: ClientStage; label: string }[] = [
  { value: 'onboarding', label: 'Onboarding' },
  { value: 'free_trial', label: 'Free Trial' },
  { value: 'trial_ending_soon', label: 'Trial Ending Soon' },
  { value: 'trial_concluded', label: 'Trial Concluded' },
  { value: 'active_client', label: 'Active Client' },
  { value: 'payment_issue', label: 'Payment Issue' },
  { value: 'paused', label: 'Paused' },
  { value: 'churn_risk', label: 'Churn Risk' },
  { value: 'churned', label: 'Churned' },
  { value: 'won_back', label: 'Won Back' },
]

export function ClientForm({ open, onClose, client, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: client?.name ?? '',
    business_name: client?.business_name ?? '',
    owner_name: client?.owner_name ?? '',
    phone: client?.phone ?? '',
    email: client?.email ?? '',
    market_location: client?.market_location ?? '',
    timezone: client?.timezone ?? '',
    stage: (client?.stage ?? 'onboarding') as ClientStage,
    assigned_va: client?.assigned_va ?? '',
    monthly_retainer: client?.monthly_retainer?.toString() ?? '',
    payment_frequency: client?.payment_frequency ?? 'monthly',
    trial_start: client?.trial_start ?? '',
    trial_end: client?.trial_end ?? '',
    ghl_location_link: client?.ghl_location_link ?? '',
    ad_account_link: client?.ad_account_link ?? '',
    slack_thread: client?.slack_thread ?? '',
    google_drive_folder: client?.google_drive_folder ?? '',
    deal_notes: client?.deal_notes ?? '',
  })

  function set(field: string, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    setLoading(true)

    // Convert all empty strings to null, handle typed fields
    const raw: Record<string, unknown> = { ...form }
    const payload: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(raw)) {
      payload[k] = typeof v === 'string' && v.trim() === '' ? null : v
    }
    payload.monthly_retainer = form.monthly_retainer ? Number(form.monthly_retainer) : null
    payload.trial_start = form.trial_start || null
    payload.trial_end = form.trial_end || null

    try {
      const url = client ? `/api/clients/${client.id}` : '/api/clients'
      const method = client ? 'PATCH' : 'POST'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(client ? 'Client updated' : 'Client added')
      onSaved?.(data)
      onClose()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[760px] max-w-[95vw] max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl">{client ? 'Edit Client' : 'Add New Client'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 mt-4">
          {/* Row 1: Name + Business */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Client Name *</Label>
              <Input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="John Smith" className="bg-secondary/50 h-11 text-base" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Business Name</Label>
              <Input value={form.business_name} onChange={(e) => set('business_name', e.target.value)} placeholder="Pro Shine Detailing" className="bg-secondary/50 h-11 text-base" />
            </div>
          </div>

          {/* Row 2: Phone + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Phone</Label>
              <Input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="(555) 123-4567" className="bg-secondary/50 h-11 text-base" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Email</Label>
              <Input value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="john@example.com" className="bg-secondary/50 h-11 text-base" />
            </div>
          </div>

          {/* Row 3: Location + Timezone */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Market / Location</Label>
              <Input value={form.market_location} onChange={(e) => set('market_location', e.target.value)} placeholder="Houston, TX" className="bg-secondary/50 h-11 text-base" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Timezone</Label>
              <Input value={form.timezone} onChange={(e) => set('timezone', e.target.value)} placeholder="CST" className="bg-secondary/50 h-11 text-base" />
            </div>
          </div>

          {/* Row 4: Stage + Retainer + Frequency */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Stage</Label>
              <Select value={form.stage} onValueChange={(v) => v && set('stage', v)}>
                <SelectTrigger className="bg-secondary/50 h-11 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Monthly Retainer ($)</Label>
              <Input value={form.monthly_retainer} onChange={(e) => set('monthly_retainer', e.target.value)} placeholder="1000" type="number" className="bg-secondary/50 h-11 text-base" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Payment Frequency</Label>
              <Select value={form.payment_frequency} onValueChange={(v) => v && set('payment_frequency', v)}>
                <SelectTrigger className="bg-secondary/50 h-11 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="weekly">Weekly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 5: Trial dates */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Trial Start</Label>
              <Input value={form.trial_start} onChange={(e) => set('trial_start', e.target.value)} type="date" className="bg-secondary/50 h-11 text-base" />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">Trial End</Label>
              <Input value={form.trial_end} onChange={(e) => set('trial_end', e.target.value)} type="date" className="bg-secondary/50 h-11 text-base" />
            </div>
          </div>

          {/* Deal Notes */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Deal Notes</Label>
            <Textarea value={form.deal_notes} onChange={(e) => set('deal_notes', e.target.value)} placeholder="Special pricing, discounts, custom deal notes..." className="bg-secondary/50 h-24 text-base" />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button type="button" variant="outline" size="lg" onClick={onClose}>Cancel</Button>
            <Button type="submit" size="lg" disabled={loading}>
              {loading ? 'Saving...' : client ? 'Save Changes' : 'Add Client'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
