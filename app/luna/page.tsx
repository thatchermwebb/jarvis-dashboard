'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Moon, Check, ChevronDown } from 'lucide-react'
import { cn, formatCurrency } from '@/lib/utils'

interface LunaClient {
  id: string
  name: string
  business_name?: string | null
  stage?: string | null
  running_in_luna?: boolean
  luna_live?: boolean
  luna_subscription_sent?: boolean
  luna_payment_amount?: number | null
  luna_payment_frequency?: string | null
}

const STAGES: { value: string; label: string; color: string; dot: string }[] = [
  { value: 'onboarding',         label: 'Onboarding',            color: 'text-blue-400',    dot: 'bg-blue-400' },
  { value: 'free_trial_pending', label: 'Free Trial — Pending',  color: 'text-yellow-400',  dot: 'bg-yellow-400' },
  { value: 'free_trial',         label: 'Free Trial — Active',   color: 'text-cyan-400',    dot: 'bg-cyan-400' },
  { value: 'trial_concluded',    label: 'Free Trial — Complete', color: 'text-violet-400',  dot: 'bg-violet-400' },
  { value: 'active_client',      label: 'Active',                color: 'text-emerald-400', dot: 'bg-emerald-400' },
  { value: 'overdue',            label: 'Overdue',               color: 'text-red-400',     dot: 'bg-red-400' },
  { value: 'paused',             label: 'Paused',                color: 'text-amber-400',   dot: 'bg-amber-400' },
  { value: 'churned',            label: 'Churned',               color: 'text-zinc-400',    dot: 'bg-zinc-400' },
  { value: 'free_trial_lost',    label: 'Free Trial — Lost',     color: 'text-rose-400',    dot: 'bg-rose-400' },
]
const stageMeta = (stage?: string | null) =>
  STAGES.find(s => s.value === stage) ?? { value: stage ?? '', label: stage || '—', color: 'text-muted-foreground', dot: 'bg-muted-foreground/40' }

const FREQS = ['day', 'week', 'month'] as const

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
  // Status picker: fixed-positioned menu (the table card clips overflow).
  const [statusMenu, setStatusMenu] = useState<{ id: string; x: number; y: number } | null>(null)

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

                    {/* Luna live toggle */}
                    <td className="py-3 px-2">
                      <StatusDot
                        on={!!c.luna_live}
                        onLabel="Live"
                        offLabel="Off"
                        onClick={() => patch(c.id, { luna_live: !c.luna_live })}
                      />
                    </td>

                    {/* Subscription sent toggle */}
                    <td className="py-3 px-2">
                      <StatusDot
                        on={!!c.luna_subscription_sent}
                        onLabel="Sent"
                        offLabel="Not sent"
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

                    <td className="py-3 px-2 pr-5 whitespace-nowrap">
                      {(() => {
                        const meta = stageMeta(c.stage)
                        return (
                          <button
                            onClick={(e) => {
                              const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
                              setStatusMenu(statusMenu?.id === c.id ? null : { id: c.id, x: Math.min(r.left, window.innerWidth - 210), y: r.bottom + 4 })
                            }}
                            className="inline-flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                          >
                            <span className={cn('w-2 h-2 rounded-full flex-shrink-0', meta.dot)} />
                            <span className={cn('text-sm', meta.color)}>{meta.label}</span>
                            <ChevronDown className="w-3 h-3 text-muted-foreground/50" />
                          </button>
                        )
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Status picker menu — fixed so it escapes the table's overflow clipping. */}
      {statusMenu && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setStatusMenu(null)} />
          <div
            className="fixed z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden min-w-[200px] p-1"
            style={{ top: statusMenu.y, left: statusMenu.x }}
          >
            {STAGES.map(s => {
              const current = clients.find(c => c.id === statusMenu.id)?.stage
              return (
                <button
                  key={s.value}
                  onClick={() => { patch(statusMenu.id, { stage: s.value }); setStatusMenu(null) }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-2.5 py-2 text-left text-xs rounded-lg transition-colors hover:bg-secondary/50',
                    s.value === current && 'bg-secondary/40',
                  )}
                >
                  <span className={cn('w-2 h-2 rounded-full flex-shrink-0', s.dot)} />
                  <span className={cn('flex-1', s.color)}>{s.label}</span>
                  {s.value === current && <Check className="w-3 h-3 opacity-60" />}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

function StatusDot({ on, onLabel, offLabel, onClick }: {
  on: boolean; onLabel: string; offLabel: string; onClick: () => void
}) {
  return (
    <button onClick={onClick} className="inline-flex items-center gap-1.5 group" title="Click to toggle">
      <span className={cn(
        'w-2.5 h-2.5 rounded-full flex-shrink-0 transition-all',
        on ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-muted-foreground/30 group-hover:bg-muted-foreground/50',
      )} />
      <span className={cn('text-sm', on ? 'text-foreground' : 'text-muted-foreground/60')}>
        {on ? onLabel : offLabel}
      </span>
    </button>
  )
}
