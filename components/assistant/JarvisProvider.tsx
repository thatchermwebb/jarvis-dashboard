'use client'

import { createContext, useContext, useCallback, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { WakeWordManager, speechRecognitionSupported } from '@/lib/voice/recognition'
import { speak, stopSpeaking, initVoices, ttsSupported, prewarm } from '@/lib/voice/tts'
import {
  initWizard, handleUtterance as wizardHandle, resolveClientUtterance, applyClientById,
  applyFallbackValue, afterSave, afterSaveError, onSilenceTimeout, STEP_PROMPTS,
  type WizardState, type WizardResult, type WizardEffect,
} from '@/lib/voice/logCallMachine'
import type { ClientCandidate, StatusFlags } from '@/lib/voice/localParsers'
import { getUserById } from '@/lib/auth'
import { localToday } from '@/lib/utils'
import type { OrbStatus } from './ArcReactorOrb'

// ─── Context shape ────────────────────────────────────────────────────────────

export interface JarvisMessage {
  role: 'user' | 'assistant'
  content: string
}

interface JarvisContextValue {
  supported: boolean
  status: OrbStatus
  voiceEnabled: boolean
  permissionDenied: boolean
  panelOpen: boolean
  setPanelOpen: (open: boolean) => void
  messages: JarvisMessage[]
  clearMessages: () => void
  interim: string
  busy: boolean
  wizard: WizardState | null
  enableVoice: () => void
  disableVoice: () => void
  sendText: (text: string) => void
  startLogWizard: () => void
}

const JarvisContext = createContext<JarvisContextValue | null>(null)

export function useJarvis(): JarvisContextValue {
  const ctx = useContext(JarvisContext)
  if (!ctx) throw new Error('useJarvis must be used inside JarvisProvider')
  return ctx
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getActiveUserFirstName(): string {
  if (typeof document === 'undefined') return 'Diego'
  const raw = document.cookie.split(';').find(c => c.trim().startsWith('cza_user='))
  const id = raw?.split('=')[1]?.trim()
  const user = id ? getUserById(id) : undefined
  return user?.name.split(' ')[0] ?? 'Diego'
}

function chime() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain); gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.08, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18)
    osc.start(); osc.stop(ctx.currentTime + 0.18)
  } catch { /* audio blocked — fine */ }
}

const LOG_INTENT_RE = /\blog (?:a |another |the )?(call|text|meeting|note|voicemail|email)?\b/
const TASK_INTENT_RE = /\b(?:add|create|put in|make)\b.*\btask\b|\btask\b.*\bfor (?:diego|thatcher|trepp)\b/
const DISMISS_RE = /^(?:cancel|stop|never ?mind|go to sleep|goodbye|thats all|dismiss(ed)?)[.!]?$/

// ─── Provider ────────────────────────────────────────────────────────────────

export function JarvisProvider({ children }: { children: React.ReactNode }) {
  const [supported, setSupported] = useState(false)
  const [status, setStatus] = useState<OrbStatus>('off')
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [messages, setMessages] = useState<JarvisMessage[]>([])
  const [interim, setInterim] = useState('')
  const [busy, setBusy] = useState(false)
  const [wizard, setWizard] = useState<WizardState | null>(null)

  const managerRef = useRef<WakeWordManager | null>(null)
  const wizardRef = useRef<WizardState | null>(null)
  const voiceEnabledRef = useRef(false)
  const busyRef = useRef(false)
  const bargedRef = useRef(false)
  const clientsRef = useRef<ClientCandidate[]>([])
  const messagesRef = useRef<JarvisMessage[]>([])

  wizardRef.current = wizard
  voiceEnabledRef.current = voiceEnabled
  messagesRef.current = messages

  const appendMessage = useCallback((m: JarvisMessage) => {
    // Sync the ref immediately — callAgent reads it in the same tick,
    // before React re-renders
    messagesRef.current = [...messagesRef.current, m]
    setMessages(messagesRef.current)
  }, [])

  // Speak (if voice on) + always add to transcript. Mic stays HOT in speaking
  // mode so "Hey JARVIS" can barge in; everything else is ignored meanwhile.
  const say = useCallback(async (text: string) => {
    appendMessage({ role: 'assistant', content: text })
    if (voiceEnabledRef.current && ttsSupported()) {
      setStatus('speaking')
      bargedRef.current = false
      managerRef.current?.enterSpeakingMode()
      await speak(text)
      if (bargedRef.current) return // barge-in handler already took over
      managerRef.current?.endSpeaking()
    }
    const mode = managerRef.current?.currentMode
    if (!voiceEnabledRef.current) setStatus('off')
    else setStatus(mode === 'command' ? 'listening' : 'wake')
  }, [appendMessage])

  const returnToWake = useCallback(() => {
    managerRef.current?.enterWakeMode()
    setStatus(voiceEnabledRef.current ? 'wake' : 'off')
  }, [])

  // ─── Wizard effect processor ───────────────────────────────────────────────

  const ensureClients = useCallback(async (): Promise<ClientCandidate[]> => {
    if (clientsRef.current.length) return clientsRef.current
    try {
      const res = await fetch('/api/clients')
      const data = await res.json()
      clientsRef.current = (Array.isArray(data) ? data : [])
        .filter((c: { stage?: string }) => c.stage !== 'churned')
        .map((c: { id: string; name: string; business_name?: string }) => ({
          id: c.id, name: c.name, business_name: c.business_name,
        }))
    } catch { /* keep empty; fallback parse will handle */ }
    return clientsRef.current
  }, [])

  const processResult = useCallback(async (result: WizardResult): Promise<void> => {
    setWizard(result.state)
    wizardRef.current = result.state

    for (const effect of result.effects) {
      await runEffect(effect, result.state)
    }

    async function runEffect(effect: WizardEffect, state: WizardState): Promise<void> {
      switch (effect.type) {
        case 'speak': {
          await say(effect.text)
          if (effect.expectsFiveSecondWindow && voiceEnabledRef.current) {
            managerRef.current?.enterCommandMode({ initialSilenceTimeoutMs: 5000 })
            setStatus('listening')
          }
          break
        }

        case 'parse_fallback': {
          // 'client_local_first' is resolved locally with the client list
          if (effect.field === 'client_local_first') {
            const clients = await ensureClients()
            const r = resolveClientUtterance(state, effect.transcript, clients)
            await processResult(r)
            return
          }
          setStatus('thinking')
          setBusy(true)
          try {
            const clients = effect.field === 'client' ? await ensureClients() : undefined
            const res = await fetch('/api/jarvis/parse', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                field: effect.field,
                transcript: effect.transcript,
                context: {
                  today: localToday(),
                  clientNames: clients?.map(c => ({ id: c.id, name: `${c.name}${c.business_name ? ` (${c.business_name})` : ''}` })),
                },
              }),
            })
            const parsed = await res.json()
            let r: WizardResult
            if (effect.field === 'client' && parsed.value) {
              r = applyClientById(state, String(parsed.value), await ensureClients())
            } else if (effect.field === 'date' && parsed.value?.date === 'none') {
              r = applyFallbackValue(state, 'none', parsed.confidence === 'low' ? parsed.clarify : undefined)
            } else {
              r = applyFallbackValue(state, parsed.value, parsed.confidence === 'low' ? parsed.clarify : undefined)
            }
            await processResult(r)
          } catch {
            await say("I didn't catch that, sir. Once more?")
          } finally {
            setBusy(false)
          }
          return
        }

        case 'save_log': {
          setStatus('thinking')
          setBusy(true)
          try {
            const d = state.draft
            const body: Record<string, unknown> = {
              client_id: d.client_id,
              log_type: d.log_type ?? 'call',
              outcome: d.outcome || undefined,
              summary: d.summary,
              sentiment: d.sentiment || undefined,
              promises_made: d.promises_made || undefined,
              next_step: d.next_step || undefined,
              created_by: getActiveUserFirstName(),
            }
            if (d.followup_date) body.followup_date = d.followup_date
            if (d.followup_time) body.followup_time = d.followup_time
            const res = await fetch('/api/communication-logs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
            if (!res.ok) throw new Error('save failed')
            const saved = await res.json()
            toast.success(`Call logged for ${d.client_name}`)
            await processResult(afterSave(state, saved?.id ?? null))
          } catch {
            toast.error('Failed to save call log')
            await processResult(afterSaveError(state))
          } finally {
            setBusy(false)
          }
          return
        }

        case 'apply_flags': {
          const clientId = state.draft.client_id
          if (!clientId) return
          try {
            await fetch(`/api/clients/${clientId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(effect.flags satisfies StatusFlags),
            })
            toast.success(`Statuses updated for ${state.draft.client_name}`)
          } catch {
            toast.error('Failed to update statuses')
          }
          break
        }

        case 'abort':
        case 'finished': {
          setWizard(null)
          wizardRef.current = null
          returnToWake()
          break
        }
      }
    }
  }, [say, ensureClients, returnToWake])

  // ─── Agent Q&A / one-shot actions ─────────────────────────────────────────

  const callAgent = useCallback(async (hint?: 'task' | 'general') => {
    setStatus('thinking')
    setBusy(true)
    try {
      const res = await fetch('/api/jarvis/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: messagesRef.current.slice(-12),
          user: getActiveUserFirstName(),
          hint,
        }),
      })
      const data = await res.json().catch(() => ({}))
      for (const action of data.actions ?? []) {
        toast.success(action.summary)
      }
      // Never mask an error response as success
      const reply = data.reply ?? (res.ok ? 'Done, sir.' : 'I hit a snag, sir. Do try again.')
      await say(reply)
      // Keep a follow-up window open — the command deadline returns us to
      // passive wake mode automatically if the user says nothing.
      if (voiceEnabledRef.current) {
        managerRef.current?.enterCommandMode()
        setStatus('listening')
      }
    } catch {
      await say('I hit a snag reaching the server, sir.')
      if (voiceEnabledRef.current) {
        managerRef.current?.enterCommandMode()
        setStatus('listening')
      }
    } finally {
      setBusy(false)
    }
  }, [say, returnToWake])

  // ─── Streaming text chat (classic mode, typed non-action questions) ───────

  const streamChat = useCallback(async (text: string) => {
    setBusy(true)
    setMessages(prev => [...prev, { role: 'assistant', content: '' }])
    try {
      const res = await fetch('/api/jarvis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          history: messagesRef.current.slice(0, -1).slice(-12),
        }),
      })
      if (!res.body) throw new Error('No stream')
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = {
            ...updated[updated.length - 1],
            content: updated[updated.length - 1].content + chunk,
          }
          return updated
        })
      }
    } catch {
      setMessages(prev => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: 'Something went wrong. Please check your API key.' }
        return updated
      })
    } finally {
      setBusy(false)
    }
  }, [])

  // ─── Wizard entry ──────────────────────────────────────────────────────────

  const startLogWizard = useCallback(async (prefillType?: string) => {
    setPanelOpen(true)
    void ensureClients()
    // Warm the TTS cache for the fixed prompts so each step speaks instantly
    prewarm(Object.values(STEP_PROMPTS).filter(Boolean))
    if (voiceEnabledRef.current) {
      managerRef.current?.enterCommandMode()
      setStatus('listening')
    }
    await processResult(initWizard(prefillType))
  }, [ensureClients, processResult])

  // ─── Central utterance handler (voice + typed both land here) ─────────────

  const handleInput = useCallback(async (text: string, source: 'voice' | 'text') => {
    const trimmed = text.trim()
    if (!trimmed || busyRef.current) return
    setInterim('')
    appendMessage({ role: 'user', content: trimmed })

    // Active wizard consumes everything
    if (wizardRef.current) {
      await processResult(wizardHandle(wizardRef.current, trimmed))
      return
    }

    const t = trimmed.toLowerCase()

    if (DISMISS_RE.test(t)) {
      await say('Very well, sir.')
      returnToWake()
      return
    }

    const logMatch = LOG_INTENT_RE.exec(t)
    if (logMatch && /\blog\b/.test(t)) {
      const typeMap: Record<string, string> = { call: 'call', text: 'text', meeting: 'meeting', note: 'note', voicemail: 'voicemail', email: 'email' }
      await startLogWizard(logMatch[1] ? typeMap[logMatch[1]] : undefined)
      return
    }

    if (TASK_INTENT_RE.test(t)) {
      await callAgent('task')
      return
    }

    // General Q&A: voice goes through the agent (spoken, tools);
    // typed questions with voice off keep the classic streaming chat.
    if (source === 'voice' || voiceEnabledRef.current) {
      await callAgent('general')
    } else {
      await streamChat(trimmed)
    }
  }, [appendMessage, processResult, say, returnToWake, startLogWizard, callAgent, streamChat])

  busyRef.current = busy

  const handleInputRef = useRef(handleInput)
  handleInputRef.current = handleInput

  // ─── Recognition lifecycle ─────────────────────────────────────────────────

  useEffect(() => {
    setSupported(speechRecognitionSupported())
    initVoices()

    const manager = new WakeWordManager({
      onWake: (trailing) => {
        chime()
        setPanelOpen(true)
        setStatus('listening')
        if (!trailing) {
          // Acknowledge and wait for the command
          void speak('Sir?')
        }
      },
      onUtterance: (transcript) => {
        void handleInputRef.current(transcript, 'voice')
      },
      onBargeIn: (trailing) => {
        // "Hey JARVIS" while it's talking — shut up and listen. Recognition is
        // already in command mode and will dispatch the command via onUtterance.
        stopSpeaking()
        bargedRef.current = true
        setWizard(null); wizardRef.current = null
        setInterim(trailing || '')
        setStatus('listening')
      },
      onInterim: (transcript) => setInterim(transcript),
      onTimeout: () => {
        setInterim('')
        const w = wizardRef.current
        if (w) {
          void (async () => {
            const r = onSilenceTimeout(w)
            setWizard(r.state)
            wizardRef.current = r.state
            for (const e of r.effects) {
              if (e.type === 'speak') await speak(e.text)
              if (e.type === 'finished') { setWizard(null); wizardRef.current = null }
            }
            setStatus(voiceEnabledRef.current ? 'wake' : 'off')
          })()
        } else {
          setStatus(voiceEnabledRef.current ? 'wake' : 'off')
        }
      },
      onPermissionDenied: () => {
        setPermissionDenied(true)
        setVoiceEnabled(false)
        setStatus('off')
        localStorage.removeItem('jarvis_voice_enabled')
      },
      onStateChange: () => { /* orb status is driven by mode transitions */ },
    })
    managerRef.current = manager

    // Auto-resume if previously enabled (permission already granted)
    if (speechRecognitionSupported() && localStorage.getItem('jarvis_voice_enabled') === '1') {
      if (manager.start()) {
        setVoiceEnabled(true)
        setStatus('wake')
      }
    }

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') manager.mute()
      else manager.unmute()
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      manager.stop()
      stopSpeaking()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const enableVoice = useCallback(() => {
    if (!managerRef.current) return
    setPermissionDenied(false)
    if (managerRef.current.start()) {
      setVoiceEnabled(true)
      setStatus('wake')
      localStorage.setItem('jarvis_voice_enabled', '1')
    }
  }, [])

  const disableVoice = useCallback(() => {
    managerRef.current?.stop()
    stopSpeaking()
    setVoiceEnabled(false)
    setStatus('off')
    localStorage.removeItem('jarvis_voice_enabled')
  }, [])

  const sendText = useCallback((text: string) => {
    void handleInputRef.current(text, 'text')
  }, [])

  const clearMessages = useCallback(() => setMessages([]), [])

  return (
    <JarvisContext.Provider value={{
      supported, status, voiceEnabled, permissionDenied, panelOpen, setPanelOpen,
      messages, clearMessages, interim, busy, wizard,
      enableVoice, disableVoice, sendText,
      startLogWizard: () => void startLogWizard(),
    }}>
      {children}
    </JarvisContext.Provider>
  )
}
