// Pure state machine for the JARVIS guided call-log wizard.
// The provider feeds it utterances; it returns the new state plus what JARVIS
// should say next. Async work (Claude fallback parse, saving) is signaled via
// `effect` so the machine itself stays synchronous and testable.

import {
  parseGlobalCommand, parseLogType, parseOutcome, parseSentiment, parseYesNo,
  parseRelativeDate, parseTime, matchClients, parseDisambiguation,
  parseStatusFlags, parseFieldName, sentenceCase, flagsSummary, normalize, isCancel,
  type ClientCandidate, type StatusFlags,
} from './localParsers'
import { localToday } from '@/lib/utils'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LogDraft {
  client_id: string | null
  client_name: string | null
  log_type: string | null
  outcome: string | null
  summary: string | null
  followup_date: string | null
  followup_time: string | null
  sentiment: string | null
  next_step: string | null
  promises_made: string | null
}

export type WizardStep =
  | 'client' | 'log_type' | 'outcome' | 'summary' | 'followup'
  | 'sentiment' | 'next_step' | 'promises' | 'confirm' | 'status_flags' | 'done'

export interface WizardState {
  step: WizardStep
  draft: LogDraft
  candidates: ClientCandidate[]      // pending disambiguation options
  editReturn: boolean                 // true when a "change X" jump should return to confirm
  savedLogId: string | null
  pendingFlags: StatusFlags | null
}

export type WizardEffect =
  | { type: 'speak'; text: string; expectsFiveSecondWindow?: boolean }
  | { type: 'parse_fallback'; field: string; transcript: string }
  | { type: 'save_log' }
  | { type: 'apply_flags'; flags: StatusFlags }
  | { type: 'abort' }
  | { type: 'finished' }

export interface WizardResult {
  state: WizardState
  effects: WizardEffect[]
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

export const STEP_PROMPTS: Record<WizardStep, string> = {
  client: 'Which client are we logging for, sir?',
  log_type: 'What type of contact was it — call, text, meeting, email, voicemail, or note?',
  outcome: 'Outcome of the call, sir?',
  summary: 'And what would you like me to note down?',
  followup: 'When should we follow up next?',
  sentiment: "And what was the client's sentiment, sir?",
  next_step: 'Next steps?',
  promises: 'Any action items?',
  confirm: '', // built dynamically
  status_flags: '', // built dynamically
  done: '',
}

const OPTIONAL_STEPS = new Set<WizardStep>(['outcome', 'followup', 'sentiment', 'next_step', 'promises'])

const STEP_ORDER: WizardStep[] = ['client', 'log_type', 'outcome', 'summary', 'followup', 'sentiment', 'next_step', 'promises', 'confirm']

export function emptyDraft(): LogDraft {
  return {
    client_id: null, client_name: null, log_type: null, outcome: null,
    summary: null, followup_date: null, followup_time: null,
    sentiment: null, next_step: null, promises_made: null,
  }
}

export function initWizard(prefillLogType?: string): WizardResult {
  const state: WizardState = {
    step: 'client',
    draft: { ...emptyDraft(), log_type: prefillLogType ?? null },
    candidates: [],
    editReturn: false,
    savedLogId: null,
    pendingFlags: null,
  }
  return { state, effects: [{ type: 'speak', text: STEP_PROMPTS.client }] }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function nextStep(state: WizardState): WizardStep {
  if (state.editReturn) return 'confirm'
  const idx = STEP_ORDER.indexOf(state.step)
  for (let i = idx + 1; i < STEP_ORDER.length; i++) {
    const s = STEP_ORDER[i]
    // outcome only makes sense for interactive contact types
    if (s === 'outcome' && ['note', 'email'].includes(state.draft.log_type ?? '')) continue
    // log_type may have been prefilled from "log a text"
    if (s === 'log_type' && state.draft.log_type) continue
    return s
  }
  return 'confirm'
}

function prevStep(state: WizardState): WizardStep {
  const idx = STEP_ORDER.indexOf(state.step)
  for (let i = idx - 1; i >= 0; i--) {
    const s = STEP_ORDER[i]
    if (s === 'outcome' && ['note', 'email'].includes(state.draft.log_type ?? '')) continue
    return s
  }
  return 'client'
}

function advance(state: WizardState): WizardResult {
  const step = nextStep(state)
  const newState = { ...state, step, editReturn: false }
  const prompt = step === 'confirm' ? confirmPrompt(newState.draft) : STEP_PROMPTS[step]
  return { state: newState, effects: [{ type: 'speak', text: prompt }] }
}

export function confirmPrompt(draft: LogDraft): string {
  const bits: string[] = []
  bits.push(`Logging a ${draft.log_type ?? 'call'} with ${draft.client_name ?? 'the client'}`)
  if (draft.outcome) bits.push(draft.outcome.replace(/_/g, ' '))
  if (draft.followup_date) bits.push(`follow-up ${spokenDate(draft.followup_date)}`)
  if (draft.sentiment) bits.push(`sentiment ${draft.sentiment.replace(/_/g, ' ')}`)
  return `${bits.join(', ')}. Shall I save it, sir?`
}

export function statusFlagsPrompt(draft: LogDraft): string {
  return `Are there any other statuses we should note down for ${draft.client_name ?? 'the client'}, sir?`
}

function spokenDate(dateStr: string): string {
  const today = localToday()
  if (dateStr === today) return 'today'
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(y, m - 1, d, 12)
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  if (dt.toDateString() === tomorrow.toDateString()) return 'tomorrow'
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
}

// ─── Fallback application (called by provider after /api/jarvis/parse) ───────

// Given a fallback parse result for the current step, apply it as if the local
// parser had produced it. `value: null` means Claude couldn't parse it either.
export function applyFallbackValue(state: WizardState, value: unknown, clarify?: string): WizardResult {
  if (clarify) {
    // Clarifies are spoken — anything long gets replaced with a simple re-ask
    const text = clarify.length <= 100 ? clarify : 'Sorry sir, could you say that again?'
    return { state, effects: [{ type: 'speak', text }] }
  }
  if (value == null) {
    return { state, effects: [{ type: 'speak', text: 'Sorry sir, could you say that again?' }] }
  }
  return applyValue(state, value)
}

export function currentPrompt(state: WizardState): string {
  if (state.step === 'confirm') return confirmPrompt(state.draft)
  if (state.step === 'status_flags') return statusFlagsPrompt(state.draft)
  return STEP_PROMPTS[state.step]
}

const FIELD_TO_STEP: Record<string, WizardStep> = {
  client_id: 'client', log_type: 'log_type', outcome: 'outcome', summary: 'summary',
  followup_date: 'followup', sentiment: 'sentiment', next_step: 'next_step', promises_made: 'promises',
}

function gotoField(state: WizardState, field: string): WizardResult {
  const step = FIELD_TO_STEP[field]
  if (!step) return { state, effects: [{ type: 'speak', text: 'Which field shall I change, sir?' }] }
  const newState = { ...state, step, editReturn: state.step === 'confirm', candidates: [] }
  return { state: newState, effects: [{ type: 'speak', text: STEP_PROMPTS[step] }] }
}

// ─── AI wizard interpreter (the "brain" mid-wizard) ──────────────────────────

export interface WizardBrainAction {
  action: 'answer' | 'edit' | 'goto' | 'cancel' | 'save' | 'skip' | 'clarify'
  field?: string | null
  value?: string | null
  time?: string | null
  clarify?: string | null
}

/** Apply the AI interpreter's decision about an ambiguous mid-wizard utterance. */
export function applyWizardAction(state: WizardState, a: WizardBrainAction): WizardResult {
  switch (a.action) {
    case 'cancel':
      return { state: { ...state, step: 'done' }, effects: [{ type: 'speak', text: 'Very well, sir. Scrapped.' }, { type: 'abort' }] }

    case 'save':
      return { state, effects: [{ type: 'save_log' }] }

    case 'skip': {
      if (state.step === 'confirm') return { state, effects: [{ type: 'speak', text: currentPrompt(state) }] }
      return handleUtterance(state, 'skip')
    }

    case 'goto':
      return a.field ? gotoField(state, a.field) : { state, effects: [{ type: 'speak', text: 'Which field shall I change, sir?' }] }

    case 'edit': {
      // Set a field in place ("switch it to text") without derailing the flow
      if (!a.field || a.value == null) return { state, effects: [{ type: 'speak', text: currentPrompt(state) }] }
      const draft = { ...state.draft }
      switch (a.field) {
        case 'log_type': draft.log_type = a.value; break
        case 'outcome': draft.outcome = a.value; break
        case 'summary': draft.summary = sentenceCase(a.value); break
        case 'followup_date': draft.followup_date = a.value === 'none' ? null : a.value; if (a.time) draft.followup_time = a.time; break
        case 'sentiment': draft.sentiment = a.value; break
        case 'next_step': draft.next_step = sentenceCase(a.value); break
        case 'promises_made': draft.promises_made = sentenceCase(a.value); break
        default: return { state, effects: [{ type: 'speak', text: currentPrompt(state) }] }
      }
      const newState = { ...state, draft }
      const prompt = newState.step === 'confirm' ? confirmPrompt(draft) : currentPrompt(newState)
      return { state: newState, effects: [{ type: 'speak', text: `Done. ${prompt}` }] }
    }

    case 'answer': {
      if (a.value == null) return { state, effects: [{ type: 'speak', text: `Sorry sir, could you say that again?` }] }
      if (state.step === 'followup') {
        return applyFallbackValue(state, a.value === 'none' ? 'none' : { date: a.value, time: a.time ?? undefined })
      }
      return applyFallbackValue(state, a.value)
    }

    case 'clarify':
    default: {
      const text = a.clarify && a.clarify.length <= 100 ? a.clarify : 'Sorry sir, could you say that again?'
      return { state, effects: [{ type: 'speak', text }] }
    }
  }
}

function applyValue(state: WizardState, value: unknown): WizardResult {
  const draft = { ...state.draft }
  switch (state.step) {
    case 'client': {
      const v = value as ClientCandidate
      draft.client_id = v.id
      draft.client_name = v.name
      break
    }
    case 'log_type': draft.log_type = String(value); break
    case 'outcome': draft.outcome = String(value); break
    case 'summary': draft.summary = sentenceCase(String(value)); break
    case 'followup': {
      if (value === 'none') { draft.followup_date = null; draft.followup_time = null }
      else if (typeof value === 'object' && value !== null) {
        const v = value as { date?: string; time?: string }
        draft.followup_date = v.date ?? null
        draft.followup_time = v.time ?? null
      } else draft.followup_date = String(value)
      break
    }
    case 'sentiment': draft.sentiment = String(value); break
    case 'next_step': draft.next_step = sentenceCase(String(value)); break
    case 'promises': draft.promises_made = sentenceCase(String(value)); break
    case 'status_flags': {
      const flags = value as StatusFlags
      const newState: WizardState = { ...state, draft, step: 'done', pendingFlags: flags }
      return {
        state: newState,
        effects: [
          { type: 'apply_flags', flags },
          { type: 'speak', text: `Noted — ${flagsSummary(flags)} for ${draft.client_name}. All done, sir.` },
          { type: 'finished' },
        ],
      }
    }
  }
  return advance({ ...state, draft })
}

// ─── Main reducer ────────────────────────────────────────────────────────────

export function handleUtterance(state: WizardState, transcript: string): WizardResult {
  const text = transcript.trim()
  if (!text) return { state, effects: [] }

  // Global commands first
  const cmd = parseGlobalCommand(text)
  if (cmd === 'cancel') {
    return { state: { ...state, step: 'done' }, effects: [{ type: 'speak', text: 'Very well, sir. Cancelled.' }, { type: 'abort' }] }
  }
  if (cmd === 'repeat') {
    return { state, effects: [{ type: 'speak', text: currentPrompt(state) }] }
  }
  if (cmd === 'back' && state.step !== 'client' && state.step !== 'status_flags') {
    const step = prevStep(state)
    const newState = { ...state, step, editReturn: false }
    return { state: newState, effects: [{ type: 'speak', text: STEP_PROMPTS[step] }] }
  }
  if (cmd === 'skip') {
    if (state.step === 'status_flags') {
      return { state: { ...state, step: 'done' }, effects: [{ type: 'speak', text: 'Very good, sir. All done.' }, { type: 'finished' }] }
    }
    if (OPTIONAL_STEPS.has(state.step)) return advance(state)
    return { state, effects: [{ type: 'speak', text: `I do need this one, sir. ${currentPrompt(state)}` }] }
  }

  switch (state.step) {
    case 'client': {
      // Disambiguating from a previous multi-match?
      if (state.candidates.length > 1) {
        const pick = parseDisambiguation(text, state.candidates)
        if (pick) return applyValue({ ...state, candidates: [] }, pick)
        return { state, effects: [{ type: 'speak', text: `Sorry sir — ${listCandidates(state.candidates)}?` }] }
      }
      return { state, effects: [{ type: 'parse_fallback', field: 'client_local_first', transcript: text }] }
      // NOTE: client matching needs the client list, which lives in the provider.
      // The provider intercepts 'client_local_first' and runs matchClients() itself
      // (see resolveClientUtterance below) — only true misses hit the API.
    }

    case 'log_type': {
      const v = parseLogType(text)
      if (v) return applyValue(state, v)
      return { state, effects: [{ type: 'parse_fallback', field: 'wizard', transcript: text }] }
    }

    case 'outcome': {
      const v = parseOutcome(text)
      if (v) return applyValue(state, v)
      return { state, effects: [{ type: 'parse_fallback', field: 'wizard', transcript: text }] }
    }

    case 'summary': {
      if (normalize(text).split(' ').length < 2) {
        return { state, effects: [{ type: 'speak', text: 'A bit more detail, sir — give me the summary.' }] }
      }
      // Long dictation is the answer; short odd phrases might be a command
      // ("switch it to text") — let the brain decide those.
      if (normalize(text).split(' ').length <= 5 && (parseFieldName(text) || parseLogType(text))) {
        return { state, effects: [{ type: 'parse_fallback', field: 'wizard', transcript: text }] }
      }
      return applyValue(state, text)
    }

    case 'followup': {
      const date = parseRelativeDate(text)
      if (date === 'none') return applyValue(state, 'none')
      if (date) return applyValue(state, { date, time: parseTime(text) ?? undefined })
      return { state, effects: [{ type: 'parse_fallback', field: 'wizard', transcript: text }] }
    }

    case 'sentiment': {
      const v = parseSentiment(text)
      if (v) return applyValue(state, v)
      return { state, effects: [{ type: 'parse_fallback', field: 'wizard', transcript: text }] }
    }

    case 'next_step':
    case 'promises':
      // Short command-shaped phrases go to the brain; real content is applied
      if (normalize(text).split(' ').length <= 5 && (parseFieldName(text) || isCancel(text))) {
        return { state, effects: [{ type: 'parse_fallback', field: 'wizard', transcript: text }] }
      }
      return applyValue(state, text)

    case 'confirm': {
      if (isCancel(text)) {
        return { state: { ...state, step: 'done' }, effects: [{ type: 'speak', text: 'Very well, sir. Scrapped.' }, { type: 'abort' }] }
      }
      const yn = parseYesNo(text)
      if (yn === true) {
        return { state, effects: [{ type: 'save_log' }] }
      }
      // "change the outcome" / "edit the summary"
      const field = parseFieldName(text)
      if (field) return gotoField(state, field)
      // Anything else — including "no, change X to Y" — goes to the brain
      return { state, effects: [{ type: 'parse_fallback', field: 'wizard', transcript: text }] }
    }

    case 'status_flags': {
      const t = normalize(text)
      if (/^(no|nope|nah|nothing|none|all good|were good|thats it|thats all)\b/.test(t)) {
        return { state: { ...state, step: 'done' }, effects: [{ type: 'speak', text: 'Very good, sir. All done.' }, { type: 'finished' }] }
      }
      const flags = parseStatusFlags(text)
      if (flags) return applyValue(state, flags)
      return { state, effects: [{ type: 'parse_fallback', field: 'status_flags', transcript: text }] }
    }

    default:
      return { state, effects: [] }
  }
}

// ─── Client resolution (invoked by provider, which owns the client list) ─────

export function resolveClientUtterance(state: WizardState, transcript: string, clients: ClientCandidate[]): WizardResult {
  const matches = matchClients(transcript, clients)
  if (matches.length === 1) return applyValue(state, matches[0])
  if (matches.length >= 2) {
    const newState = { ...state, candidates: matches }
    return { state: newState, effects: [{ type: 'speak', text: `I have ${listCandidates(matches)} — which one, sir?` }] }
  }
  return { state, effects: [{ type: 'parse_fallback', field: 'client', transcript }] }
}

/** Apply a client picked by the Claude fallback (by id). */
export function applyClientById(state: WizardState, clientId: string, clients: ClientCandidate[]): WizardResult {
  const c = clients.find(x => x.id === clientId)
  if (!c) return { state, effects: [{ type: 'speak', text: `I couldn't find that client, sir. ${STEP_PROMPTS.client}` }] }
  return applyValue({ ...state, candidates: [] }, c)
}

function listCandidates(candidates: ClientCandidate[]): string {
  const names = candidates.map(c => c.business_name || c.name)
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  return names.slice(0, -1).join(', ') + ', and ' + names[names.length - 1]
}

// ─── Post-save transition ────────────────────────────────────────────────────

export function afterSave(state: WizardState, logId: string | null): WizardResult {
  const newState: WizardState = { ...state, step: 'status_flags', savedLogId: logId }
  return {
    state: newState,
    effects: [{ type: 'speak', text: `Noted, the ${state.draft.log_type ?? 'call'} has been logged. ${statusFlagsPrompt(state.draft)}`, expectsFiveSecondWindow: true }],
  }
}

export function afterSaveError(state: WizardState): WizardResult {
  return { state, effects: [{ type: 'speak', text: "I'm having trouble saving, sir. The draft is in the panel — shall I try again?" }] }
}

/** 5-second silence timeout on the status question, or mid-wizard abandon. */
export function onSilenceTimeout(state: WizardState): WizardResult {
  if (state.step === 'status_flags') {
    return { state: { ...state, step: 'done' }, effects: [{ type: 'speak', text: 'Very good, sir.' }, { type: 'finished' }] }
  }
  return { state, effects: [] }
}
