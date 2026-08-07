'use client'

import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'
import { workedSeconds } from '@/lib/team'
import type { TeamTimeEntry } from '@/types'

interface Props {
  entry: TeamTimeEntry | null
  onClose: () => void
  onSaved: () => void
}

/** Admin-only retroactive edit for a team time entry: worked time, description, standard, delete. */
export function EditEntryDialog({ entry, onClose, onSaved }: Props) {
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [form, setForm] = useState({ description: '', minutes: '', is_standard: false })

  useEffect(() => {
    if (entry) {
      setConfirmDelete(false)
      setForm({
        description: entry.description ?? '',
        minutes: String(Math.round(workedSeconds(entry) / 60)),
        is_standard: entry.is_standard,
      })
    }
  }, [entry])

  if (!entry) return null

  async function save() {
    if (!entry) return
    setSaving(true)
    try {
      const res = await fetch(`/api/team/entries/${entry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: form.description,
          is_standard: form.is_standard,
          worked_minutes: form.minutes === '' ? 0 : Number(form.minutes),
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Entry updated')
      onSaved()
      onClose()
    } catch {
      toast.error('Failed to update entry')
    } finally {
      setSaving(false)
    }
  }

  async function del() {
    if (!entry) return
    setSaving(true)
    try {
      const res = await fetch(`/api/team/entries/${entry.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      toast.success('Entry deleted')
      onSaved()
      onClose()
    } catch {
      toast.error('Failed to delete entry')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={!!entry} onOpenChange={onClose}>
      <DialogContent className="w-[440px] max-w-[95vw] bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-lg">Edit Entry</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Description</Label>
            <Input
              value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Task description"
              className="bg-secondary/50 h-11 text-base border-border/50"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Worked time (minutes)</Label>
            <Input
              value={form.minutes}
              onChange={e => setForm(f => ({ ...f, minutes: e.target.value }))}
              type="number"
              min="0"
              className="bg-secondary/50 h-11 text-base border-border/50"
            />
            <p className="text-[11px] text-muted-foreground/60">Drives pay and the KPI budget. Editing stops any live timer.</p>
          </div>

          <button
            onClick={() => setForm(f => ({ ...f, is_standard: !f.is_standard }))}
            className={cn('text-xs font-semibold uppercase tracking-wider px-2.5 py-1.5 rounded-lg border transition-colors',
              form.is_standard ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground')}
          >
            {form.is_standard ? 'Standard (counts toward KPI)' : 'Non-standard (pay only)'}
          </button>

          <div className="flex items-center justify-between pt-2">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-400">Delete?</span>
                <Button size="sm" variant="outline" className="h-8 text-xs border-red-500/40 text-red-400 hover:bg-red-950/30" disabled={saving} onClick={del}>Yes, delete</Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              </div>
            ) : (
              <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground/50 hover:text-red-400 gap-1.5" onClick={() => setConfirmDelete(true)}>
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </Button>
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
