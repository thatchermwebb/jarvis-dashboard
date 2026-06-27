import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow, format, parseISO } from 'date-fns'
import type { ClientStage, ClientSentiment, UrgencyLevel, TaskPriority, TaskStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Centralized date helpers ─────────────────────────────────────────────────
// All date-only values in the DB are YYYY-MM-DD strings.
// Never use new Date('YYYY-MM-DD') — it parses as UTC midnight and shifts by
// the local timezone offset, causing off-by-one errors for evening users.

/** Today's date as YYYY-MM-DD in the LOCAL timezone (browser or Node/Vercel). */
export function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Parse a YYYY-MM-DD string safely (noon local time to avoid DST edge cases). */
export function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

/** Days between two YYYY-MM-DD strings (pure UTC arithmetic, no timezone shift). */
export function daysBetween(fromStr: string, toStr: string): number {
  const [fy, fm, fd] = fromStr.split('-').map(Number)
  const [ty, tm, td] = toStr.split('-').map(Number)
  const fromMs = Date.UTC(fy, fm - 1, fd)
  const toMs   = Date.UTC(ty, tm - 1, td)
  return Math.round((toMs - fromMs) / 86_400_000)
}

/** Days until a YYYY-MM-DD date from today (negative = past). */
export function daysUntil(dateStr: string): number {
  return daysBetween(localToday(), dateStr)
}

/** Format HH:MM (24h) to 12-hour display: "2:30 PM" */
export function formatTime(t?: string): string {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  if (isNaN(h) || isNaN(m)) return t
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h % 12 || 12
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`
}

export function timeAgo(date?: string): string {
  if (!date) return 'Never'
  try {
    return formatDistanceToNow(parseISO(date), { addSuffix: true })
  } catch {
    return 'Unknown'
  }
}

export function formatDate(date?: string): string {
  if (!date) return '—'
  try {
    // Append local-midnight offset for date-only strings to avoid UTC→local shift
    const iso = date.length === 10 ? date + 'T00:00:00' : date
    return format(parseISO(iso), 'MMM d, yyyy')
  } catch {
    return '—'
  }
}

export function formatCurrency(amount?: number): string {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(amount)
}

export function stageLabel(stage: ClientStage): string {
  const labels: Record<ClientStage, string> = {
    onboarding: 'Onboarding',
    free_trial: 'Free Trial (Active)',
    free_trial_pending: 'Free Trial (Pending)',
    trial_ending_soon: 'Free Trial (Active)',   // legacy — maps to same label
    trial_concluded: 'Free Trial (Complete)',
    active_client: 'Active',
    overdue: 'Overdue',
    payment_issue: 'Overdue',                   // legacy
    paused: 'Paused',
    churn_risk: 'Overdue',                      // legacy
    churned: 'Churned',
    free_trial_lost: 'Free Trial (Lost)',
    won_back: 'Active',                         // legacy
  }
  return labels[stage] ?? stage
}

export function stageColor(stage: ClientStage): string {
  const colors: Record<ClientStage, string> = {
    onboarding: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    free_trial: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    free_trial_pending: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    trial_ending_soon: 'bg-violet-500/20 text-violet-300 border-violet-500/30',  // legacy
    trial_concluded: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
    active_client: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    overdue: 'bg-red-500/20 text-red-300 border-red-500/30',
    payment_issue: 'bg-red-500/20 text-red-300 border-red-500/30',               // legacy
    paused: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    churn_risk: 'bg-red-500/20 text-red-300 border-red-500/30',                  // legacy
    churned: 'bg-slate-700/20 text-slate-400 border-slate-700/30',
    free_trial_lost: 'bg-slate-700/20 text-slate-400 border-slate-700/30',
    won_back: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',        // legacy
  }
  return colors[stage] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30'
}

export function sentimentColor(sentiment?: ClientSentiment): string {
  const colors: Record<ClientSentiment, string> = {
    happy: 'text-emerald-400',
    neutral: 'text-slate-400',
    confused: 'text-yellow-400',
    concerned: 'text-orange-400',
    frustrated: 'text-red-400',
    angry: 'text-red-500',
    ghosting: 'text-slate-500',
    close_ready: 'text-violet-400',
  }
  if (!sentiment) return 'text-slate-500'
  return colors[sentiment] ?? 'text-slate-400'
}

export function sentimentEmoji(sentiment?: ClientSentiment): string {
  const emojis: Record<ClientSentiment, string> = {
    happy: '😊',
    neutral: '😐',
    confused: '😕',
    concerned: '😟',
    frustrated: '😤',
    angry: '😠',
    ghosting: '👻',
    close_ready: '🎯',
  }
  if (!sentiment) return '—'
  return emojis[sentiment] ?? '—'
}

export function urgencyColor(level?: UrgencyLevel): string {
  const colors: Record<UrgencyLevel, string> = {
    low: 'text-slate-400',
    medium: 'text-yellow-400',
    high: 'text-orange-400',
    critical: 'text-red-500',
  }
  if (!level) return 'text-slate-400'
  return colors[level] ?? 'text-slate-400'
}

export function priorityColor(priority?: TaskPriority): string {
  const colors: Record<TaskPriority, string> = {
    urgent: 'bg-red-500/20 text-red-300 border-red-500/30',
    high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    low: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
  }
  if (!priority) return 'bg-slate-500/20 text-slate-300 border-slate-500/30'
  return colors[priority] ?? 'bg-slate-500/20 text-slate-300 border-slate-500/30'
}

export function taskStatusColor(status?: TaskStatus): string {
  const colors: Record<TaskStatus, string> = {
    open: 'bg-blue-500/20 text-blue-300',
    in_progress: 'bg-yellow-500/20 text-yellow-300',
    done: 'bg-emerald-500/20 text-emerald-300',
    blocked: 'bg-red-500/20 text-red-300',
  }
  if (!status) return 'bg-slate-500/20 text-slate-300'
  return colors[status] ?? 'bg-slate-500/20 text-slate-300'
}

export function cplStatusColor(cpl?: number): string {
  if (!cpl) return 'text-slate-400'
  if (cpl < 5) return 'text-emerald-400'
  if (cpl < 10) return 'text-yellow-400'
  if (cpl < 15) return 'text-orange-400'
  return 'text-red-500'
}

