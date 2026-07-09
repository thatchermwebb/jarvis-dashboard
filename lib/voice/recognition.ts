// Always-on wake-word listener + command capture built on webkitSpeechRecognition.
// One recognition instance, two modes:
//   wake    — scanning every transcript for "Hey JARVIS"
//   command — accumulating an utterance, ended by a silence timer

/* eslint-disable @typescript-eslint/no-explicit-any */

const WAKE_RE = /\b(?:hey\s+)?(?:jarvis|jarvys|jervis|jarves|travis|drivers)\b/i

export type RecognitionMode = 'wake' | 'command'

export interface WakeWordCallbacks {
  onWake: (trailingCommand: string) => void
  onUtterance: (transcript: string) => void
  onInterim: (transcript: string) => void
  onTimeout: () => void
  onPermissionDenied: () => void
  onStateChange: (listening: boolean) => void
}

export function speechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false
  return !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)
}

export class WakeWordManager {
  private recognition: any = null
  private mode: RecognitionMode = 'wake'
  private enabled = false
  private muted = false
  private restartTimer: ReturnType<typeof setTimeout> | null = null
  private silenceTimer: ReturnType<typeof setTimeout> | null = null
  private initialSilenceTimer: ReturnType<typeof setTimeout> | null = null
  private commandBuffer = ''
  private lastWakeAt = 0
  private silenceMs = 900
  private cb: WakeWordCallbacks

  constructor(callbacks: WakeWordCallbacks) {
    this.cb = callbacks
  }

  get isEnabled() { return this.enabled }
  get currentMode() { return this.mode }

  start(): boolean {
    if (!speechRecognitionSupported()) return false
    this.enabled = true
    this.spinUp()
    return true
  }

  stop(): void {
    this.enabled = false
    this.clearTimers()
    if (this.restartTimer) { clearTimeout(this.restartTimer); this.restartTimer = null }
    try { this.recognition?.abort() } catch { /* noop */ }
    this.recognition = null
    this.cb.onStateChange(false)
  }

  /** Abort recognition while JARVIS speaks (prevents self-hearing). */
  mute(): void {
    this.muted = true
    this.clearTimers()
    try { this.recognition?.abort() } catch { /* noop */ }
  }

  /** Resume after speech, with a grace delay so trailing audio isn't captured. */
  unmute(): void {
    if (!this.muted) return
    this.muted = false
    if (!this.enabled) return
    setTimeout(() => { if (this.enabled && !this.muted) this.spinUp() }, 250)
  }

  /** Switch to command mode (after wake, or when the app opens the mic directly). */
  enterCommandMode(opts?: { initialSilenceTimeoutMs?: number; silenceMs?: number }): void {
    this.mode = 'command'
    this.commandBuffer = ''
    this.silenceMs = opts?.silenceMs ?? 900
    this.clearTimers()
    if (opts?.initialSilenceTimeoutMs) {
      this.initialSilenceTimer = setTimeout(() => {
        this.mode = 'wake'
        this.commandBuffer = ''
        this.cb.onTimeout()
      }, opts.initialSilenceTimeoutMs)
    }
    if (this.enabled && !this.muted && !this.recognition) this.spinUp()
  }

  enterWakeMode(): void {
    this.mode = 'wake'
    this.commandBuffer = ''
    this.clearTimers()
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private spinUp(): void {
    if (this.recognition) return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'

    rec.onresult = (event: any) => {
      let interim = ''
      let finals = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) finals += r[0].transcript + ' '
        else interim += r[0].transcript + ' '
      }
      const combined = (finals + interim).trim()

      if (this.mode === 'wake') {
        this.handleWakeScan(combined)
      } else {
        // Any speech cancels the initial-silence window
        if (this.initialSilenceTimer && combined) {
          clearTimeout(this.initialSilenceTimer)
          this.initialSilenceTimer = null
        }
        if (finals.trim()) this.commandBuffer = (this.commandBuffer + ' ' + finals).trim()
        const preview = (this.commandBuffer + ' ' + interim).trim()
        if (preview) this.cb.onInterim(preview)
        this.bumpSilenceTimer()
      }
    }

    rec.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        this.enabled = false
        this.recognition = null
        this.cb.onPermissionDenied()
        this.cb.onStateChange(false)
      }
      // 'no-speech' / 'aborted' / 'network' → onend fires next; auto-restart handles it
    }

    rec.onend = () => {
      this.recognition = null
      if (this.enabled && !this.muted) {
        this.restartTimer = setTimeout(() => {
          if (this.enabled && !this.muted) this.spinUp()
        }, 250)
      } else {
        this.cb.onStateChange(false)
      }
    }

    try {
      rec.start()
      this.recognition = rec
      this.cb.onStateChange(true)
    } catch {
      // start() throws if called while already started — retry shortly
      this.restartTimer = setTimeout(() => { if (this.enabled && !this.muted) this.spinUp() }, 400)
    }
  }

  private handleWakeScan(transcript: string): void {
    const m = WAKE_RE.exec(transcript)
    if (!m) return
    const now = Date.now()
    if (now - this.lastWakeAt < 1500) return // debounce interim+final double fire
    this.lastWakeAt = now

    const trailing = transcript.slice((m.index ?? 0) + m[0].length).replace(/^[,.\s]+/, '').trim()
    this.mode = 'command'
    this.commandBuffer = ''
    this.cb.onWake(trailing)
    if (trailing) {
      // The command came in the same breath — treat it as buffered speech
      this.commandBuffer = trailing
      this.bumpSilenceTimer()
    }
  }

  private bumpSilenceTimer(): void {
    if (this.silenceTimer) clearTimeout(this.silenceTimer)
    this.silenceTimer = setTimeout(() => {
      const utterance = this.commandBuffer.trim()
      this.commandBuffer = ''
      if (utterance) {
        this.cb.onUtterance(utterance)
      }
    }, this.silenceMs)
  }

  private clearTimers(): void {
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null }
    if (this.initialSilenceTimer) { clearTimeout(this.initialSilenceTimer); this.initialSilenceTimer = null }
  }
}
