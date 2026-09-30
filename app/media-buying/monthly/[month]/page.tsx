'use client'

import { useState, useEffect, useCallback, useRef, use } from 'react'
import Link from 'next/link'
import { CalendarRange, Check, ChevronLeft, Loader2, Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn, stageLabel } from '@/lib/utils'
import { MEDIA_ACTIVE_STAGES, MONTHLY_STATUS_LABEL, monthLabel } from '@/lib/media'
import { packageOption } from '@/lib/packages'
import type { ClientStage, MonthlyUpdateStatus } from '@/types'

interface Row {
  id: string
  name: string
  business_name?: string | null
  market_location?: string | null
  stage: ClientStage
  advertised_package?: string | null
  status: MonthlyUpdateStatus | null
  creatives: string[]
  updated_by: string | null
}

// "Running ads" = paying clients running ads plus active free trials
// (free_trial and legacy trial_ending_soon both show as "Free Trial (Active)").
const RUNNING_STAGES = [...MEDIA_ACTIVE_STAGES, 'free_trial', 'trial_ending_soon']

type Filter = 'all' | 'running' | 'blank' | MonthlyUpdateStatus

const FILTER_KEY = 'cza_monthly_filter'
const FILTERS: Filter[] = ['all', 'running', 'blank', 'ads_produced', 'completed']

// Remember the chosen filter so coming back (from a client profile, a reload,
// or another month) lands on the same list — which also lets the shell's scroll
// restoration put you back on the same row.
function savedFilter(): Filter {
  if (typeof window === 'undefined') return 'all'
  try {
    const v = localStorage.getItem(FILTER_KEY) as Filter | null
    return v && FILTERS.includes(v) ? v : 'all'
  } catch {
    return 'all'
  }
}

const STATUS_STYLE: Record<'blank' | MonthlyUpdateStatus, string> = {
  blank: 'text-muted-foreground bg-secondary/40 border-border/50',
  ads_produced: 'text-amber-300 bg-amber-500/10 border-amber-500/30',
  completed: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30',
}

export default function MonthlyAdUpdateMonthPage({ params }: { params: Promise<{ month: string }> }) {
  const { month } = use(params)
  const [rows, setRows] = useState<Row[]>([])
  const [library, setLibrary] = useState<{ code: string; name?: string | null }[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilterState] = useState<Filter>(savedFilter)
  function setFilter(f: Filter) {
    setFilterState(f)
    try { localStorage.setItem(FILTER_KEY, f) } catch { /* private mode */ }
  }
  const [search, setSearch] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/media/monthly/${month}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRows(data.clients ?? [])
      setLibrary(data.creatives ?? [])
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }, [month])

  useEffect(() => { load() }, [load])

  async function save(clientId: string, patch: Partial<Pick<Row, 'status' | 'creatives'>>) {
    const prev = rows
    setRows(rs => rs.map(r => (r.id === clientId ? { ...r, ...patch } : r)))
    try {
      const res = await fetch(`/api/media/monthly/${month}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ client_id: clientId, ...patch }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRows(rs => rs.map(r => (r.id === clientId ? { ...r, updated_by: data.updated_by } : r)))
    } catch (e) {
      setRows(prev)
      toast.error(e instanceof Error ? e.message : 'Failed to save')
    }
  }

  const q = search.trim().toLowerCase()
  const visible = rows.filter(r => {
    if (filter === 'running' && !RUNNING_STAGES.includes(r.stage)) return false
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
        Monthly Ad Update · every client, their advertised package, and this month’s creatives.
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
                  <th className="px-4 py-2.5 font-semibold">Advertised package</th>
                  <th className="px-4 py-2.5 font-semibold">Creatives</th>
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
                    <td className="px-4 py-3 align-top"><PackageCell value={r.advertised_package} /></td>
                    <td className="px-4 py-3 align-top">
                      <CreativesCell value={r.creatives} library={library} onChange={creatives => save(r.id, { creatives })} />
                    </td>
                    <td className="px-4 py-3 align-top text-right">
                      <select
                        value={r.status ?? ''}
                        onChange={e => save(r.id, { status: (e.target.value || null) as MonthlyUpdateStatus | null })}
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

function PackageCell({ value }: { value?: string | null }) {
  if (!value) return <span className="text-xs text-muted-foreground/50">—</span>
  // Stored values often carry a trailing space; match on the trimmed string.
  const opt = packageOption(value.trim())
  if (!opt) return <span className="text-sm text-foreground">{value}</span>
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-md border whitespace-nowrap', opt.chip)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', opt.dot)} />
      {opt.label}
    </span>
  )
}

// Creative codes for this client this month: chips + a picker listing the
// Creative Library, with a box for one-off codes that aren't in it. The picker
// is position:fixed so the table's horizontal scroll container can't clip it.
function CreativesCell({ value, library, onChange }: {
  value: string[]
  library: { code: string; name?: string | null }[]
  onChange: (next: string[]) => void
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const [custom, setCustom] = useState('')
  const btnRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: Event) => {
      const t = e.target as Node
      if (popRef.current?.contains(t) || btnRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('scroll', close, true)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('scroll', close, true)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  function toggleOpen() {
    const r = btnRef.current?.getBoundingClientRect()
    if (r) {
      const width = 224
      const below = window.innerHeight - r.bottom > 300
      setPos({
        top: below ? r.bottom + 6 : Math.max(8, r.top - 306),
        left: Math.min(r.left, window.innerWidth - width - 8),
      })
    }
    setOpen(o => !o)
  }

  const has = (code: string) => value.some(v => v.toLowerCase() === code.toLowerCase())
  function toggle(code: string) {
    onChange(has(code) ? value.filter(v => v.toLowerCase() !== code.toLowerCase()) : [...value, code])
  }
  function addCustom() {
    const code = custom.trim()
    if (code && !has(code)) onChange([...value, code])
    setCustom('')
  }

  return (
    <div className="flex items-center gap-1 flex-wrap min-w-[150px]">
      {value.map(code => (
        <span key={code} className="inline-flex items-center gap-1 font-mono text-xs font-semibold px-2 py-1 rounded-md border border-primary/30 bg-primary/10 text-primary">
          {code}
          <button onClick={() => toggle(code)} className="opacity-60 hover:opacity-100" aria-label={`Remove ${code}`}>
            <X className="w-3 h-3" />
          </button>
        </span>
      ))}
      <button
        ref={btnRef}
        onClick={toggleOpen}
        className={cn(
          'inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md border border-dashed transition-colors',
          open ? 'border-primary/50 text-primary' : 'border-border/60 text-muted-foreground hover:text-foreground hover:border-border',
        )}
      >
        <Plus className="w-3 h-3" />{value.length ? '' : 'Add'}
      </button>

      {open && pos && (
        <div
          ref={popRef}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-[224px] rounded-xl border border-border bg-popover shadow-xl p-1.5"
        >
          <div className="px-2 pt-1 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">Creative Library</div>
          <div className="max-h-48 overflow-y-auto">
            {library.length === 0 && <div className="px-2 py-2 text-xs text-muted-foreground">No creatives in the library yet.</div>}
            {library.map(c => (
              <button
                key={c.code}
                onClick={() => toggle(c.code)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left hover:bg-secondary/60"
              >
                <span className={cn('w-4 h-4 rounded border flex items-center justify-center flex-shrink-0', has(c.code) ? 'bg-primary border-primary text-primary-foreground' : 'border-border')}>
                  {has(c.code) && <Check className="w-3 h-3" />}
                </span>
                <span className="font-mono text-xs font-semibold text-foreground">{c.code}</span>
                {c.name && <span className="text-xs text-muted-foreground truncate">{c.name}</span>}
              </button>
            ))}
          </div>
          <form
            onSubmit={e => { e.preventDefault(); addCustom() }}
            className="flex items-center gap-1 border-t border-border/50 mt-1 pt-1.5 px-1"
          >
            <input
              value={custom}
              onChange={e => setCustom(e.target.value)}
              placeholder="Other code…"
              className="flex-1 min-w-0 bg-secondary/40 border border-border/50 rounded-md px-2 py-1 text-xs font-mono outline-none focus:border-primary/50"
            />
            <button type="submit" disabled={!custom.trim()} className="text-xs px-2 py-1 rounded-md text-primary hover:bg-primary/10 disabled:opacity-40">Add</button>
          </form>
        </div>
      )}
    </div>
  )
}
