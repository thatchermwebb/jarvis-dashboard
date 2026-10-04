'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Moon, Check } from 'lucide-react'
import { cn, formatCurrency, formatDate, localToday, daysSince } from '@/lib/utils'

interface LunaClient {
  id: string
  name: string
  business_name?: string | null
  running_in_luna?: boolean
  luna_live?: boolean
  luna_subscription_sent?: boolean
  luna_payment_amount?: number | null
  luna_payment_frequency?: string | null
  luna_paused_at?: string | null
  luna_failed_at?: string | null
  luna_pause_type?: string | null
}

// Compact date, e.g. "Oct 3".
const shortDate = (d?: string | null) => (d ? formatDate(d).replace(/,?\s*\d{4}$/, '') : '')

const FREQS = ['day', 'week', 'month'] as const

// Luna ad state: Live, or paused as a Client vs a Trial.
const LUNA_STATES: { key: string; label: string; color: string; dot: string; glow?: boolean; live: boolean; type: string | null }[] = [
  { key: 'live',   label: 'Live',            color: 'text-emerald-400', dot: 'bg-emerald-400', glow: true, live: true,  type: null },
  { key: 'client', label: 'Paused (Client)', color: 'text-amber-400',   dot: 'bg-amber-400',               live: false, type: 'client' },
  { key: 'trial',  label: 'Pause (Trial)',   color: 'text-yellow-300',  dot: 'bg-yellow-300',              live: false, type: 'trial' },
]
const lunaState = (c: LunaClient) =>
  c.luna_live === false
    ? (LUNA_STATES.find(s => !s.live && s.type === (c.luna_pause_type || 'client')) ?? LUNA_STATES[1])
    : LUNA_STATES[0]

function paymentLabel(c: LunaClient) {
  if (c.luna_payment_amount == null) return null
  const freq = c.luna_payment_frequency || 'month'
  return `${formatCurrency(c.luna_payment_amount)}/${freq}`
}

export default function LunaPage() {
  const router = useRouter()
  const [clients, setClients] = useState<LunaClient[]>([])
  const [loading, setLoading] = useState(true)
  const [editingPay, setEditingPay] = useState<string | null>(null)
  const [payAmount, setPayAmount] = useState('')
  const [payFreq, setPayFreq] = useState<string>('week')
  // Inline date editor for the paused / failed dates.
  const [editDate, setEditDate] = useState<{ id: string; field: 'luna_paused_at' | 'luna_failed_at' } | null>(null)
  // Fixed-positioned Luna-state picker (the table card clips overflow).
  const [lunaMenu, setLunaMenu] = useState<{ id: string; x: number; y: number } | null>(null)

  function setLunaState(c: LunaClient, s: typeof LUNA_STATES[number]) {
    patch(c.id, {
      luna_live: s.live,
      luna_pause_type: s.type,
      // Stamp the paused date when entering a paused state (keep an existing one);
      // clear it when going Live.
      luna_paused_at: s.live ? null : (c.luna_paused_at || localToday()),
    })
    setLunaMenu(null)
  }

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/luna')
      const data = await res.json()
      setClients(Array.isArray(data) ? data : [])
    } catch {
      setClients([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function patch(id: string, field: Partial<LunaClient>) {
    // optimistic
    setClients(prev => prev.map(c => c.id === id ? { ...c, ...field } : c))
    try {
      const res = await fetch(`/api/clients/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(field),
      })
      if (!res.ok) throw new Error()
    } catch {
      toast.error('Failed to update')
      load()
    }
  }

  function savePayment(id: string) {
    const amount = payAmount.trim() === '' ? null : Number(payAmount)
    if (amount != null && (isNaN(amount) || amount < 0)) { toast.error('Invalid amount'); return }
    patch(id, { luna_payment_amount: amount, luna_payment_frequency: payFreq })
    setEditingPay(null)
  }

  const totals = useMemo(() => {
    // Normalize each client's recurring bill to a weekly figure for a quick total.
    const perWeek = (c: LunaClient) => {
      if (c.luna_payment_amount == null) return 0
      const a = c.luna_payment_amount
      if (c.luna_payment_frequency === 'day') return a * 7
      if (c.luna_payment_frequency === 'month') return a / 4.345
      return a // week (default)
    }
    return { weekly: clients.reduce((s, c) => s + perWeek(c), 0) }
  }, [clients])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight flex items-center gap-2">
            <Moon className="w-6 h-6 text-purple-400" /> Luna
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Clients whose ad-spend we run and bill on a recurring subscription.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="bg-card border border-border rounded-xl px-4 py-2 text-center">
            <div className="text-xl font-bold text-purple-300">{clients.length}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">In Luna</div>
          </div>
          <div className="bg-card border border-border rounded-xl px-4 py-2 text-center">
            <div className="text-xl font-bold text-emerald-400">{formatCurrency(Math.round(totals.weekly))}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider">~ / week</div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">{[...Array(5)].map((_, i) => <div key={i} className="h-12 bg-card border border-border rounded-xl animate-pulse" />)}</div>
      ) : clients.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-10 text-center">
          <Moon className="w-8 h-8 text-purple-400/50 mx-auto mb-3" />
          <div className="text-sm font-medium text-foreground">No clients in Luna yet</div>
          <div className="text-xs text-muted-foreground mt-1">
            Toggle “Running in Luna” on a client’s profile (under Advertised Package) to add them here.
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs text-muted-foreground uppercase tracking-wider">
                  <th className="py-3 pl-5 pr-2 font-semibold w-10">#</th>
                  <th className="py-3 px-2 font-semibold">Client</th>
                  <th className="py-3 px-2 font-semibold">Business</th>
                  <th className="py-3 px-2 font-semibold">Luna</th>
                  <th className="py-3 px-2 font-semibold">Subscription</th>
                  <th className="py-3 px-2 font-semibold">Payment</th>
                  <th className="py-3 px-2 pr-5 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c, i) => (
                  <tr key={c.id} className="border-b border-border/40 last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="py-3 pl-5 pr-2 text-muted-foreground/60">{i + 1}</td>
                    <td className="py-3 px-2">
                      <button onClick={() => router.push(`/clients/${c.id}`)} className="font-medium text-foreground hover:text-purple-300 transition-colors text-left">
                        {c.name?.trim() || '—'}
                      </button>
                    </td>
                    <td className="py-3 px-2 text-muted-foreground">{c.business_name || '—'}</td>

                    {/* Luna: Live / Paused (Client) / Pause (Trial) (+ date paused) */}
                    <td className="py-3 px-2 align-top">
                      <div className="space-y-0.5">
                        {(() => {
                          const st = lunaState(c)
                          return (
                            <button
                              onClick={(e) => {
                                const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                                setLunaMenu(lunaMenu?.id === c.id ? null : { id: c.id, x: Math.min(r.left, window.innerWidth - 210), y: r.bottom + 4 })
                              }}
                              className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                            >
                              <span className={cn('w-2.5 h-2.5 rounded-full flex-shrink-0', st.dot, st.glow && 'shadow-[0_0_8px_rgba(52,211,153,0.6)]')} />
                              <span className={cn('text-sm', st.color)}>{st.label}</span>
                            </button>
                          )
                        })()}
                        {c.luna_live === false && (
                          <DateLine
                            prefix="since"
                            value={c.luna_paused_at}
                            editing={editDate?.id === c.id && editDate.field === 'luna_paused_at'}
                            onOpen={() => setEditDate({ id: c.id, field: 'luna_paused_at' })}
                            onSave={(d) => { patch(c.id, { luna_paused_at: d || null }); setEditDate(null) }}
                            onCancel={() => setEditDate(null)}
                          />
                        )}
                      </div>
                    </td>

                    {/* Subscription: Sent / Not sent */}
                    <td className="py-3 px-2">
                      <Toggle
                        a={{ label: 'Sent', color: 'text-emerald-400', dot: 'bg-emerald-400', glow: true }}
                        b={{ label: 'Not sent', color: 'text-muted-foreground/60', dot: 'bg-muted-foreground/30' }}
                        isA={!!c.luna_subscription_sent}
                        onClick={() => patch(c.id, { luna_subscription_sent: !c.luna_subscription_sent })}
                      />
                    </td>

                    {/* Payment inline edit */}
                    <td className="py-3 px-2">
                      {editingPay === c.id ? (
                        <div className="flex items-center gap-1.5">
                          <span className="text-muted-foreground">$</span>
                          <input
                            type="number"
                            autoFocus
                            value={payAmount}
                            onChange={e => setPayAmount(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') savePayment(c.id); if (e.key === 'Escape') setEditingPay(null) }}
                            className="w-20 bg-secondary/60 border border-border/60 rounded-md px-2 py-1 text-sm text-foreground outline-none focus:border-purple-400/50"
                            placeholder="0"
                          />
                          <span className="text-muted-foreground">/</span>
                          <select
                            value={payFreq}
                            onChange={e => setPayFreq(e.target.value)}
                            className="bg-secondary/60 border border-border/60 rounded-md px-1.5 py-1 text-sm text-foreground outline-none cursor-pointer"
                          >
                            {FREQS.map(f => <option key={f} value={f}>{f}</option>)}
                          </select>
                          <button onClick={() => savePayment(c.id)} className="p-1 rounded-md bg-purple-500/20 text-purple-300 hover:bg-purple-500/30">
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setPayAmount(c.luna_payment_amount != null ? String(c.luna_payment_amount) : '')
                            setPayFreq(c.luna_payment_frequency || 'week')
                            setEditingPay(c.id)
                          }}
                          className={cn('font-semibold hover:text-purple-300 transition-colors', paymentLabel(c) ? 'text-foreground' : 'text-muted-foreground/50 font-normal')}
                        >
                          {paymentLabel(c) ?? 'Set payment'}
                        </button>
                      )}
                    </td>

                    {/* Status: Active / Overdue (Overdue derived from the failed date) */}
                    <td className="py-3 px-2 pr-5 whitespace-nowrap align-top">
                      <div className="space-y-0.5">
                        <Toggle
                          a={{ label: 'Active', color: 'text-emerald-400', dot: 'bg-emerald-400', glow: true }}
                          b={{ label: c.luna_failed_at ? `Overdue · ${daysSince(c.luna_failed_at)}d` : 'Overdue', color: 'text-red-400', dot: 'bg-red-400' }}
                          isA={!c.luna_failed_at}
                          onClick={() => patch(c.id, { luna_failed_at: c.luna_failed_at ? null : localToday() })}
                        />
                        {c.luna_failed_at && (
                          <DateLine
                            prefix="failed"
                            value={c.luna_failed_at}
                            editing={editDate?.id === c.id && editDate.field === 'luna_failed_at'}
                            onOpen={() => setEditDate({ id: c.id, field: 'luna_failed_at' })}
                            onSave={(d) => { patch(c.id, { luna_failed_at: d || null }); setEditDate(null) }}
                            onCancel={() => setEditDate(null)}
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Luna-state picker — fixed so it escapes the table's overflow clipping. */}
      {lunaMenu && (() => {
        const c = clients.find(x => x.id === lunaMenu.id)
        if (!c) return null
        const currentKey = lunaState(c).key
        return (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setLunaMenu(null)} />
            <div className="fixed z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden min-w-[200px] p-1" style={{ top: lunaMenu.y, left: lunaMenu.x }}>
              {LUNA_STATES.map(s => (
                <button
                  key={s.key}
                  onClick={() => setLunaState(c, s)}
                  className={cn('w-full flex items-center gap-2.5 px-2.5 py-2 text-left text-xs rounded-lg transition-colors hover:bg-secondary/50', s.key === currentKey && 'bg-secondary/40')}
                >
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', s.dot)} />
                  <span className={cn('flex-1', s.color)}>{s.label}</span>
                  {s.key === currentKey && <Check className="w-3 h-3 opacity-60" />}
                </button>
              ))}
            </div>
          </>
        )
      })()}
    </div>
  )
}

// Small muted, editable date line under a status pill (e.g. "since Oct 3").
function DateLine({ prefix, value, editing, onOpen, onSave, onCancel }: {
  prefix: string; value?: string | null; editing: boolean
  onOpen: () => void; onSave: (d: string) => void; onCancel: () => void
}) {
  const [draft, setDraft] = useState(value || localToday())
  useEffect(() => { if (editing) setDraft(value || localToday()) }, [editing, value])
  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          type="date"
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSave(draft); if (e.key === 'Escape') onCancel() }}
          className="bg-secondary/60 border border-border/60 rounded-md px-1.5 py-0.5 text-[11px] text-foreground outline-none focus:border-purple-400/50"
        />
        <button onClick={() => onSave(draft)} className="p-0.5 rounded bg-purple-500/20 text-purple-300 hover:bg-purple-500/30">
          <Check className="w-3 h-3" />
        </button>
      </div>
    )
  }
  return (
    <button onClick={onOpen} className="text-[11px] text-muted-foreground/60 hover:text-muted-foreground transition-colors" title="Click to edit date">
      {prefix} {value ? shortDate(value) : '— set date'}
    </button>
  )
}

interface ToggleSide { label: string; color: string; dot: string; glow?: boolean }

// A click-to-flip two-state status pill (e.g. Live/Pause, Active/Overdue).
function Toggle({ a, b, isA, onClick }: { a: ToggleSide; b: ToggleSide; isA: boolean; onClick: () => void }) {
  const side = isA ? a : b
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity" title="Click to toggle">
      <span className={cn(
        'w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all',
        side.dot,
        side.glow && 'shadow-[0_0_8px_rgba(52,211,153,0.6)]',
      )} />
      <span className={cn('text-sm', side.color)}>{side.label}</span>
    </button>
  )
}
