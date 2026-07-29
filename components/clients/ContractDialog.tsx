'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { InlineCalendar } from '@/components/ui/inline-calendar'
import { ChevronDown } from 'lucide-react'
import { cn, formatDate } from '@/lib/utils'
import type { Client } from '@/types'

/** Compact date field mirroring the client form's DatePicker. */
function DateField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between bg-secondary/50 h-11 px-3 rounded-md border border-border/50 text-base text-left"
      >
        <span className={value ? 'text-foreground' : 'text-muted-foreground'}>{value ? formatDate(value) : (placeholder ?? 'Select date...')}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>
      {open && (
        <div className="absolute z-50 mt-1 bg-card border border-border rounded-xl shadow-2xl p-2">
          <InlineCalendar value={value} onChange={(v: string) => { onChange(v); setOpen(false) }} />
          {value && (
            <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="mt-1 w-full text-[11px] text-muted-foreground hover:text-red-400 py-1">
              Clear date
            </button>
          )}
        </div>
      )}
    </div>
  )
}

interface Props {
  open: boolean
  onClose: () => void
  client: Client
  onSaved: (updated: Client) => void
}

export function ContractDialog({ open, onClose, client, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState(() => ({
    contract_start: client.contract_start ?? '',
    contract_end: client.contract_end ?? '',
    contract_payment_count: client.contract_payment_count?.toString() ?? '',
    contract_total_value: client.contract_total_value?.toString() ?? '',
  }))

  // Re-seed each time the dialog opens so it reflects the live record.
  useEffect(() => {
    if (open) {
      setForm({
        contract_start: client.contract_start ?? '',
        contract_end: client.contract_end ?? '',
        contract_payment_count: client.contract_payment_count?.toString() ?? '',
        contract_total_value: client.contract_total_value?.toString() ?? '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, client.id])

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true)
    try {
      const res = await fetch(`/api/clients/${client.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contract_start: form.contract_start || null,
          contract_end: form.contract_end || null,
          contract_payment_count: form.contract_payment_count ? Number(form.contract_payment_count) : null,
          contract_total_value: form.contract_total_value ? Number(form.contract_total_value) : null,
        }),
      })
      if (!res.ok) throw new Error()
      const updated = await res.json()
      onSaved(updated)
      toast.success('Contract updated')
      onClose()
    } catch {
      toast.error('Failed to update contract')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="w-[460px] max-w-[95vw] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg">Contract Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contract Start</Label>
              <DateField value={form.contract_start} onChange={(v) => set('contract_start', v)} placeholder="Start date..." />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Contract End</Label>
              <DateField value={form.contract_end} onChange={(v) => set('contract_end', v)} placeholder="End date..." />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide"># of Payments</Label>
              <Input value={form.contract_payment_count} onChange={(e) => set('contract_payment_count', e.target.value)} placeholder="6" type="number" className="bg-secondary/50 h-11 text-base border-border/50" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Total Value ($)</Label>
              <Input value={form.contract_total_value} onChange={(e) => set('contract_total_value', e.target.value)} placeholder="4500" type="number" className="bg-secondary/50 h-11 text-base border-border/50" />
            </div>
          </div>

          <div className={cn('flex justify-end gap-2 pt-2')}>
            <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
