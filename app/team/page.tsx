'use client'

import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { toast } from 'sonner'
import { Play, Pause, Square, Wallet, DollarSign, Flame, ChevronDown, Loader2, Inbox } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  VA_CONFIG, VA_IDS, isTeamVa, workedSeconds, workedHours,
  kpiSummary, kpiZone, kpiHit, kpiCountable,
  budgetElapsed, budgetFraction, budgetZone, kpiEligible, type VaConfig,
} from '@/lib/team'
import type { TeamTimeEntry, TeamVaId } from '@/types'
import { Tachometer } from '@/components/team/Tachometer'
import { BankMeter } from '@/components/team/BankMeter'
import { Confetti } from '@/components/team/Confetti'
import { CompletedCard } from '@/components/team/CompletedCard'

function fmtClock(secs: number): string {
  const h = Math.floor(secs / 3600)
  const m = Math.floor((secs % 3600) / 60)
  const s = secs % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export default function TeamPage() {
  const { user } = useAuth()
  const isAdmin = user?.userType === 'admin'
  const isVa = isTeamVa(user?.id)

  // Which VA's board are we looking at
  const [selectedVa, setSelectedVa] = useState<TeamVaId>(isTeamVa(user?.id) ? (user!.id as TeamVaId) : 'wilson')
  useEffect(() => { if (isTeamVa(user?.id)) setSelectedVa(user!.id as TeamVaId) }, [user])
  const cfg: VaConfig = VA_CONFIG[selectedVa]

  const [entries, setEntries] = useState<TeamTimeEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [now, setNow] = useState(Date.now())
  const [desc, setDesc] = useState('')
  const [newStandard, setNewStandard] = useState(true)
  const [creating, setCreating] = useState(false)
  const [confetti, setConfetti] = useState(0)
  const [flash, setFlash] = useState<'green' | 'amber' | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [history, setHistory] = useState<TeamTimeEntry[]>([])
  const [compile, setCompile] = useState<CompileResult | null>(null)
  const [compileOpen, setCompileOpen] = useState(false)

  const load = useCallback(async () => {
    const res = await fetch(`/api/team/entries?va_id=${selectedVa}&paid=false`)
    const data = await res.json()
    setEntries(Array.isArray(data) ? data : [])
    setLoading(false)
  }, [selectedVa])

  useEffect(() => { setLoading(true); load() }, [load])

  // ── Derived buckets ─────────────────────────────────────────────────────────
  const isInbox = (e: TeamTimeEntry) => e.status !== 'completed' && !!e.assigned_at && !e.started_at
  const inbox = entries.filter(isInbox)
    .sort((a, b) => Date.parse(a.assigned_at!) - Date.parse(b.assigned_at!)) // oldest = most urgent
  const active = entries.filter(e => e.status !== 'completed' && !isInbox(e))
    .sort((a, b) => Date.parse(a.created_at) - Date.parse(b.created_at))
  const completed = entries.filter(e => e.status === 'completed')
    .sort((a, b) => Date.parse(b.completed_at ?? b.created_at) - Date.parse(a.completed_at ?? a.created_at))

  // Tick while any task is running OR any assigned task is waiting (both clocks live)
  const needsTick = entries.some(e => e.status === 'running') || inbox.length > 0
  useEffect(() => {
    if (!needsTick) return
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [needsTick])

  const totalHours = useMemo(() => entries.reduce((s, e) => s + workedHours(e, now), 0), [entries, now])
  const bank = totalHours * cfg.rate
  const kpi = useMemo(() => kpiSummary(entries, cfg), [entries, cfg])
  const zone = kpiZone(kpi.pct)
  const unpaidStandard = entries.filter(kpiCountable).length

  // Consecutive KPI-hit streak from most recent completed standard task
  const streak = useMemo(() => {
    let n = 0
    for (const e of completed) {
      if (!kpiCountable(e)) continue
      if (kpiHit(e, cfg)) n++
      else break
    }
    return n
  }, [completed, cfg])

  // ── Actions ──────────────────────────────────────────────────────────────
  async function createAndStart() {
    const d = desc.trim()
    if (!d || creating) return
    setCreating(true)
    try {
      const res = await fetch('/api/team/entries', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ va_id: selectedVa, description: d, is_standard: newStandard }),
      })
      const entry = await res.json()
      if (!res.ok) throw new Error()
      // auto-start it
      await fetch(`/api/team/entries/${entry.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      })
      setDesc(''); setNewStandard(true)
      await load()
    } catch {
      toast.error('Could not start task')
    } finally { setCreating(false) }
  }

  async function timerAction(id: string, action: 'start' | 'pause' | 'resume' | 'complete') {
    const res = await fetch(`/api/team/entries/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const updated: TeamTimeEntry = await res.json()
    if (action === 'complete' && res.ok) {
      const hit = updated.is_standard && kpiHit(updated, cfg)
      if (hit) { setConfetti(c => c + 1); setFlash('green'); toast.success('KPI HIT! 🎯') }
      else if (updated.is_standard) { setFlash('amber') }
      setTimeout(() => setFlash(null), 900)
    }
    await load()
  }

  async function toggleStandard(id: string, value: boolean) {
    await fetch(`/api/team/entries/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_standard: value }),
    })
    await load()
  }

  async function deleteEntry(id: string) {
    await fetch(`/api/team/entries/${id}`, { method: 'DELETE' })
    await load()
  }

  async function markAllPaid() {
    if (!confirm(`Mark all of ${cfg.name}'s completed hours as paid? This clears the board.`)) return
    const res = await fetch('/api/team/pay', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ va_id: selectedVa }),
    })
    const data = await res.json()
    if (res.ok) { toast.success(`Paid out ${data.paid_count} task${data.paid_count === 1 ? '' : 's'}`); setConfetti(c => c + 1) }
    await load()
    if (historyOpen) loadHistory()
  }

  const loadHistory = useCallback(async () => {
    const res = await fetch(`/api/team/entries?va_id=${selectedVa}&paid=true`)
    const data = await res.json()
    setHistory(Array.isArray(data) ? data : [])
  }, [selectedVa])

  async function openCompile() {
    setCompileOpen(true)
    setCompile(null)
    const res = await fetch('/api/team/compile')
    setCompile(await res.json())
  }

  useEffect(() => { if (historyOpen) loadHistory() }, [historyOpen, loadHistory])

  if (user && !isAdmin && !isVa) {
    return <div className="max-w-md mx-auto mt-20 text-center text-muted-foreground">This page is for team members only.</div>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <Confetti trigger={confetti} />
      {flash && (
        <div className={cn('fixed inset-0 z-50 pointer-events-none animate-in fade-in duration-200',
          flash === 'green' ? 'bg-emerald-500/10' : 'bg-amber-500/10')} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Team</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {isAdmin ? 'Track VA hours & KPIs' : `Clock your tasks, ${cfg.name} — stay under ${Math.round(cfg.kpiSeconds / 60)} min for the bonus`}
          </p>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-secondary/40 border border-border/40 rounded-lg p-0.5">
              {VA_IDS.map(id => (
                <button key={id} onClick={() => setSelectedVa(id)}
                  className={cn('px-3 py-1.5 rounded-md text-xs font-medium transition-colors',
                    selectedVa === id ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {VA_CONFIG[id].name}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" className="h-9 text-xs gap-1.5" onClick={openCompile}>
              <Wallet className="w-3.5 h-3.5" /> Compile
            </Button>
            <Button size="sm" className="h-9 text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white" onClick={markAllPaid}>
              <DollarSign className="w-3.5 h-3.5" /> Mark all paid
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-5">
          {/* Assigned inbox — urgent, budget clock already ticking */}
          {inbox.length > 0 && (
            <div className="space-y-2">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-red-400/90 flex items-center gap-1.5">
                <Inbox className="w-3.5 h-3.5" /> Assigned — start now ({inbox.length})
              </h2>
              {inbox.map(e => {
                const elapsed = budgetElapsed(e, now) ?? 0
                const frac = budgetFraction(e, cfg, now) ?? 0
                const zone = budgetZone(frac)
                const eligible = kpiEligible(e)
                const left = cfg.kpiSeconds - elapsed
                const border = zone === 'red' ? 'border-red-500/40 bg-red-500/[0.05]'
                  : zone === 'yellow' ? 'border-amber-500/40 bg-amber-500/[0.04]'
                  : 'border-emerald-500/30 bg-emerald-500/[0.03]'
                const clockColor = !eligible ? 'text-muted-foreground/50'
                  : zone === 'red' ? 'text-red-400' : zone === 'yellow' ? 'text-amber-400' : 'text-emerald-400'
                return (
                  <div key={e.id} className={cn('rounded-2xl border p-4 flex items-center justify-between gap-4', border)}>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{e.description || 'Assigned task'}</div>
                      <div className={cn('text-[11px] mt-0.5 font-medium', clockColor)}>
                        {!eligible ? 'Off-hours · not counted'
                          : left > 0 ? `${Math.ceil(left / 60)} min of turnaround budget left`
                          : 'OVER budget — turnaround KPI already missed'}
                      </div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <div className={cn('text-2xl font-black tabular-nums', clockColor)}
                        style={zone === 'red' && eligible ? { animation: 'pulse 1.2s ease-in-out infinite' } : undefined}>
                        {fmtClock(elapsed)}
                      </div>
                      <Button size="sm" className="h-9 gap-1.5" onClick={() => timerAction(e.id, 'start')}>
                        <Play className="w-3.5 h-3.5" /> Start
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* New task */}
          <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                value={desc}
                onChange={e => setDesc(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') createAndStart() }}
                placeholder="What are you working on?"
                className="bg-secondary/40 border-border/50 text-sm h-11"
              />
              <Button onClick={createAndStart} disabled={!desc.trim() || creating}
                className="h-11 px-5 gap-1.5 flex-shrink-0">
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                Start
              </Button>
            </div>
            <button onClick={() => setNewStandard(v => !v)}
              className={cn('flex items-center gap-2 text-xs px-3 py-1.5 rounded-full border transition-colors',
                newStandard ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border text-muted-foreground hover:text-foreground')}>
              <span className={cn('w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center',
                newStandard ? 'border-primary bg-primary' : 'border-muted-foreground/40')}>
                {newStandard && <span className="w-1.5 h-1.5 rounded-full bg-background" />}
              </span>
              Standard task ({cfg.standardLabel}) — counts toward KPI
            </button>
          </div>

          {/* Active timers */}
          {active.map(e => {
            const secs = workedSeconds(e, now)
            const running = e.status === 'running'
            return (
              <div key={e.id} className={cn('rounded-2xl border p-4 transition-colors',
                running ? 'border-primary/40 bg-primary/[0.04]' : 'border-border bg-card')}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{e.description || 'Untitled task'}</div>
                    <button onClick={() => toggleStandard(e.id, !e.is_standard)}
                      className={cn('mt-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded border transition-colors',
                        e.is_standard ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border text-muted-foreground/60 hover:text-foreground')}>
                      {e.is_standard ? cfg.standardLabel : 'Non-standard'}
                    </button>
                  </div>
                  <div className={cn('text-3xl font-black tabular-nums flex-shrink-0',
                    running ? 'text-primary' : 'text-foreground/80')}
                    style={running ? { textShadow: '0 0 14px hsl(var(--primary)/0.4)' } : undefined}>
                    {fmtClock(secs)}
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {running ? (
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => timerAction(e.id, 'pause')}>
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </Button>
                  ) : (
                    <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs border-primary/40 text-primary" onClick={() => timerAction(e.id, 'resume')}>
                      <Play className="w-3.5 h-3.5" /> Resume
                    </Button>
                  )}
                  <Button size="sm" className="h-8 gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white" onClick={() => timerAction(e.id, 'complete')}>
                    <Square className="w-3.5 h-3.5" /> End task
                  </Button>
                  {/* live turnaround budget (from assignment) — the real KPI */}
                  {e.is_standard && (e.assigned_at ? (() => {
                    const left = cfg.kpiSeconds - (budgetElapsed(e, now) ?? 0)
                    return (
                      <span className={cn('ml-auto text-[11px] font-medium', left > 0 ? 'text-emerald-400' : 'text-red-400')}>
                        {left > 0 ? `${Math.ceil(left / 60)} min of turnaround left` : 'OVER — KPI missed'}
                      </span>
                    )
                  })() : (
                    <span className="ml-auto text-[11px] text-muted-foreground/40">pay-only</span>
                  ))}
                </div>
              </div>
            )
          })}

          {/* Completed */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Completed ({completed.length})</h2>
            </div>
            {loading ? (
              <div className="space-y-2">{[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-card border border-border rounded-xl animate-pulse" />)}</div>
            ) : completed.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
                No completed tasks yet. Start one above.
              </div>
            ) : (
              <div className="space-y-2">
                {completed.map(e => (
                  <CompletedCard key={e.id} entry={e} cfg={cfg} onDelete={isAdmin ? () => deleteEntry(e.id) : undefined} />
                ))}
              </div>
            )}
          </div>

          {/* History (paid) — subtle dropdown */}
          <div>
            <button onClick={() => setHistoryOpen(o => !o)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground/60 hover:text-foreground transition-colors">
              <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', historyOpen && 'rotate-180')} />
              Paid history
            </button>
            {historyOpen && (
              <div className="mt-2 space-y-1.5">
                {history.length === 0 ? (
                  <div className="text-xs text-muted-foreground/50 px-1 py-2">No paid history yet.</div>
                ) : history.map(e => (
                  <div key={e.id} className="flex items-center justify-between text-xs text-muted-foreground bg-secondary/20 rounded-lg px-3 py-2">
                    <span className="truncate">{e.description || 'Untitled'}</span>
                    <span className="flex items-center gap-3 flex-shrink-0">
                      <span className="tabular-nums">{workedHours(e).toFixed(2)}h</span>
                      <span className="text-muted-foreground/40">{e.paid_at ? new Date(e.paid_at).toLocaleDateString() : ''}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right rail */}
        <div className="space-y-4">
          <BankMeter amount={bank} rate={cfg.rate} hours={totalHours} />

          <div className="bg-card border border-border rounded-2xl p-5">
            <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/70 mb-2 text-center">Turnaround KPI · assigned → done</div>
            <Tachometer pct={kpi.pct} zone={zone} hits={kpi.hits} total={kpi.total} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1 text-2xl font-black text-orange-400">
                <Flame className="w-5 h-5" /> {streak}
              </div>
              <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Streak</div>
            </div>
            <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
              <div className="text-2xl font-black text-foreground tabular-nums">{unpaidStandard}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5 uppercase tracking-wide">Standard tasks</div>
            </div>
          </div>
        </div>
      </div>

      {/* Compile modal */}
      {compileOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setCompileOpen(false)}>
          <div className="absolute inset-0 bg-black/60" />
          <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-border/50">
              <div className="text-sm font-semibold">Pay-Period Pipeline KPI</div>
              <div className="text-xs text-muted-foreground mt-0.5">Onboarding assigned → completed within 1 hour, per client (both VAs, last 7 days). Off-hours assignments excluded.</div>
            </div>
            {!compile ? (
              <div className="p-10 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" /></div>
            ) : (
              <div className="p-5 space-y-4">
                <div className={cn('rounded-xl border p-4 text-center',
                  compile.summary.bonus_eligible ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-amber-500/30 bg-amber-500/10')}>
                  <div className="text-4xl font-black tabular-nums" style={{ color: compile.summary.bonus_eligible ? '#10b981' : '#eab308' }}>
                    {compile.summary.pct == null ? '—' : `${compile.summary.pct}%`}
                  </div>
                  <div className="text-xs font-semibold uppercase tracking-wider mt-1" style={{ color: compile.summary.bonus_eligible ? '#10b981' : '#eab308' }}>
                    {compile.summary.pct == null ? 'No eligible tasks yet' : compile.summary.bonus_eligible ? 'Bonus eligible (≥90%)' : 'Below 90% threshold'}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1.5">
                    {compile.summary.hits}/{compile.summary.eligible_completed} completed within 1hr
                    {compile.summary.pending > 0 && ` · ${compile.summary.pending} still open`}
                    {compile.summary.excluded_out_of_hours > 0 && ` · ${compile.summary.excluded_out_of_hours} off-hours excluded`}
                  </div>
                </div>
                <div className="space-y-1.5">
                  {compile.rows.length === 0 && <div className="text-xs text-muted-foreground text-center py-4">No fulfillment-assigned tasks in this period.</div>}
                  {compile.rows.map(r => (
                    <div key={r.client_id} className="flex items-center justify-between text-xs bg-secondary/20 rounded-lg px-3 py-2">
                      <span className="truncate flex items-center gap-2">
                        {r.client ?? 'Client'}
                        {!r.eligible && <span className="text-[9px] text-muted-foreground/50 uppercase">off-hrs</span>}
                      </span>
                      <span className="flex items-center gap-2 flex-shrink-0">
                        {r.span_minutes != null ? (
                          <span className={cn('tabular-nums font-medium', r.within_hour ? 'text-emerald-400' : 'text-amber-400')}>{r.span_minutes}m</span>
                        ) : (
                          <span className="text-muted-foreground/50">open</span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

interface CompileRow {
  client_id: string; client: string | null
  assigned_at: string; completed_at: string | null; status: string
  span_minutes: number | null; eligible: boolean; within_hour: boolean
}
interface CompileResult {
  rows: CompileRow[]
  summary: {
    since: string; total: number; excluded_out_of_hours: number; pending: number
    eligible_completed: number; hits: number; pct: number | null; bonus_eligible: boolean
  }
}
