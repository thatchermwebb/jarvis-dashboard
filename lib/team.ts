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

// ─── KPI metric: ACTIVE WORKED TIME per task ─────────────────────────────────
// The KPI budget is the VA's own worked time on a task (accumulated_seconds +
// the live running segment), NOT wall-clock since assignment. This means each
// onboarding gets its own 40-min budget that only counts down while that task
// is actually running — stacked tasks don't burn the clock concurrently, and
// pausing freezes the countdown until resumed.

/** Response time: how long after assignment the VA first hit Start (seconds). */
export function responseSeconds(e: Pick<TeamTimeEntry, 'assigned_at' | 'started_at'>): number | null {
  if (!e.assigned_at || !e.started_at) return null
  return Math.max(0, Math.floor((Date.parse(e.started_at) - Date.parse(e.assigned_at)) / 1000))
}

/** Wall-clock assigned → completed (seconds). Kept for reference/analytics only. */
export function turnaroundSeconds(e: Pick<TeamTimeEntry, 'assigned_at' | 'completed_at'>): number | null {
  if (!e.assigned_at || !e.completed_at) return null
  return Math.max(0, Math.floor((Date.parse(e.completed_at) - Date.parse(e.assigned_at)) / 1000))
}

/**
 * KPI budget spent = active worked seconds. Advances only while the task is
 * running; frozen when paused/idle; independent per task (never concurrent).
 */
export function budgetElapsed(e: Pick<TeamTimeEntry, 'accumulated_seconds' | 'running_since' | 'status'>, now = Date.now()): number {
  return workedSeconds(e, now)
}

/** Fraction of the 40-min worked budget already spent (0..>1). */
export function budgetFraction(e: Pick<TeamTimeEntry, 'accumulated_seconds' | 'running_since' | 'status'>, cfg: VaConfig, now = Date.now()): number {
  return workedSeconds(e, now) / cfg.kpiSeconds
}

export function budgetZone(fraction: number | null): 'green' | 'yellow' | 'red' {
  if (fraction == null || fraction < 0.5) return 'green'
  if (fraction < 0.9) return 'yellow'
  return 'red'
}

/** Is a timestamp inside 9:00 AM–5:00 PM America/Chicago (CST/CDT)? */
export function withinWorkHoursCST(iso: string): boolean {
  const hourStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Chicago', hour: 'numeric', hour12: false,
  }).format(new Date(iso))
  // Intl can return "24" for midnight in hour12:false — normalize.
  const hour = parseInt(hourStr, 10) % 24
  return hour >= 9 && hour < 17
}

/**
 * Whether an entry counts toward KPI at all. Any task assigned outside work
 * hours (9–5 CST) is invalidated. Tasks with no assignment anchor can't have
 * a turnaround, so they never count.
 */
export function kpiEligible(e: Pick<TeamTimeEntry, 'assigned_at'>): boolean {
  if (!e.assigned_at) return false
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

/** A countable entry whose active worked time stayed within the KPI budget. */
export function kpiHit(e: TeamTimeEntry, cfg: VaConfig): boolean {
  if (!kpiCountable(e)) return false
  return workedSeconds(e) <= cfg.kpiSeconds
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
