import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { formatDistanceToNow, format, parseISO } from 'date-fns'
import type { ClientStage, ClientSentiment, UrgencyLevel, TaskPriority, TaskStatus } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
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
    return format(parseISO(date), 'MMM d, yyyy')
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
    free_trial: 'Free Trial',
    trial_ending_soon: 'Trial Ending Soon',
    trial_concluded: 'Trial Concluded',
    active_client: 'Active Client',
    payment_issue: 'Payment Issue',
    paused: 'Paused',
    churn_risk: 'Churn Risk',
    churned: 'Churned',
    won_back: 'Won Back',
  }
  return labels[stage] ?? stage
}

export function stageColor(stage: ClientStage): string {
  const colors: Record<ClientStage, string> = {
    onboarding: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
    free_trial: 'bg-violet-500/20 text-violet-300 border-violet-500/30',
    trial_ending_soon: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
    trial_concluded: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
    active_client: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    payment_issue: 'bg-red-500/20 text-red-300 border-red-500/30',
    paused: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
    churn_risk: 'bg-red-700/20 text-red-400 border-red-700/30',
    churned: 'bg-slate-700/20 text-slate-400 border-slate-700/30',
    won_back: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
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

