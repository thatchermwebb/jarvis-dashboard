// Local-first instant parsers for the JARVIS voice agent.
// Every parser returns null when it can't confidently match — the caller then
// falls back to /api/jarvis/parse (Claude) for anything remotely ambiguous.

import { localToday, parseLocalDate } from '@/lib/utils'
import type { LogType, LogOutcome, ClientSentiment } from '@/types'

export type LogTypeValue = LogType
export type OutcomeValue = LogOutcome
export type SentimentValue = ClientSentiment

// ─── Normalization ────────────────────────────────────────────────────────────

export function normalize(text: string): string {
  return text.toLowerCase().replace(/[.,!?;:'"]/g, '').replace(/\s+/g, ' ').trim()
}

// ─── Global wizard commands ───────────────────────────────────────────────────

export type GlobalCommand = 'skip' | 'back' | 'cancel' | 'repeat' | null

export function parseGlobalCommand(text: string): GlobalCommand {
  const t = normalize(text)
  if (/^(skip( it| this)?( please)?|none|nothing|no thanks|nope|pass)$/.test(t)) return 'skip'
  if (/^(go back|back( up)?|previous( question)?)$/.test(t)) return 'back'
  if (/^(cancel( it| that)?|never ?mind|stop|forget it|abort)$/.test(t)) return 'cancel'
  if (/^(repeat( that)?( please)?|what|say (that )?again|pardon|come again|huh)$/.test(t)) return 'repeat'
  return null
}

// ─── Log type ────────────────────────────────────────────────────────────────

const LOG_TYPE_MAP: [RegExp, LogTypeValue][] = [
  [/\b(call(ed)?|phone(d)?|rang|dial(ed)?|spoke on the phone)\b/, 'call'],
  [/\b(text(ed)?|sms|messag(e|ed)|imessage)\b/, 'text'],
  [/\b(meeting|met( with)?|zoom(ed)?|face ?time|in person|video)\b/, 'meeting'],
  [/\b(voice ?mail|vm|left (him|her|them)? ?a message)\b/, 'voicemail'],
  [/\b(email(ed)?|e-mail)\b/, 'email'],
  [/\b(note|noted)\b/, 'note'],
]

export function parseLogType(text: string): LogTypeValue | null {
  const t = normalize(text)
  for (const [re, val] of LOG_TYPE_MAP) if (re.test(t)) return val
  return null
}

// ─── Outcome ─────────────────────────────────────────────────────────────────

const OUTCOME_MAP: [RegExp, OutcomeValue][] = [
  [/\b(booked|schedul(ed)?|meeting (set|booked)|set up a (call|meeting))\b/, 'meeting_booked'],
  [/\b(no answer|didnt (pick up|answer)|did not (pick up|answer)|no pick ?up|missed)\b/, 'no_answer'],
  [/\b(voice ?mail|vm|left (a )?message)\b/, 'voicemail'],
  [/\b(text(ed)? (him|her|them|back)?|responded (by|via) text)\b/, 'texted'],
  [/\b(answer(ed)?|picked up|spoke|talked|got (him|her|them)|connected)\b/, 'answered'],
]

export function parseOutcome(text: string): OutcomeValue | null {
  const t = normalize(text)
  for (const [re, val] of OUTCOME_MAP) if (re.test(t)) return val
  return null
}

// ─── Sentiment ───────────────────────────────────────────────────────────────

const SENTIMENT_MAP: [RegExp, SentimentValue][] = [
  [/\b(ready to (close|sign|buy)|close ready|wants to sign|ready to go)\b/, 'close_ready'],
  [/\b(ghost(ed|ing)?|not responding|radio silence|disappeared)\b/, 'ghosting'],
  [/\b(angry|mad|pissed|furious|livid|heated)\b/, 'angry'],
  [/\b(frustrat(ed|ing)|annoyed|fed up|irritated)\b/, 'frustrated'],
  [/\b(concern(ed)?|worried|nervous|anxious|uneasy|skeptical|hesitant)\b/, 'concerned'],
  [/\b(confus(ed|ing)|lost|didnt understand|unclear|unsure)\b/, 'confused'],
  [/\b(happy|great|good|excited|pumped|stoked|thrilled|loved? it|positive)\b/, 'happy'],
  [/\b(neutral|fine|okay|ok|alright|indifferent|meh|normal)\b/, 'neutral'],
]

export function parseSentiment(text: string): SentimentValue | null {
  const t = normalize(text)
  // Negations and comparisons ("not happy", "more concerned than frustrated")
  // are ambiguous — let Claude sort them out.
  if (/\b(not|wasnt|isnt|more|less|than|but)\b/.test(t)) {
    const matches = new Set(SENTIMENT_MAP.filter(([re]) => re.test(t)).map(([, v]) => v))
    if (matches.size !== 1) return null
    if (/\b(not|wasnt|isnt)\b/.test(t)) return null
    return [...matches][0]
  }
  const matches = new Set(SENTIMENT_MAP.filter(([re]) => re.test(t)).map(([, v]) => v))
  if (matches.size > 1) return null
  for (const [re, val] of SENTIMENT_MAP) if (re.test(t)) return val
  return null
}

// ─── Yes / No ────────────────────────────────────────────────────────────────

export function parseYesNo(text: string): boolean | null {
  const t = normalize(text)
  if (/^(yes|yeah|yep|yup|sure|save( it)?|confirm(ed)?|go ahead|do it|correct|sounds good|perfect|absolutely)\b/.test(t)) return true
  if (/^(no|nope|nah|dont|do not|negative|hold on|wait)\b/.test(t)) return false
  return null
}

// ─── Relative date + time parser ─────────────────────────────────────────────

const WORD_NUMS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, a: 1, an: 1, couple: 2, few: 3,
}

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
const MONTHS = ['january','february','march','april','may','june','july','august','september','october','november','december']

function fmt(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function addDays(dateStr: string, n: number): string {
  const d = parseLocalDate(dateStr)
  d.setDate(d.getDate() + n)
  return fmt(d)
}

/** Extract a time like "at 3", "at 3pm", "at 3:30", "3 o'clock" → HH:MM (24h). Bare 1–7 assumed PM. */
export function parseTime(text: string): string | null {
  const t = normalize(text)
  const m = t.match(/\b(?:at )?(\d{1,2})(?::(\d{2}))?\s*(am|pm|oclock|o clock)?\b/)
  if (!m) return null
  // Avoid grabbing numbers that are part of date phrases ("in 3 days", "the 15th")
  const idx = m.index ?? 0
  const before = t.slice(Math.max(0, idx - 10), idx)
  const after = t.slice(idx + m[0].length, idx + m[0].length + 8)
  if (/\bin $/.test(before) || /^\s*(days?|weeks?|th|st|nd|rd)\b/.test(after)) return null
  let h = parseInt(m[1], 10)
  const min = m[2] ? parseInt(m[2], 10) : 0
  const suffix = m[3]
  if (h > 23 || min > 59) return null
  if (suffix === 'pm' && h < 12) h += 12
  if (suffix === 'am' && h === 12) h = 0
  if (!suffix && h >= 1 && h <= 7) h += 12 // bare 1–7 → PM (business hours)
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

/** Parse relative/natural dates → YYYY-MM-DD, or 'none' for "no follow up", or null if unparseable. */
export function parseRelativeDate(text: string, today: string = localToday()): string | 'none' | null {
  const t = normalize(text)

  if (/\b(no follow ?up|dont follow ?up|none|nothing|skip|not needed|no need)\b/.test(t)) return 'none'
  if (/\btoday\b/.test(t)) return today
  if (/\bday after tomorrow\b/.test(t)) return addDays(today, 2)
  if (/\btomorrow\b/.test(t)) return addDays(today, 1)
  if (/\bnext week\b/.test(t)) return addDays(today, 7)
  if (/\bnext month\b/.test(t)) return addDays(today, 30)

  // "in N days/weeks" (digits or words)
  const inMatch = t.match(/\bin (\d+|one|two|three|four|five|six|seven|eight|nine|ten|a|an|couple( of)?|few) (day|week)s?\b/)
  if (inMatch) {
    const numRaw = inMatch[1].replace(/ of$/, '')
    const n = /^\d+$/.test(numRaw) ? parseInt(numRaw, 10) : WORD_NUMS[numRaw]
    if (n != null) return addDays(today, inMatch[3] === 'week' ? n * 7 : n)
  }

  // Weekday names — next occurrence; "next X" adds 7 when today IS that day, else plain next occurrence
  for (let i = 0; i < 7; i++) {
    if (new RegExp(`\\b(next )?${WEEKDAYS[i]}\\b`).test(t)) {
      const isNext = new RegExp(`\\bnext ${WEEKDAYS[i]}\\b`).test(t)
      const todayDow = parseLocalDate(today).getDay()
      let diff = (i - todayDow + 7) % 7
      if (diff === 0) diff = 7
      if (isNext && diff <= 2) diff += 7 // "next tuesday" said on a Sunday/Monday means the following week
      return addDays(today, diff)
    }
  }

  // "July 15th" / "the 15th"
  const monthMatch = t.match(new RegExp(`\\b(${MONTHS.join('|')}) (\\d{1,2})(st|nd|rd|th)?\\b`))
  if (monthMatch) {
    const now = parseLocalDate(today)
    const month = MONTHS.indexOf(monthMatch[1])
    const day = parseInt(monthMatch[2], 10)
    if (day >= 1 && day <= 31) {
      let year = now.getFullYear()
      const candidate = new Date(year, month, day, 12)
      if (fmt(candidate) < today) year += 1
      return fmt(new Date(year, month, day, 12))
    }
  }
  const dayMatch = t.match(/\bthe (\d{1,2})(st|nd|rd|th)?\b/)
  if (dayMatch) {
    const day = parseInt(dayMatch[1], 10)
    if (day >= 1 && day <= 31) {
      const now = parseLocalDate(today)
      let candidate = new Date(now.getFullYear(), now.getMonth(), day, 12)
      if (fmt(candidate) <= today) candidate = new Date(now.getFullYear(), now.getMonth() + 1, day, 12)
      return fmt(candidate)
    }
  }

  return null
}

// ─── Fuzzy client matcher ────────────────────────────────────────────────────

export interface ClientCandidate {
  id: string
  name: string
  business_name?: string
}

/** Token-prefix fuzzy match against client name + business name. Returns ranked matches. */
export function matchClients(text: string, clients: ClientCandidate[]): ClientCandidate[] {
  const t = normalize(text)
  if (!t) return []
  const tokens = t.split(' ').filter(w => w.length > 1)
  if (!tokens.length) return []

  const scored = clients.map(c => {
    const hay = normalize(`${c.name} ${c.business_name ?? ''}`)
    const hayTokens = hay.split(' ')
    let score = 0
    for (const tok of tokens) {
      if (hayTokens.some(h => h === tok)) score += 2
      else if (hayTokens.some(h => h.startsWith(tok))) score += 1
    }
    // Full-phrase containment is the strongest signal
    if (hay.includes(t)) score += 3
    return { c, score }
  }).filter(s => s.score > 0)

  scored.sort((a, b) => b.score - a.score)
  // Keep only candidates within striking distance of the top score
  const top = scored[0]?.score ?? 0
  return scored.filter(s => s.score >= Math.max(2, top - 1)).map(s => s.c).slice(0, 4)
}

/** Parse a disambiguation reply ("the first one", "Wyatt", "number two") against candidates. */
export function parseDisambiguation(text: string, candidates: ClientCandidate[]): ClientCandidate | null {
  const t = normalize(text)
  const ordinals = ['first', 'second', 'third', 'fourth']
  for (let i = 0; i < candidates.length; i++) {
    if (new RegExp(`\\b(${ordinals[i]}|number ${i + 1}|${i + 1})\\b`).test(t)) return candidates[i]
  }
  const rematch = matchClients(t, candidates)
  return rematch.length === 1 ? rematch[0] : null
}

// ─── Status flags (post-save question) ───────────────────────────────────────

export interface StatusFlags {
  stage?: 'churn_risk'
  thatcher_needed?: boolean
  payment_issue?: boolean
  urgency_level?: 'high'
  va_needed?: boolean
  new_ads?: boolean
  last_client_sentiment?: 'close_ready'
}

const FLAG_MAP: [RegExp, keyof StatusFlags, StatusFlags[keyof StatusFlags]][] = [
  [/\bchurn( risk)?\b/, 'stage', 'churn_risk'],
  [/\bthatcher\b/, 'thatcher_needed', true],
  [/\bpayment( issue)?\b/, 'payment_issue', true],
  [/\b(urgent|urgency|high priority|needs attention)\b/, 'urgency_level', 'high'],
  [/\b(va|coaching|needs coaching)\b/, 'va_needed', true],
  [/\b(new )?ads?\b/, 'new_ads', true],
  [/\b(close ready|ready to close)\b/, 'last_client_sentiment', 'close_ready'],
]

export function parseStatusFlags(text: string): StatusFlags | null {
  const t = normalize(text)
  const flags: StatusFlags = {}
  for (const [re, key, val] of FLAG_MAP) {
    if (re.test(t)) (flags as Record<string, unknown>)[key] = val
  }
  return Object.keys(flags).length ? flags : null
}

export function flagsSummary(flags: StatusFlags): string {
  const parts: string[] = []
  if (flags.stage === 'churn_risk') parts.push('churn risk')
  if (flags.thatcher_needed) parts.push('Thatcher needed')
  if (flags.payment_issue) parts.push('payment issue')
  if (flags.urgency_level === 'high') parts.push('high urgency')
  if (flags.va_needed) parts.push('needs coaching')
  if (flags.new_ads) parts.push('needs ads')
  if (flags.last_client_sentiment === 'close_ready') parts.push('close ready')
  return parts.join(', ')
}

// ─── Misc ────────────────────────────────────────────────────────────────────

export function sentenceCase(text: string): string {
  const t = text.trim()
  if (!t) return t
  return t.charAt(0).toUpperCase() + t.slice(1)
}

/** Map a spoken field name to a wizard step field (for "change the outcome" at confirm). */
export function parseFieldName(text: string): string | null {
  const t = normalize(text)
  if (/\bclient\b/.test(t)) return 'client_id'
  if (/\b(type|log type|contact)\b/.test(t)) return 'log_type'
  if (/\boutcome\b/.test(t)) return 'outcome'
  if (/\b(summary|notes?)\b/.test(t)) return 'summary'
  if (/\b(follow ?up|date)\b/.test(t)) return 'followup_date'
  if (/\b(sentiment|mood|feeling)\b/.test(t)) return 'sentiment'
  if (/\b(next steps?)\b/.test(t)) return 'next_step'
  if (/\b(action items?|promises?)\b/.test(t)) return 'promises_made'
  return null
}
