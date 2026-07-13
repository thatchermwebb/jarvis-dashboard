// Shared config + KPI math for the Team (VA hours/KPI) page.
// Used by the API routes and the client page so the numbers always agree.

import type { TeamTimeEntry, TeamVaId } from '@/types'

export interface VaConfig {
  id: TeamVaId
  name: string
  standardLabel: string
  kpiSeconds: number // KPI threshold for a standard task (worked seconds)
  rate: number       // $/hr
}

export const VA_CONFIG: Record<TeamVaId, VaConfig> = {
  wilson: { id: 'wilson', name: 'Wilson', standardLabel: 'Ads Creation', kpiSeconds: 20 * 60, rate: 5.0 },
  samuel: { id: 'samuel', name: 'Samuel', standardLabel: 'Onboarding',   kpiSeconds: 40 * 60, rate: 8.5 },
}

export const VA_IDS: TeamVaId[] = ['wilson', 'samuel']

export function isTeamVa(id: string | undefined | null): id is TeamVaId {
  return id === 'wilson' || id === 'samuel'
}

/** Total worked seconds: banked accumulated + the live running segment. */
export function workedSeconds(e: Pick<TeamTimeEntry, 'accumulated_seconds' | 'running_since' | 'status'>, now = Date.now()): number {
  let s = e.accumulated_seconds ?? 0
  if (e.status === 'running' && e.running_since) {
    s += Math.max(0, Math.floor((now - Date.parse(e.running_since)) / 1000))
  }
  return s
}

/** Worked time as decimal hours (30 min -> 0.5). Feeds the pay/bank only. */
export function workedHours(e: Pick<TeamTimeEntry, 'accumulated_seconds' | 'running_since' | 'status'>, now = Date.now()): number {
  return workedSeconds(e, now) / 3600
}

// ─── Turnaround (the KPI metric): assigned → started → completed ─────────────

/** Response time: how long after assignment the VA first hit Start (seconds). */
export function responseSeconds(e: Pick<TeamTimeEntry, 'assigned_at' | 'started_at'>): number | null {
  if (!e.assigned_at || !e.started_at) return null
  return Math.max(0, Math.floor((Date.parse(e.started_at) - Date.parse(e.assigned_at)) / 1000))
}

/** Turnaround: assigned → completed (seconds). The real KPI. */
export function turnaroundSeconds(e: Pick<TeamTimeEntry, 'assigned_at' | 'completed_at'>): number | null {
  if (!e.assigned_at || !e.completed_at) return null
  return Math.max(0, Math.floor((Date.parse(e.completed_at) - Date.parse(e.assigned_at)) / 1000))
}

/** Live seconds since assignment (for the inbox / active budget clock). */
export function budgetElapsed(e: Pick<TeamTimeEntry, 'assigned_at'>, now = Date.now()): number | null {
  if (!e.assigned_at) return null
  return Math.max(0, Math.floor((now - Date.parse(e.assigned_at)) / 1000))
}

/** Fraction of the turnaround budget already spent (0..>1). */
export function budgetFraction(e: Pick<TeamTimeEntry, 'assigned_at'>, cfg: VaConfig, now = Date.now()): number | null {
  const el = budgetElapsed(e, now)
  if (el == null) return null
  return el / cfg.kpiSeconds
}

export function budgetZone(fraction: number | null): 'green' | 'yellow' | 'red' {
  if (fraction == null || fraction < 0.5) return 'green'
  if (fraction < 0.9) return 'yellow'
  return 'red'
}

/** Is a timestamp inside 8:00–17:00 America/Chicago (CST/CDT)? */
export function withinWorkHoursCST(iso: string): boolean {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', hour: 'numeric', hour12: false,
  }).format(new Date(iso))
  // Intl can return "24" for midnight in hour12:false — normalize.
  const hour = parseInt(hourStr, 10) % 24
  return hour >= 8 && hour < 17
}

/**
 * Whether an entry counts toward KPI at all. Fulfillment-seeded tasks
 * (assigned_at set) assigned outside work hours are excluded entirely.
 * Purely manual tasks (no assigned_at) are always eligible.
 */
export function kpiEligible(e: Pick<TeamTimeEntry, 'assigned_at'>): boolean {
  if (!e.assigned_at) return true
  return withinWorkHoursCST(e.assigned_at)
}

/**
 * Entries that count toward KPI: completed, standard, eligible, and ASSIGNED
 * (a turnaround requires an assignment anchor). Manual self-started tasks
 * without an assigned_at are pay-only.
 */
export function kpiCountable(e: TeamTimeEntry): boolean {
  return e.status === 'completed' && e.is_standard && !!e.assigned_at && kpiEligible(e)
}

/** A countable entry whose assigned→completed turnaround met the threshold. */
export function kpiHit(e: TeamTimeEntry, cfg: VaConfig): boolean {
  if (!kpiCountable(e)) return false
  const t = turnaroundSeconds(e)
  return t != null && t <= cfg.kpiSeconds
}

export interface KpiSummary {
  hits: number
  total: number
  pct: number | null // null when no countable tasks yet
}

/** KPI % over a set of entries (unpaid, for the live tachometer). */
export function kpiSummary(entries: TeamTimeEntry[], cfg: VaConfig): KpiSummary {
  const countable = entries.filter(kpiCountable)
  if (!countable.length) return { hits: 0, total: 0, pct: null }
  const hits = countable.filter(e => kpiHit(e, cfg)).length
  return { hits, total: countable.length, pct: Math.round((hits / countable.length) * 100) }
}

export type KpiZone = 'green' | 'yellow' | 'red' | 'neutral'

export function kpiZone(pct: number | null): KpiZone {
  if (pct == null) return 'neutral'
  if (pct >= 90) return 'green'
  if (pct >= 80) return 'yellow'
  return 'red'
}
