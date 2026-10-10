'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { InlineCalendar } from '@/components/ui/inline-calendar'
import { useAuth } from '@/contexts/AuthContext'
import { localToday, offsetStr } from '@/lib/utils'
import type { MediaAccount } from '@/types'

const field = 'w-full h-10 px-3 rounded-lg bg-secondary/40 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40'
const label = 'text-[10px] text-muted-foreground uppercase tracking-wider block mb-1'
const area = 'w-full rounded-lg bg-secondary/40 border border-border/50 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40 resize-none'
const section = 'text-[10px] font-semibold text-muted-foreground/70 uppercase tracking-widest mb-2'

export function AccountLogForm({ account, onSaved, onCancel }: {
  account: MediaAccount
  onSaved: () => void
  onCancel: () => void
}) {
  const { user } = useAuth()
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    period_start: offsetStr(-7),
    period_end: localToday(),
    creatives: account.latest?.creatives ?? '',
    leads: '',
    cpl: '',
    numbers_submitted: '',
    booked: '',
    spend: '',
    revenue: '',
    situation: '',
    verdict: '',
    changes: '',
    follow_up_date: offsetStr(7),
  })
  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/media/account-logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, client_id: account.id, created_by: user?.name ?? user?.id ?? null }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Review logged')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Timeframe */}
      <div>
        <div className={section}>Timeframe these results cover</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className={label}>Start Date</label>
            <InlineCalendar value={form.period_start} onChange={v => set('period_start', v)} size="lg" />
          </div>
          <div>
            <label className={label}>End Date</label>
            <InlineCalendar value={form.period_end} onChange={v => set('period_end', v)} size="lg" />
          </div>
        </div>
      </div>

      {/* Results */}
      <div>
        <div className={section}>Results</div>
        <div className="mb-3">
          <label className={label}>Creatives running</label>
          <input value={form.creatives} onChange={e => set('creatives', e.target.value)} placeholder="e.g. cr1, cr2, cr3" className={field} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div><label className={label}>Leads</label><input type="number" inputMode="numeric" value={form.leads} onChange={e => set('leads', e.target.value)} placeholder="0" className={field} /></div>
          <div><label className={label}>CPL ($)</label><input type="number" inputMode="decimal" value={form.cpl} onChange={e => set('cpl', e.target.value)} placeholder="0" className={field} /></div>
          <div><label className={label}>Numbers</label><input type="number" inputMode="numeric" value={form.numbers_submitted} onChange={e => set('numbers_submitted', e.target.value)} placeholder="0" className={field} /></div>
          <div><label className={label}>Booked</label><input type="number" inputMode="numeric" value={form.booked} onChange={e => set('booked', e.target.value)} placeholder="0" className={field} /></div>
          <div><label className={label}>Spend ($)</label><input type="number" inputMode="decimal" value={form.spend} onChange={e => set('spend', e.target.value)} placeholder="0" className={field} /></div>
          <div><label className={label}>Revenue ($)</label><input type="number" inputMode="decimal" value={form.revenue} onChange={e => set('revenue', e.target.value)} placeholder="0" className={field} /></div>
        </div>
      </div>

      {/* Notes / verdict / changes */}
      <div>
        <div className={section}>Notes</div>
        <div className="space-y-3">
          <div>
            <label className={label}>Situation / Notes</label>
            <textarea rows={3} value={form.situation} onChange={e => set('situation', e.target.value)} placeholder="What's going on, observations…" className={area} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className={label}>Verdict</label>
              <textarea rows={2} value={form.verdict} onChange={e => set('verdict', e.target.value)} placeholder="The call / assessment…" className={area} />
            </div>
            <div>
              <label className={label}>Changes made</label>
              <textarea rows={2} value={form.changes} onChange={e => set('changes', e.target.value)} placeholder="What you changed / will change…" className={area} />
            </div>
          </div>
        </div>
      </div>

      {/* Follow-up */}
      <div>
        <div className={section}>Follow-up — when to next take a look</div>
        <InlineCalendar value={form.follow_up_date} onChange={v => set('follow_up_date', v)} size="lg" />
      </div>

      <div className="flex justify-end gap-2 pt-2 pb-10">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button onClick={save} disabled={saving} className="gap-2">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          Save Review
        </Button>
      </div>
    </div>
  )
}
