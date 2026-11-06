// Plain-English client record engine.
//
// Turns a client's raw rows (across every related table) into readable English:
// a snapshot paragraph, a merged chronological "customer journey", and grouped
// detail fields. Format-agnostic on purpose — the DOCX builder consumes this,
// and a future PDF/Markdown renderer could reuse it unchanged.

import { stageLabel } from '@/lib/utils'
import type { ClientStage } from '@/types'

// ─── Raw row shapes (only the fields we read) ────────────────────────────────

export interface ExportClient {
  id: string
  [key: string]: unknown
}

export interface ClientBundle {
  client: ExportClient
  payments: Record<string, unknown>[]
  schedules: Record<string, unknown>[]
  logs: Record<string, unknown>[]
  timeline: Record<string, unknown>[]
  tasks: Record<string, unknown>[]
  closeBriefs: Record<string, unknown>[]
  workOrders: Record<string, unknown>[]
  reviews: Record<string, unknown>[]
  accountLogs: Record<string, unknown>[]
  adProductions: Record<string, unknown>[]
  teamEntries: Record<string, unknown>[]
  affiliateName?: string | null
}

// ─── Primitive helpers ───────────────────────────────────────────────────────

const str = (v: unknown): string => (v == null ? '' : String(v)).trim()
const num = (v: unknown): number | null => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export function money(v: unknown): string {
  const n = num(v)
  if (n == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n)
}

/** "July 3, 2026" — accepts an ISO string or date-only string. */
export function fmtDate(v: unknown): string {
  const s = str(v)
  if (!s) return ''
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

/** Sortable timestamp (ms). Missing/invalid → null. */
function ts(v: unknown): number | null {
  const s = str(v)
  if (!s) return null
  const d = new Date(s.length <= 10 ? s + 'T00:00:00' : s)
  return isNaN(d.getTime()) ? null : d.getTime()
}

function safeChar(code: number): string {
  if (!Number.isFinite(code) || code < 9) return ' '
  try { return String.fromCodePoint(code) } catch { return ' ' }
}

/**
 * Turn rich-text / HTML field content (notes were entered in a WYSIWYG editor and
 * stored with <div>, <br>, inline styles and entities) into clean plain English.
 */
export function clean(v: unknown): string {
  let t = str(v)
  if (!t) return ''
  if (/[<&]/.test(t)) {
    t = t
      .replace(/<\s*(br|hr)\s*\/?\s*>/gi, ' ')
      .replace(/<\/(div|p|li|tr|h[1-6]|blockquote)\s*>/gi, ' ')
      .replace(/<[^>]*>/g, '')
      .replace(/&#x([0-9a-f]+);/gi, (_, h) => safeChar(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, n) => safeChar(parseInt(n, 10)))
    const named: Record<string, string> = {
      nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
      mdash: '—', ndash: '–', hellip: '…',
      rsquo: '’', lsquo: '‘', ldquo: '“', rdquo: '”',
    }
    t = t.replace(/&([a-z]+);/gi, (_, n) => named[n.toLowerCase()] ?? ' ')
  }
  // Strip characters invalid in XML 1.0 (stray control chars from pasted text),
  // then collapse every run of whitespace — including the raw newlines that
  // plain-text notes carry — so each entry renders as one clean line.
  // eslint-disable-next-line no-control-regex
  return t.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '').replace(/\s+/g, ' ').trim()
}

/** snake_case / kebab → "Title Case" for codes we don't have an explicit label for. */
export function humanize(v: unknown): string {
  const s = str(v)
  if (!s) return ''
  return s
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, c => c.toUpperCase())
}

// ─── Vocabulary ──────────────────────────────────────────────────────────────

const PAYMENT_STATUS: Record<string, string> = {
  paid: 'paid',
  paid_late: 'paid (late)',
  pending: 'pending',
  due: 'due',
  scheduled: 'scheduled',
  overdue: 'overdue',
  failed: 'failed',
  voided: 'voided',
  waived: 'waived',
  refunded: 'refunded',
}

const SENTIMENT: Record<string, string> = {
  happy: 'happy',
  neutral: 'neutral',
  confused: 'confused',
  concerned: 'concerned',
  frustrated: 'frustrated',
  angry: 'angry',
  ghosting: 'going quiet',
  close_ready: 'ready to close',
}

const LOG_TYPE: Record<string, string> = {
  call: 'Call',
  note: 'Note',
  sms: 'Text',
  text: 'Text',
  email: 'Email',
  meeting: 'Meeting',
  voicemail: 'Voicemail',
  trial_check_in: 'Trial check-in',
  onboarding: 'Onboarding note',
  payment: 'Payment note',
}

const TASK_STATUS: Record<string, string> = {
  pending: 'Pending',
  open: 'Open',
  in_progress: 'In progress',
  completed: 'Completed',
  done: 'Completed',
  cancelled: 'Cancelled',
  canceled: 'Cancelled',
}

const label = (map: Record<string, string>, v: unknown): string => {
  const s = str(v).toLowerCase()
  return map[s] ?? humanize(v)
}

export const paymentStatusLabel = (v: unknown) => label(PAYMENT_STATUS, v)
export const sentimentLabel = (v: unknown) => label(SENTIMENT, v)
export const logTypeLabel = (v: unknown) => label(LOG_TYPE, v)
export const taskStatusLabel = (v: unknown) => label(TASK_STATUS, v)

// ─── Snapshot: who they are, right now, in one short paragraph ────────────────

export function snapshot(b: ClientBundle): string {
  const c = b.client
  const name = str(c.business_name) || str(c.name) || 'This client'
  const owner = str(c.owner_name)
  const loc = str(c.market_location)
  const stage = stageLabel(c.stage as ClientStage)
  const retainer = num(c.monthly_retainer)
  const freq = str(c.payment_frequency)

  const parts: string[] = []

  let lead = `${name}`
  if (owner) lead += ` (owner: ${owner})`
  if (loc) lead += ` in ${loc}`
  lead += ` is currently **${stage}**`
  if (retainer) lead += ` at ${money(retainer)}${freq ? ` / ${humanize(freq).toLowerCase()}` : ' per month'}`
  lead += '.'
  parts.push(lead)

  if (c.affiliate_id && b.affiliateName) parts.push(`They were brought in through affiliate ${b.affiliateName}.`)

  const signed = fmtDate(c.signed_at)
  const created = fmtDate(c.created_at)
  if (signed) parts.push(`Signed as a paying client on ${signed}.`)
  else if (created) parts.push(`First added to CZA on ${created}.`)

  // Count of money actually collected.
  const collected = b.payments
    .filter(p => ['paid', 'paid_late'].includes(str(p.status).toLowerCase()))
    .reduce((s, p) => s + (num(p.amount) ?? 0), 0)
  if (collected > 0) parts.push(`Lifetime collected to date: ${money(collected)} across ${b.payments.filter(p => ['paid', 'paid_late'].includes(str(p.status).toLowerCase())).length} payment(s).`)

  // Churn note.
  const churnStage = str(c.stage).toLowerCase()
  if (churnStage === 'churned' || churnStage === 'paused') {
    const when = fmtDate(c.churned_at)
    parts.push(`Now ${stage.toLowerCase()}${when ? ` (as of ${when})` : ''}.${clean(c.trial_lost_reason) ? ` Reason on file: ${clean(c.trial_lost_reason)}.` : ''}`)
  }

  // Risk flag.
  const risk = num(c.churn_risk_score)
  if (risk != null && risk >= 60 && churnStage !== 'churned') {
    parts.push(`Flagged at-risk (churn risk ${risk}/100)${clean(c.risk_reason) ? `: ${clean(c.risk_reason)}` : ''}.`)
  }

  return parts.join(' ')
}

// ─── The customer journey: everything dated, merged and told in order ─────────

export interface JourneyEntry {
  sortMs: number
  date: string
  text: string
}

export function journey(b: ClientBundle): JourneyEntry[] {
  const c = b.client
  const out: JourneyEntry[] = []
  const add = (when: unknown, text: string) => {
    const ms = ts(when)
    const t = (text ?? '').replace(/\s+/g, ' ').trim()
    if (ms == null || !t || t === '.') return
    out.push({ sortMs: ms, date: fmtDate(when), text: t })
  }

  // Lifecycle milestones
  add(c.created_at, `Added to CZA${str(c.created_by) ? ` by ${str(c.created_by)}` : ''}.`)
  if (c.trial_start) add(c.trial_start, `Free trial started${c.trial_end ? `, scheduled to run through ${fmtDate(c.trial_end)}` : ''}.`)
  if (c.signed_at) add(c.signed_at, `Converted to a paying client${num(c.monthly_retainer) ? ` at ${money(c.monthly_retainer)}/mo` : ''}.`)
  if (c.contract_start) add(c.contract_start, `Contract began${c.contract_end ? `, running to ${fmtDate(c.contract_end)}` : ''}${num(c.contract_total_value) ? ` (total value ${money(c.contract_total_value)})` : ''}.`)
  if (c.churned_at) add(c.churned_at, `Marked ${stageLabel(c.stage as ClientStage).toLowerCase()}${clean(c.trial_lost_reason) ? ` — reason: ${clean(c.trial_lost_reason)}` : ''}.`)

  // Communication logs — the heart of the journey
  for (const l of b.logs) {
    const bits: string[] = []
    const type = logTypeLabel(l.log_type)
    if (l.outcome) bits.push(`outcome: ${humanize(l.outcome)}`)
    if (l.sentiment) bits.push(`client ${sentimentLabel(l.sentiment)}`)
    const summary = clean(l.summary) || clean(l.trial_notes)
    const promises = clean(l.promises_made), objections = clean(l.objections), nextStep = clean(l.next_step)
    // Skip a log that carries nothing at all.
    if (!summary && !promises && !objections && !nextStep && bits.length === 0) continue
    let text = `${type}${str(l.created_by) ? ` by ${str(l.created_by)}` : ''}: ${summary || '(no summary recorded)'}`
    if (bits.length) text += ` — ${bits.join(', ')}`
    if (promises) text += ` Promises: ${promises}.`
    if (objections) text += ` Objections: ${objections}.`
    if (nextStep) text += ` Next step: ${nextStep}${l.followup_date ? ` by ${fmtDate(l.followup_date)}` : ''}.`
    add(l.created_at, text)
  }

  // Timeline events — skip the ones that mirror a communication log or the
  // "created" milestone (both already told above); keep genuinely distinct events.
  const MIRRORED = new Set(['created', 'note', 'call', 'meeting', 'text', 'sms', 'email', 'voicemail'])
  for (const e of b.timeline) {
    if (MIRRORED.has(str(e.event_type).toLowerCase())) continue
    const desc = clean(e.description) || humanize(e.event_type)
    if (!desc) continue
    add(e.created_at, `${desc}${str(e.created_by) ? ` (${str(e.created_by)})` : ''}.`)
  }

  // Payments
  for (const p of b.payments) {
    const amt = money(p.amount)
    const kind = humanize(p.payment_type) || 'Payment'
    const status = paymentStatusLabel(p.status)
    const paidOn = p.paid_date
    if (paidOn) add(paidOn, `${kind} of ${amt} ${status}.`)
    else add(p.due_date, `${kind} of ${amt} ${status} (due ${fmtDate(p.due_date)}).`)
  }

  // Monthly ad / account reports
  for (const a of b.accountLogs) {
    const metrics: string[] = []
    if (num(a.leads) != null) metrics.push(`${num(a.leads)} leads`)
    if (num(a.cpl) != null) metrics.push(`${money(a.cpl)} CPL`)
    if (num(a.booked) != null) metrics.push(`${num(a.booked)} booked`)
    if (num(a.spend) != null) metrics.push(`${money(a.spend)} spend`)
    if (num(a.revenue) != null) metrics.push(`${money(a.revenue)} revenue`)
    let text = `Ad account report${a.period_start ? ` (${fmtDate(a.period_start)}${a.period_end ? `–${fmtDate(a.period_end)}` : ''})` : ''}`
    if (metrics.length) text += `: ${metrics.join(', ')}`
    if (a.situation) text += `. Situation: ${clean(a.situation)}`
    if (a.verdict) text += `. Verdict: ${humanize(a.verdict)}`
    if (a.changes) text += `. Changes: ${clean(a.changes)}`
    text += '.'
    add(a.created_at ?? a.period_end ?? a.period_start, text)
  }

  // Weekly ad reviews
  for (const r of b.reviews) {
    const d = r.reviewed_at ?? r.created_at
    add(d, `Weekly ad review${r.week ? ` (week ${str(r.week)})` : ''}${r.decision ? ` — decision: ${humanize(r.decision)}` : ''}${clean(r.notes) ? `. ${clean(r.notes)}` : ''}.`)
  }

  // Close briefs
  for (const cb of b.closeBriefs) {
    add(cb.created_at, `Sales close brief prepared${clean(cb.main_pain) ? ` — main pain: ${clean(cb.main_pain)}` : ''}${clean(cb.recommended_offer) ? `; recommended offer: ${clean(cb.recommended_offer)}` : ''}.`)
  }

  out.sort((a, z) => a.sortMs - z.sortMs)
  return out
}

// ─── Grouped detail fields (only non-empty values are emitted) ────────────────

export interface DetailField { label: string; value: string }
export interface DetailGroup { title: string; fields: DetailField[] }

export function detailGroups(b: ClientBundle): DetailGroup[] {
  const c = b.client
  const groups: DetailGroup[] = []

  const g = (title: string, fields: [string, unknown, ((v: unknown) => string)?][]) => {
    const resolved = fields
      .map(([l, v, fmt]) => ({ label: l, value: fmt ? fmt(v) : str(v) }))
      .filter(f => f.value && f.value !== '—')
    if (resolved.length) groups.push({ title, fields: resolved })
  }

  const yn = (v: unknown) => (v === true ? 'Yes' : v === false ? '' : str(v))

  g('Contact & Identity', [
    ['Business name', c.business_name],
    ['Contact name', c.name],
    ['Owner', c.owner_name],
    ['Phone', c.phone],
    ['Email', c.email],
    ['Market / location', c.market_location],
    ['Timezone', c.timezone],
    ['Affiliate', b.affiliateName],
  ])

  g('Deal & Billing', [
    ['Stage', stageLabel(c.stage as ClientStage)],
    ['Monthly retainer', c.monthly_retainer, money],
    ['Payment frequency', c.payment_frequency, humanize],
    ['Payment status', c.payment_status, humanize],
    ['Advertised package', c.advertised_package],
    ['Growth stage', c.growth_stage, humanize],
    ['Prospect tier', c.prospect_tier],
    ['Signed on', c.signed_at, fmtDate],
    ['Deal notes', c.deal_notes, clean],
    ['Promises made', c.promises_made, clean],
    ['Objections', c.objections, clean],
    ['Client concerns', c.client_concerns, clean],
  ])

  g('Contract', [
    ['Status', c.contract_status, humanize],
    ['Start', c.contract_start, fmtDate],
    ['End', c.contract_end, fmtDate],
    ['Scheduled payments', c.contract_payment_count],
    ['Total value', c.contract_total_value, money],
  ])

  g('Trial', [
    ['Trial start', c.trial_start, fmtDate],
    ['Trial end', c.trial_end, fmtDate],
    ['Trial health score', c.trial_health_score],
    ['Close probability', c.close_probability],
    ['Close call booked', c.close_call_booked, yn],
    ['Trial outcome', c.trial_outcome, humanize],
    ['Lost reason', c.trial_lost_reason, clean],
  ])

  g('Advertising & Media', [
    ['Ad status', c.ad_status, humanize],
    ['Creative status', c.creative_status, humanize],
    ['Budget', c.budget, money],
    ['Spend', c.spend, money],
    ['Leads', c.leads],
    ['Cost per lead', c.cpl, money],
    ['Bookings', c.bookings],
    ['Cost per booking', c.cost_per_booking, money],
    ['Booking rate', c.booking_rate],
    ['Best ad', c.best_ad],
    ['Worst ad', c.worst_ad],
    ['Location targeting', c.location_targeting, clean],
    ['Last ad change', c.last_ad_change, fmtDate],
    ['Next ad action', c.next_ad_action, clean],
    ['Campaign link', c.campaign_link],
    ['Ad account link', c.ad_account_link],
  ])

  g('AI & Luna', [
    ['AI status', c.ai_status, humanize],
    ['Avg AI response time', c.avg_ai_response_time],
    ['Booking rate', c.booking_rate],
    ['Conversations needing human', c.conversations_needing_human],
    ['Missed conversations', c.missed_conversations],
    ['Running in Luna', c.running_in_luna, yn],
    ['Luna live', c.luna_live, yn],
    ['Luna status', c.luna_status, humanize],
    ['Luna payment', c.luna_payment_amount, money],
    ['Luna paused at', c.luna_paused_at, fmtDate],
  ])

  g('Status & Risk', [
    ['Churn risk score', c.churn_risk_score],
    ['Risk reason', c.risk_reason, clean],
    ['Save action', c.save_action, clean],
    ['Payment issue', c.payment_issue, yn],
    ['Urgency level', c.urgency_level, humanize],
    ['Last contact', c.last_contact_date, fmtDate],
    ['Last contact method', c.last_contact_method, humanize],
    ['Last call outcome', c.last_call_outcome, humanize],
    ['Last client sentiment', c.last_client_sentiment, sentimentLabel],
    ['Next follow-up', c.next_followup_date, fmtDate],
    ['Follow-up reason', c.followup_reason, clean],
    ['AI situation summary', c.ai_situation_summary, clean],
  ])

  return groups
}

export const clientTitle = (c: ExportClient): string =>
  str(c.business_name) || str(c.name) || 'Unnamed client'
