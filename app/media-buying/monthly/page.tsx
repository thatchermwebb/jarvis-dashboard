'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { CalendarRange, ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { monthLabel } from '@/lib/media'

interface MonthPage { month: string; ads_produced: number; completed: number }

function nextMonthKey(): string {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export default function MonthlyAdUpdatePage() {
  const router = useRouter()
  const [pages, setPages] = useState<MonthPage[]>([])
  const [loading, setLoading] = useState(true)
  const [newMonth, setNewMonth] = useState(nextMonthKey())
  const [creating, setCreating] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/media/monthly')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setPages(data.pages ?? [])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load monthly pages')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function create() {
    if (!newMonth) return
    setCreating(true)
    try {
      const res = await fetch('/api/media/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ month: newMonth }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      router.push(`/media-buying/monthly/${newMonth}`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create page')
      setCreating(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      <Link href="/media-buying" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="w-3.5 h-3.5" />Media Buying
      </Link>
      <div className="flex items-center gap-3 mb-1">
        <CalendarRange className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Monthly Ad Update</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6">
        One page per month: every client, the creatives they’re running, and where their refresh stands.
      </p>

      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <input
          type="month"
          value={newMonth}
          onChange={e => setNewMonth(e.target.value)}
          className="bg-secondary/40 border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/50"
        />
        <button
          onClick={create}
          disabled={creating || !newMonth}
          className="inline-flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-lg bg-primary/15 text-primary hover:bg-primary/25 border border-primary/30 disabled:opacity-50 transition-colors"
        >
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          New month page
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : pages.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border/50 bg-card/40 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground/70">No monthly pages yet. Pick a month above to create one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {pages.map(p => (
            <Link
              key={p.month}
              href={`/media-buying/monthly/${p.month}`}
              className="flex items-center justify-between gap-3 rounded-xl border border-border/50 bg-card px-4 py-3.5 hover:border-primary/40 transition-colors"
            >
              <div className="font-medium text-foreground">{monthLabel(p.month)}</div>
              <div className="flex items-center gap-4 text-xs">
                <span className="text-amber-400">{p.ads_produced} ads produced</span>
                <span className="text-emerald-400">{p.completed} completed</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
