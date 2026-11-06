'use client'

import { useState, useMemo } from 'react'
import { toast } from 'sonner'
import { FileText, Search, Check, Loader2, Users } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn, stageLabel, stageColor } from '@/lib/utils'
import type { Client } from '@/types'

export function ExportRecordsDialog({ open, onClose, clients }: {
  open: boolean
  onClose: () => void
  clients: Client[]
}) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busy, setBusy] = useState(false)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return clients
    return clients.filter(c =>
      [c.name, c.business_name, c.owner_name, c.market_location, c.email]
        .some(v => v && v.toLowerCase().includes(q)))
  }, [clients, query])

  const allFilteredSelected = filtered.length > 0 && filtered.every(c => selected.has(c.id))

  function toggle(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAllFiltered() {
    setSelected(prev => {
      const next = new Set(prev)
      if (allFilteredSelected) filtered.forEach(c => next.delete(c.id))
      else filtered.forEach(c => next.add(c.id))
      return next
    })
  }

  async function runExport() {
    // Preserve the on-screen order of the selected clients.
    const ids = clients.filter(c => selected.has(c.id)).map(c => c.id)
    if (ids.length === 0) return
    setBusy(true)
    try {
      const res = await fetch('/api/clients/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientIds: ids }),
      })
      if (!res.ok) {
        const msg = await res.json().catch(() => ({}))
        throw new Error(msg.error || 'Export failed')
      }
      const blob = await res.blob()
      const cd = res.headers.get('Content-Disposition') || ''
      const match = cd.match(/filename="?([^"]+)"?/)
      const filename = match?.[1] || `cza-client-records-${new Date().toISOString().slice(0, 10)}.docx`
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      toast.success(`Exported ${ids.length} client record${ids.length === 1 ? '' : 's'}`)
      onClose()
      setSelected(new Set())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={o => { if (!o && !busy) onClose() }}>
      <DialogContent className="max-w-xl p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-5 pt-5 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileText className="w-4.5 h-4.5 text-primary" /> Export Full Client Records
          </DialogTitle>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Bulk-select clients to export as one Word document. Each record is the entire customer
            journey in plain English — every log, payment, note and datapoint — built to feed straight
            into an AI model.
          </p>
        </DialogHeader>

        {/* Search + select-all */}
        <div className="px-5 py-3 flex items-center gap-2 border-b border-border/60">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search clients…"
              className="pl-8 h-8 text-sm bg-secondary/50"
            />
          </div>
          <Button variant="outline" size="sm" className="h-8 text-xs whitespace-nowrap" onClick={toggleAllFiltered}>
            {allFilteredSelected ? 'Clear all' : 'Select all'}
          </Button>
        </div>

        {/* List */}
        <div className="max-h-[46vh] overflow-y-auto px-2 py-2">
          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No clients match “{query}”.</div>
          ) : (
            filtered.map(c => {
              const on = selected.has(c.id)
              return (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                    on ? 'bg-primary/10' : 'hover:bg-secondary/40',
                  )}
                >
                  <span className={cn(
                    'w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 transition-colors',
                    on ? 'bg-primary border-primary' : 'border-border',
                  )}>
                    {on && <Check className="w-3 h-3 text-primary-foreground" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-foreground truncate">
                      {c.business_name || c.name}
                    </span>
                    <span className="block text-[11px] text-muted-foreground truncate">
                      {[c.name !== (c.business_name || c.name) ? c.name : null, c.market_location]
                        .filter(Boolean).join(' · ') || '—'}
                    </span>
                  </span>
                  <span className={cn('text-[9px] font-bold px-1.5 py-0.5 rounded-full border flex-shrink-0', stageColor(c.stage))}>
                    {stageLabel(c.stage)}
                  </span>
                </button>
              )
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-border flex items-center justify-between gap-3">
          <span className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Users className="w-3.5 h-3.5" />
            {selected.size} selected
          </span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={onClose} disabled={busy}>Cancel</Button>
            <Button size="sm" className="h-8 text-xs gap-1.5" onClick={runExport} disabled={selected.size === 0 || busy}>
              {busy ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating…</> : <><FileText className="w-3.5 h-3.5" /> Export {selected.size || ''} {selected.size === 1 ? 'record' : 'records'}</>}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
