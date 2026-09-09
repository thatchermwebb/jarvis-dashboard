'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Megaphone, ExternalLink, Check, Loader2, ChevronDown, Trash2,
  PlayCircle, Rocket, ClipboardList, Library, CalendarCheck, Plus, Send, Clock, Clapperboard,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatDate } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { DECISION_LABEL, RATING_LABEL, WORK_ORDER_STATUS_LABEL } from '@/lib/media'
import type {
  AdRating, MediaAd, MediaReview, MediaWorkOrder, MediaDecision, WorkOrderStatus, MediaCreativeStats,
} from '@/types'

// ─── Types for the board endpoint ───────────────────────────────────────────────

interface BoardClient {
  id: string
  name: string
  business_name?: string
  market_location?: string
  stage?: string
  advertised_package?: string
  ad_account_link?: string | null
  campaign_link?: string | null
  ads: MediaAd[]
  review: MediaReview | null
}

interface CreativeOption { code: string; name?: string | null }

type Tab = 'week' | 'orders' | 'library' | 'creatives'

// ─── Rating config ──────────────────────────────────────────────────────────────

const RATINGS: { value: AdRating; label: string; active: string; idle: string }[] = [
  { value: 'good',   label: 'Good',   active: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40', idle: 'text-muted-foreground/70 border-border/40 hover:border-emerald-500/30 hover:text-emerald-300' },
  { value: 'decent', label: 'Decent', active: 'bg-blue-500/20 text-blue-300 border-blue-500/40',          idle: 'text-muted-foreground/70 border-border/40 hover:border-blue-500/30 hover:text-blue-300' },
  { value: 'bad',    label: 'Bad',    active: 'bg-red-500/20 text-red-300 border-red-500/40',              idle: 'text-muted-foreground/70 border-border/40 hover:border-red-500/30 hover:text-red-300' },
]

const DECISION_STYLE: Record<MediaDecision, string> = {
  leave: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  spend_to_winner: 'text-amber-300 bg-amber-500/10 border-amber-500/20',
  spend_to_winner_order_1: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
  order_2: 'text-red-300 bg-red-500/10 border-red-500/20',
}

const WO_STATUS_STYLE: Record<WorkOrderStatus, { color: string; dot: string }> = {
  todo:          { color: 'text-muted-foreground bg-secondary/50 border-border/40', dot: 'bg-muted-foreground/40' },
  in_production:  { color: 'text-blue-400 bg-blue-500/10 border-blue-500/20',        dot: 'bg-blue-400' },
  produced:       { color: 'text-amber-400 bg-amber-500/10 border-amber-500/20',     dot: 'bg-amber-400' },
  uploaded:       { color: 'text-purple-400 bg-purple-500/10 border-purple-500/20',  dot: 'bg-purple-400' },
  done:           { color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', dot: 'bg-emerald-400' },
}

function daysRunning(iso?: string | null): number | null {
  if (!iso) return null
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86400000))
}

// ─── Page ────────────────────────────────────────────────────────────────────────

export default function MediaBuyingPage() {
  const [tab, setTab] = useState<Tab>('week')
  const { user } = useAuth()
  const isAdmin = user?.userType === 'admin'

  const tabs = ([
    { id: 'week', label: 'This Week', icon: CalendarCheck },
    { id: 'orders', label: 'Work Orders', icon: ClipboardList },
    { id: 'library', label: 'Ad Library', icon: Library },
    ...(isAdmin ? [{ id: 'creatives' as Tab, label: 'Creatives', icon: Clapperboard }] : []),
  ] as { id: Tab; label: string; icon: typeof CalendarCheck }[])

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-1">
        <Megaphone className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold text-foreground">Media Buying</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-5">
        Weekly ad review, auto-decisions, and production tracking.
      </p>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border/40 mb-6">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              tab === id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {tab === 'week' && <WeekView />}
      {tab === 'orders' && <OrdersView />}
      {tab === 'library' && <LibraryView />}
      {tab === 'creatives' && isAdmin && <CreativesView />}
    </div>
  )
}

// ─── This Week: Samuel's review board ───────────────────────────────────────────

function WeekView() {
  const [week, setWeek] = useState('')
  const [clients, setClients] = useState<BoardClient[]>([])
  const [creatives, setCreatives] = useState<CreativeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [notifying, setNotifying] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/media/board')
      const data = await res.json()
      setWeek(data.week ?? '')
      setClients(data.clients ?? [])
      setCreatives(data.creatives ?? [])
    } catch {
      toast.error('Failed to load the review board')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function notifyWilson() {
    setNotifying(true)
    try {
      const res = await fetch('/api/media/notify', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      toast.success(
        data.sent
          ? `Sent to Wilson — ${data.count} work order${data.count > 1 ? 's' : ''} across ${data.clients} client${data.clients > 1 ? 's' : ''}`
          : 'No new work orders to send this week',
      )
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to notify Wilson')
    } finally {
      setNotifying(false)
    }
  }

  if (loading) return <Loading />

  const reviewed = clients.filter(c => c.review).length
  const total = clients.length

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="text-sm text-muted-foreground">
          Week of <span className="text-foreground font-medium">{week ? formatDate(week) : '—'}</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className={cn('font-semibold', reviewed === total && total > 0 ? 'text-emerald-400' : 'text-foreground')}>
              {reviewed}
            </span>
            <span className="text-muted-foreground"> of {total} reviewed this week</span>
          </div>
          <button
            onClick={notifyWilson}
            disabled={notifying}
            className="inline-flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-lg bg-secondary/60 text-foreground hover:bg-secondary border border-border/40 disabled:opacity-50 transition-colors"
          >
            {notifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Notify Wilson
          </button>
        </div>
      </div>

      {total === 0 && (
        <EmptyState text="No active clients running ads. Clients in active stages will appear here for weekly review." />
      )}

      <div className="space-y-3">
        {clients.map(c => (
          <ClientReviewCard key={c.id} client={c} week={week} creatives={creatives} onSaved={load} />
        ))}
      </div>
    </div>
  )
}

function ClientReviewCard({ client, week, creatives, onSaved }: { client: BoardClient; week: string; creatives: CreativeOption[]; onSaved: () => void }) {
  const existing = client.review
  const slot1 = client.ads.find(a => a.slot === 1)
  const slot2 = client.ads.find(a => a.slot === 2)

  const [r1, setR1] = useState<AdRating | undefined>(existing?.ad1_rating)
  const [r2, setR2] = useState<AdRating | undefined>(existing?.ad2_rating)
  const [cr1, setCr1] = useState(existing?.ad1_creative ?? slot1?.creative ?? '')
  const [cr2, setCr2] = useState(existing?.ad2_creative ?? slot2?.creative ?? '')
  const [notes, setNotes] = useState(existing?.notes ?? '')
  const [saving, setSaving] = useState(false)
  const [expanded, setExpanded] = useState(!existing)

  const adLink = client.ad_account_link || client.campaign_link

  async function save() {
    if (!r1 || !r2) { toast.error('Rate both ads first'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/media/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          week,
          ad1: { id: slot1?.id, rating: r1, creative: cr1.trim() || null },
          ad2: { id: slot2?.id, rating: r2, creative: cr2.trim() || null },
          notes: notes || null,
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      const data = await res.json()
      toast.success(
        data.orders_created > 0
          ? `${DECISION_LABEL[data.decision as MediaDecision]} — ${data.orders_created} work order${data.orders_created > 1 ? 's' : ''} created`
          : DECISION_LABEL[data.decision as MediaDecision],
      )
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save review')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn(
      'rounded-xl border bg-card overflow-hidden transition-colors',
      existing ? 'border-emerald-500/25' : 'border-border/50',
    )}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-secondary/20 transition-colors"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-foreground truncate">{client.name}</span>
            {client.market_location && (
              <span className="text-xs text-muted-foreground/70 truncate">{client.market_location}</span>
            )}
          </div>
          {client.business_name && client.business_name !== client.name && (
            <div className="text-xs text-muted-foreground/60 truncate">{client.business_name}</div>
          )}
        </div>

        {existing?.decision && (
          <span className={cn('hidden sm:inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full border', DECISION_STYLE[existing.decision])}>
            {DECISION_LABEL[existing.decision]}
          </span>
        )}
        {existing ? (
          <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium">
            <Check className="w-3.5 h-3.5" /> Reviewed
          </span>
        ) : (
          <span className="text-xs text-amber-400 font-medium">Pending</span>
        )}
        <ChevronDown className={cn('w-4 h-4 text-muted-foreground transition-transform', expanded && 'rotate-180')} />
      </button>

      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/40">
          {adLink && (
            <a
              href={adLink} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mb-3 mt-3"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open ad account
            </a>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <AdSlotRater slot={1} ad={slot1} rating={r1} onRating={setR1} creative={cr1} onCreative={setCr1} creatives={creatives} />
            <AdSlotRater slot={2} ad={slot2} rating={r2} onRating={setR2} creative={cr2} onCreative={setCr2} creatives={creatives} />
          </div>

          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full mt-3 bg-secondary/30 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40 resize-none"
          />

          <div className="flex items-center justify-end gap-2 mt-3">
            <button
              onClick={save}
              disabled={saving || !r1 || !r2}
              className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              {existing ? 'Update review' : 'Save review'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function AdSlotRater({
  slot, ad, rating, onRating, creative, onCreative, creatives,
}: {
  slot: number
  ad?: MediaAd
  rating?: AdRating
  onRating: (r: AdRating) => void
  creative: string
  onCreative: (v: string) => void
  creatives: CreativeOption[]
}) {
  const running = daysRunning(ad?.launched_at)
  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-muted-foreground/80 uppercase tracking-wide">Ad {slot}</span>
        {ad?.status === 'paused' && <span className="text-[10px] text-amber-400 font-medium">PAUSED</span>}
      </div>
      {ad ? (
        <div className="mb-2.5">
          <div className="text-sm text-foreground truncate">{ad.name || ad.service_type || 'Untitled ad'}</div>
          <div className="text-[11px] text-muted-foreground/60">
            {running != null ? `Running ${running}d` : 'Not launched'}
            {ad.angle ? ` · ${ad.angle}` : ''}
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground/50 mb-2.5 italic">No ad in this slot yet</div>
      )}

      <div className="flex items-center gap-1.5 mb-2">
        {RATINGS.map(r => (
          <button
            key={r.value}
            onClick={() => onRating(r.value)}
            className={cn(
              'flex-1 text-xs font-medium px-2 py-1.5 rounded-md border transition-colors',
              rating === r.value ? r.active : r.idle,
            )}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground/60">Creative</span>
        <CreativeSelect value={creative} onChange={onCreative} creatives={creatives} className="flex-1" />
      </div>
    </div>
  )
}

// Dropdown of library creatives (keeps review/library entries linked to the
// Creative Library). Preserves an off-list value so a retired/legacy code isn't
// silently dropped.
function CreativeSelect({ value, onChange, creatives, className }: {
  value: string; onChange: (v: string) => void; creatives: CreativeOption[]; className?: string
}) {
  const codes = creatives.map(c => c.code)
  const offList = value && !codes.includes(value)
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={cn('bg-secondary/40 border border-border/40 rounded-md px-2 py-1 text-sm text-foreground outline-none focus:border-primary/40', className)}
    >
      <option value="">— none —</option>
      {creatives.map(c => (
        <option key={c.code} value={c.code}>{c.name ? `${c.code} · ${c.name}` : c.code}</option>
      ))}
      {offList && <option value={value}>{value} (retired)</option>}
    </select>
  )
}

// ─── Work Orders: Wilson's queue ────────────────────────────────────────────────

const WO_FILTERS: { id: string; label: string }[] = [
  { id: 'todo', label: 'To Do' },
  { id: 'in_production', label: 'In Production' },
  { id: 'produced', label: 'Produced' },
  { id: 'done', label: 'Launched' },
  { id: 'all', label: 'All' },
]

function OrdersView() {
  const [filter, setFilter] = useState('todo')
  const [orders, setOrders] = useState<MediaWorkOrder[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/media/work-orders?status=${filter}`)
      setOrders(await res.json())
    } catch {
      toast.error('Failed to load work orders')
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => { load() }, [load])

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-4 flex-wrap">
        {WO_FILTERS.map(f => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={cn(
              'text-xs font-medium px-3 py-1.5 rounded-full border transition-colors',
              filter === f.id ? 'bg-primary/15 text-primary border-primary/30' : 'text-muted-foreground border-border/40 hover:text-foreground',
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : orders.length === 0 ? (
        <EmptyState text="No work orders here. New ones are created automatically when Samuel's review calls for a new ad." />
      ) : (
        <div className="space-y-2.5">
          {orders.map(o => <WorkOrderCard key={o.id} order={o} onChange={load} />)}
        </div>
      )}
    </div>
  )
}

function WorkOrderCard({ order, onChange }: { order: MediaWorkOrder; onChange: () => void }) {
  const [busy, setBusy] = useState(false)
  const [video, setVideo] = useState(order.video_link ?? '')
  const [creative, setCreative] = useState(order.target_creative ?? '')
  const st = WO_STATUS_STYLE[order.status]

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(true)
    try {
      const res = await fetch(`/api/media/work-orders/${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Updated')
      onChange()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  async function cancel() {
    if (!confirm('Cancel this work order?')) return
    setBusy(true)
    try {
      const res = await fetch(`/api/media/work-orders/${order.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Cancelled')
      onChange()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to cancel')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{order.client?.name ?? 'Client'}</span>
            {order.target_creative && (
              <span className="inline-flex items-center text-xs font-mono font-semibold px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/25">
                {order.target_creative}
              </span>
            )}
            <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border', st.color)}>
              <span className={cn('w-1.5 h-1.5 rounded-full', st.dot)} />{WORK_ORDER_STATUS_LABEL[order.status]}
            </span>
          </div>
          <div className="text-xs text-muted-foreground/70 mt-1">
            {order.client?.advertised_package || order.notes || 'Produce a new ad'}
          </div>
          {order.produced_by && (
            <div className="text-[11px] text-muted-foreground/50 mt-1">
              {order.produced_by}{order.produced_at ? ` · produced ${formatDate(order.produced_at)}` : ''}
            </div>
          )}
        </div>
        {order.status !== 'done' && (
          <button onClick={cancel} disabled={busy} className="text-muted-foreground/40 hover:text-red-400 transition-colors p-1">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Launch inputs — Samuel pastes the produced video + assigns its code */}
      {order.status === 'produced' && (
        <>
          <input
            value={video}
            onChange={e => setVideo(e.target.value)}
            placeholder="Video link (Drive, Frame.io, etc.)"
            className="w-full mt-3 bg-secondary/30 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40"
          />
          <input
            value={creative}
            onChange={e => setCreative(e.target.value)}
            placeholder="Creative code (e.g. V300, cr6)"
            className="w-full mt-2 bg-secondary/30 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/40"
          />
        </>
      )}
      {order.video_link && order.status === 'done' && (
        <a href={order.video_link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline mt-2">
          <ExternalLink className="w-3.5 h-3.5" /> Video
        </a>
      )}

      {/* Actions — Wilson produces from his Team queue; Samuel launches here */}
      <div className="flex items-center gap-2 mt-3">
        {(order.status === 'todo' || order.status === 'in_production') && (
          <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground/60">
            <Clock className="w-3.5 h-3.5" />
            {order.status === 'todo' ? "Queued in Wilson's Team tab" : 'Wilson is producing this…'}
          </span>
        )}
        {order.status === 'produced' && (
          <ActionBtn onClick={() => act('launch', { video_link: video || null, creative: creative.trim() || null })} busy={busy} icon={Rocket} label="Launch to account" primary />
        )}
      </div>
    </div>
  )
}

function ActionBtn({ onClick, busy, icon: Icon, label, primary }: {
  onClick: () => void; busy: boolean; icon: typeof PlayCircle; label: string; primary?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={busy}
      className={cn(
        'inline-flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-lg transition-colors disabled:opacity-50',
        primary ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-secondary/60 text-foreground hover:bg-secondary border border-border/40',
      )}
    >
      {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Icon className="w-4 h-4" />}{label}
    </button>
  )
}

// ─── Ad Library: per-client active + retired history ────────────────────────────

function LibraryView() {
  const [clients, setClients] = useState<BoardClient[]>([])
  const [creatives, setCreatives] = useState<CreativeOption[]>([])
  const [selected, setSelected] = useState<string>('')
  const [ads, setAds] = useState<MediaAd[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingAds, setLoadingAds] = useState(false)
  const [adding, setAdding] = useState(false)

  const loadAds = useCallback((clientId: string) => {
    if (!clientId) return
    setLoadingAds(true)
    fetch(`/api/media/ads?client_id=${clientId}`)
      .then(r => r.json())
      .then(setAds)
      .catch(() => toast.error('Failed to load ads'))
      .finally(() => setLoadingAds(false))
  }, [])

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/media/board')
        const data = await res.json()
        setClients(data.clients ?? [])
        setCreatives(data.creatives ?? [])
        if (data.clients?.length) setSelected(data.clients[0].id)
      } catch {
        toast.error('Failed to load clients')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  useEffect(() => { loadAds(selected) }, [selected, loadAds])

  if (loading) return <Loading />
  if (clients.length === 0) return <EmptyState text="No active clients running ads yet." />

  const active = ads.filter(a => a.status === 'active' || a.status === 'paused' || a.status === 'in_production')
  const retired = ads.filter(a => a.status === 'retired')

  const usedSlots = new Set(active.map(a => a.slot).filter(Boolean))
  const openSlots = [1, 2].filter(s => !usedSlots.has(s))

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-5 flex-wrap">
        <select
          value={selected}
          onChange={e => setSelected(e.target.value)}
          className="bg-secondary/40 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
        >
          {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        {openSlots.length > 0 && !adding && (
          <button
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-2 text-sm font-medium px-3.5 py-2 rounded-lg bg-secondary/60 text-foreground hover:bg-secondary border border-border/40 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add current ad
          </button>
        )}
      </div>

      {adding && (
        <AddAdForm
          clientId={selected}
          openSlots={openSlots}
          creatives={creatives}
          onClose={() => setAdding(false)}
          onSaved={() => { setAdding(false); loadAds(selected) }}
        />
      )}

      {loadingAds ? <Loading /> : (
        <div className="space-y-6">
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">Active slots</h3>
            {active.length === 0 ? (
              <div className="text-sm text-muted-foreground/50 italic">No active ads.</div>
            ) : (
              <div className="space-y-2">{active.map(a => <AdRow key={a.id} ad={a} />)}</div>
            )}
          </div>
          <div>
            <h3 className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">Retired</h3>
            {retired.length === 0 ? (
              <div className="text-sm text-muted-foreground/50 italic">No retired ads yet.</div>
            ) : (
              <div className="space-y-2">{retired.map(a => <AdRow key={a.id} ad={a} retired />)}</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function AddAdForm({ clientId, openSlots, creatives, onClose, onSaved }: {
  clientId: string; openSlots: number[]; creatives: CreativeOption[]; onClose: () => void; onSaved: () => void
}) {
  const [slot, setSlot] = useState(openSlots[0])
  const [name, setName] = useState('')
  const [serviceType, setServiceType] = useState('')
  const [angle, setAngle] = useState('')
  const [videoLink, setVideoLink] = useState('')
  const [creative, setCreative] = useState('')
  const [saving, setSaving] = useState(false)

  async function save() {
    setSaving(true)
    try {
      const res = await fetch('/api/media/ads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: clientId,
          slot,
          name: name || null,
          service_type: serviceType || null,
          angle: angle || null,
          video_link: videoLink || null,
          creative: creative.trim() || null,
          status: 'active',
        }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success('Ad added')
      onSaved()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add ad')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4 mb-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="text-xs text-muted-foreground/70">
          Slot
          <select
            value={slot}
            onChange={e => setSlot(Number(e.target.value))}
            className="w-full mt-1 bg-secondary/40 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground outline-none focus:border-primary/40"
          >
            {openSlots.map(s => <option key={s} value={s}>Ad {s}</option>)}
          </select>
        </label>
        <Field label="Ad name" value={name} onChange={setName} placeholder="e.g. Ceramic offer v3" />
        <label className="text-xs text-muted-foreground/70">
          Creative
          <CreativeSelect value={creative} onChange={setCreative} creatives={creatives} className="w-full mt-1 px-3 py-2 rounded-lg" />
        </label>
        <Field label="Service type" value={serviceType} onChange={setServiceType} placeholder="e.g. Ceramic coating" />
        <Field label="Angle" value={angle} onChange={setAngle} placeholder="e.g. Before/after" />
        <Field label="Video link" value={videoLink} onChange={setVideoLink} placeholder="Drive / Frame.io URL" />
      </div>
      <div className="flex items-center justify-end gap-2 mt-3">
        <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground px-3 py-2">Cancel</button>
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add ad
        </button>
      </div>
    </div>
  )
}

function Field({ label, value, onChange, placeholder, inputMode }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; inputMode?: 'decimal'
}) {
  return (
    <label className="text-xs text-muted-foreground/70">
      {label}
      <input
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        className="w-full mt-1 bg-secondary/40 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40"
      />
    </label>
  )
}

function AdRow({ ad, retired }: { ad: MediaAd; retired?: boolean }) {
  const run = retired
    ? (ad.launched_at && ad.retired_at
        ? Math.max(0, Math.floor((new Date(ad.retired_at).getTime() - new Date(ad.launched_at).getTime()) / 86400000))
        : null)
    : daysRunning(ad.launched_at)

  return (
    <div className={cn('rounded-lg border bg-card px-4 py-3', retired ? 'border-border/30 opacity-80' : 'border-border/50')}>
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {ad.slot && <span className="text-[11px] text-muted-foreground/60 font-medium">Slot {ad.slot}</span>}
            <span className="text-sm font-medium text-foreground truncate">{ad.name || ad.service_type || 'Untitled ad'}</span>
            {ad.rating && (
              <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60">{RATING_LABEL[ad.rating]}</span>
            )}
          </div>
          <div className="text-[11px] text-muted-foreground/60 mt-0.5">
            {[
              ad.angle,
              run != null ? (retired ? `ran ${run}d` : `running ${run}d`) : null,
              ad.launched_at ? `launched ${formatDate(ad.launched_at)}` : null,
              retired && ad.retired_at ? `retired ${formatDate(ad.retired_at)}` : null,
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
        {ad.creative && (
          <div className="text-right">
            <div className="text-sm font-mono font-semibold text-foreground">{ad.creative}</div>
            <div className="text-[10px] text-muted-foreground/50">creative</div>
          </div>
        )}
        {ad.video_link && (
          <a href={ad.video_link} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
            <ExternalLink className="w-4 h-4" />
          </a>
        )}
      </div>
    </div>
  )
}

// ─── Creatives: admin-only library + performance ────────────────────────────────

function CreativesView() {
  const [rows, setRows] = useState<MediaCreativeStats[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [notes, setNotes] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/media/creatives')
      if (!res.ok) throw new Error((await res.json()).error)
      setRows(await res.json())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load creatives')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function addCreative() {
    if (!code.trim()) { toast.error('Enter a creative code'); return }
    setAdding(true)
    try {
      const res = await fetch('/api/media/creatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), name: name.trim() || null, notes: notes.trim() || null }),
      })
      if (!res.ok) throw new Error((await res.json()).error)
      toast.success(`Added ${code.trim()}`)
      setCode(''); setName(''); setNotes('')
      load()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add creative')
    } finally {
      setAdding(false)
    }
  }

  async function patchCreative(id: string, body: Record<string, unknown>) {
    const res = await fetch(`/api/media/creatives/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!res.ok) { toast.error((await res.json()).error ?? 'Update failed'); return }
    load()
  }

  async function removeCreative(id: string, codeLabel: string) {
    if (!confirm(`Delete creative ${codeLabel}? Its past ad history stays; it just leaves the assignment pool.`)) return
    const res = await fetch(`/api/media/creatives/${id}`, { method: 'DELETE' })
    if (!res.ok) { toast.error('Delete failed'); return }
    toast.success('Deleted'); load()
  }

  if (loading) return <Loading />

  return (
    <div>
      {/* Add creative */}
      <div className="rounded-xl border border-border/50 bg-card p-4 mb-5">
        <div className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider mb-2">Add creative</div>
        <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-2">
          <input value={code} onChange={e => setCode(e.target.value)} placeholder="Code (V300)"
            className="bg-secondary/40 border border-border/40 rounded-lg px-3 py-2 text-sm font-mono text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40" />
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Name / label (optional)"
            className="bg-secondary/40 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40" />
        </div>
        <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Direction / clips / template notes (optional)"
          className="w-full mt-2 bg-secondary/40 border border-border/40 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none focus:border-primary/40" />
        <div className="flex justify-end mt-2">
          <button onClick={addCreative} disabled={adding}
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Add
          </button>
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState text="No creatives yet. Add your master creatives here — the engine assigns them to clients automatically." />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/50">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[11px] uppercase tracking-wider text-muted-foreground/60 bg-secondary/30">
                <th className="text-left font-medium px-3 py-2">Creative</th>
                <th className="text-center font-medium px-3 py-2">Score</th>
                <th className="text-center font-medium px-3 py-2">Deploys</th>
                <th className="text-center font-medium px-3 py-2">G / D / B</th>
                <th className="text-center font-medium px-3 py-2">Avg CPL</th>
                <th className="text-center font-medium px-3 py-2">Running</th>
                <th className="text-right font-medium px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.id} className={cn('border-t border-border/40', r.status === 'retired' && 'opacity-50')}>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-semibold text-foreground">{r.code}</span>
                      {r.status === 'retired' && <span className="text-[10px] uppercase text-muted-foreground/60">retired</span>}
                    </div>
                    {r.name && <div className="text-[11px] text-muted-foreground/60">{r.name}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {r.score == null ? <span className="text-muted-foreground/40">—</span> : (
                      <span className={cn('font-semibold', r.score >= 1.5 ? 'text-emerald-400' : r.score >= 0.75 ? 'text-blue-400' : 'text-red-400')}>
                        {r.score.toFixed(2)}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">{r.deployments}</td>
                  <td className="px-3 py-2.5 text-center text-xs">
                    <span className="text-emerald-400">{r.good}</span>
                    <span className="text-muted-foreground/40"> / </span>
                    <span className="text-blue-400">{r.decent}</span>
                    <span className="text-muted-foreground/40"> / </span>
                    <span className="text-red-400">{r.bad}</span>
                  </td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">{r.avg_cpl == null ? '—' : `$${r.avg_cpl.toFixed(0)}`}</td>
                  <td className="px-3 py-2.5 text-center text-muted-foreground">{r.running_now}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        onClick={() => patchCreative(r.id, { status: r.status === 'active' ? 'retired' : 'active' })}
                        className="text-[11px] font-medium px-2 py-1 rounded-md border border-border/40 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        {r.status === 'active' ? 'Retire' : 'Reactivate'}
                      </button>
                      <button onClick={() => removeCreative(r.id, r.code)} className="text-muted-foreground/40 hover:text-red-400 transition-colors p-1">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[11px] text-muted-foreground/50 mt-3">
        Score = mean of Good(2)/Decent(1)/Bad(0). The engine deploys high scorers and fast-tracks under-tested creatives so new designs get reps.
      </p>
    </div>
  )
}

// ─── Shared ─────────────────────────────────────────────────────────────────────

function Loading() {
  return (
    <div className="flex items-center justify-center py-16 text-muted-foreground">
      <Loader2 className="w-5 h-5 animate-spin" />
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border/50 bg-card/40 px-6 py-12 text-center">
      <p className="text-sm text-muted-foreground/70 max-w-md mx-auto">{text}</p>
    </div>
  )
}
