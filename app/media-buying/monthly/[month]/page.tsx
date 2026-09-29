'use client'

import { useState, useEffect, useCallback, use } from 'react'
import Link from 'next/link'
import { CalendarRange, ChevronLeft, ExternalLink, Loader2, Search } from 'lucide-react'
import { toast } from 'sonner'
import { cn, stageLabel } from '@/lib/utils'
import { MEDIA_ACTIVE_STAGES, MONTHLY_STATUS_LABEL, monthLabel } from '@/lib/media'
import type { ClientStage, MediaAd, MonthlyUpdateStatus } from '@/types'

interface Row {
  id: string
  name: string
  business_name?: string | null
  market_location?: string | null
  stage: ClientStage
  ads: MediaAd[]
  status: MonthlyUpdateStatus | null
  updated_by: string | null
}

type Filter = 'all' | 'running' | 'blank' | MonthlyUpdateStatus

const STATUS_STYLE: Record<'blank' | MonthlyUpdateStatus, string> = {
  blank: 'text-muted-foreground bg-secondary/40 border-border/50',
  ads_produced: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  completed: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
}

export default function MonthlyAdUpdateMonthPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = use(params)
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/media/monthly/${month}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRows(data.clients ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { load() }, [load])

  async function setStatus(clientId: string, status: MonthlyUpdateStatus | null) {
    const prev = rows
    setRows(rs => rs.map(r => (r.id === clientId ? { ...r, status } : r)))
    try {
      const res = await fetch(`/api/media/monthly/${month}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, status }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRows(rs => rs.map(r => (r.id === clientId ? { ...r, updated_by: data.updated_by } : r)))
    } catch (e) {
      setRows(prev)
      toast.error(e instanceof Error ? e.message : 'Failed to update status')
    }
  }

  const q = search.trim().toLowerCase()
  const visible = rows.filter(r => {
    if (filter === 'running' && !MEDIA_ACTIVE_STAGES.includes(r.stage)) return false
    if (filter === 'blank' && r.status) return false
    if ((filter === 'ads_produced' || filter === 'completed') && r.status !== filter) return false
    if (q && !`${r.name} ${r.business_name ?? ''} ${r.market_location ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })

  const produced = rows.filter(r => r.status === 'ads_produced').length
  const completed = rows.filter(r => r.status === 'completed').length

  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: `All (${rows.length})` },
    { id: 'running', label: 'Running ads' },
    { id: 'blank', label: `No status (${rows.length - produced - completed})` },
    { id: 'ads_produced', label: `Ads Produced (${produced})` },
    { id: 'completed', label: `Completed (${completed})` },
  ]

  return (
    <div className="max-w-6xl mx-auto">
      <Link href="/media-buying/monthly" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-3">
        <ChevronLeft className="w-3.5 h-3.5" />Monthly Ad Update
      </Link>
      <div className="flex items-center gap-3 mb-1">
        <CalendarRange className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">{monthLabel(month)}</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Monthly Ad Update · every client and the creatives in their active slots.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : error ? (
        <div className="rounded-xl border border-dashed border-border/50 bg-card/40 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground/70">{error}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
            <div className="flex items-center gap-1 flex-wrap">
              {filters.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFilter(f.id)}
                  className={cn(
                    'text-xs px-2.5 py-1.5 rounded-md border transition-colors',
                    filter === f.id
                      ? 'border-primary/40 bg-primary/10 text-primary'
                      : 'border-border/40 text-muted-foreground hover:text-foreground',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 bg-secondary/40 border border-border/50 rounded-lg px-2.5 py-1.5">
              <Search className="w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search clients…"
                className="bg-transparent text-sm outline-none w-44 placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <div className="rounded-xl border border-border/50 bg-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50 text-left text-[11px] uppercase tracking-wider text-muted-foreground/70">
                  <th className="px-4 py-2.5 font-semibold">Client</th>
                  <th className="px-4 py-2.5 font-semibold">Stage</th>
                  <th className="px-4 py-2.5 font-semibold">Ad 1 creative</th>
                  <th className="px-4 py-2.5 font-semibold">Ad 2 creative</th>
                  <th className="px-4 py-2.5 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {visible.map(r => (
                  <tr key={r.id} className="border-b border-border/30 last:border-0 hover:bg-secondary/20">
                    <td className="px-4 py-3 align-top">
                      <Link href={`/clients/${r.id}`} className="font-medium text-foreground hover:text-primary">
                        {r.business_name || r.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {[r.business_name ? r.name : null, r.market_location].filter(Boolean).join(' · ')}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-muted-foreground whitespace-nowrap">{stageLabel(r.stage)}</td>
                    <td className="px-4 py-3 align-top"><CreativeCell ad={r.ads.find(a => a.slot === 1)} /></td>
                    <td className="px-4 py-3 align-top"><CreativeCell ad={r.ads.find(a => a.slot === 2)} /></td>
                    <td className="px-4 py-3 align-top text-right">
                      <select
                        value={r.status ?? ''}
                        onChange={e => setStatus(r.id, (e.target.value || null) as MonthlyUpdateStatus | null)}
                        title={r.updated_by ? `Last updated by ${r.updated_by}` : undefined}
                        className={cn(
                          'text-xs font-medium rounded-md border px-2 py-1.5 outline-none cursor-pointer min-w-[130px]',
                          STATUS_STYLE[r.status ?? 'blank'],
                        )}
                      >
                        <option value="">—</option>
                        <option value="ads_produced">{MONTHLY_STATUS_LABEL.ads_produced}</option>
                        <option value="completed">{MONTHLY_STATUS_LABEL.completed}</option>
                      </select>
                    </td>
                  </tr>
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-sm text-muted-foreground/70">No clients match.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  )
}

function CreativeCell({ ad }: { ad?: MediaAd }) {
  if (!ad) return <span className="text-xs text-muted-foreground/50">—</span>
  const detail = [ad.service_type, ad.price_point, ad.angle].filter(Boolean).join(' · ')
  return (
    <div className="min-w-[140px]">
      <div className="flex items-center gap-1.5">
        <span className="font-mono text-xs font-semibold text-foreground">{ad.creative || ad.name || 'Untitled'}</span>
        {ad.status !== 'active' && (
          <span className="text-[10px] text-muted-foreground/70">({ad.status.replace('_', ' ')})</span>
        )}
        {ad.video_link && (
          <a href={ad.video_link} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary">
            <ExternalLink className="w-3 h-3" />
          </a>
        )}
      </div>
      {ad.creative && ad.name && <div className="text-xs text-muted-foreground">{ad.name}</div>}
      {detail && <div className="text-[11px] text-muted-foreground/70">{detail}</div>}
    </div>
  )
}
