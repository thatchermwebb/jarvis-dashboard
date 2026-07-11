// Always-on wake-word listener + command capture built on webkitSpeechRecognition.
// One recognition instance, two modes:
//   wake    — scanning every transcript for "Hey JARVIS"
//   command — accumulating an utterance, ended by a silence timer

/* eslint-disable @typescript-eslint/no-explicit-any */

const WAKE_RE = /\b(?:hey\s+)?(?:jarvis|jarvys|jervis|jarves|travis|drivers)\b/i
// Barge-in with the full "hey jarvis" is always safe; a bare "jarvis" barge is
// allowed too unless JARVIS's own current speech contains the word.
const BARGE_RE = /\bhey\s+(?:jarvis|jarvys|jervis|jarves|travis|drivers)\b/i
const POWER_RE = /\bpower\s+(?:down|off)\b/i

export type RecognitionMode = 'wake' | 'command' | 'speaking'

export interface WakeWordCallbacks {
  onWake: (trailingCommand: string) => void
  /** alternatives = other recognizer hypotheses for the same audio (may be empty) */
  onUtterance: (transcript: string, alternatives: string[]) => void
  onInterim: (transcript: string) => void
  onTimeout: () => void
  onBargeIn: (trailingCommand: string) => void
  onPowerDown: () => void
  onPermissionDenied: () => void
  onStateChange: (listening: boolean) => void
}

// Loose text normalization for comparing what the mic heard against what
// JARVIS just said (self-echo detection).
function normalize(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim()
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
  private lastResultAt = 0
  private silenceMs = 900
  private startedAt = 0        // when the current session's start() succeeded
  private backoffMs = 300      // restart delay, grows on rapid failures
  private starting = false     // guard against overlapping spinUp() calls
  private speakingSince = 0    // when speaking mode began (barge-in grace window)
  private prevMode: 'wake' | 'command' = 'wake' // mode to restore after speaking
  private echoText = ''        // normalized text JARVIS is saying / just said
  private echoUntil = 0        // echo filter stays active until this timestamp
  private pendingAlternatives: string[] = [] // recognizer hypotheses for the buffered utterance
  private cb: WakeWordCallbacks

  constructor(callbacks: WakeWordCallbacks) {
    this.cb = callbacks
  }

  get isEnabled() { return this.enabled }
  get currentMode() { return this.mode }

  start(): boolean {
    if (!speechRecognitionSupported()) return false
    this.enabled = true
    this.backoffMs = 300 // deliberate start — try immediately
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

  /**
   * JARVIS is about to speak. Keep the mic HOT but in speaking mode, where the
   * only thing we react to is a full "Hey JARVIS" barge-in. Everything else
   * (including JARVIS's own voice bleeding into the mic) is ignored, so the
   * command buffer stays clean without fully deafening ourselves.
   */
  enterSpeakingMode(echoText?: string): void {
    if (this.mode !== 'speaking') this.prevMode = this.mode === 'command' ? 'command' : 'wake'
    this.mode = 'speaking'
    this.commandBuffer = ''
    this.speakingSince = Date.now()
    if (echoText) this.echoText = normalize(echoText)
    this.echoUntil = Number.MAX_SAFE_INTEGER // active for the whole utterance
    this.clearTimers()
    if (this.enabled && !this.recognition) this.spinUp()
  }

  /** JARVIS finished speaking normally — restore the mode we were in before. */
  endSpeaking(): void {
    // Recognition results lag real audio — keep filtering echoes for a bit
    this.echoUntil = Date.now() + 2500
    if (this.mode !== 'speaking') return
    if (this.prevMode === 'command') this.enterCommandMode()
    else this.enterWakeMode()
  }

  /**
   * Register text JARVIS is about to say WITHOUT switching to speaking mode
   * (used for short prompts spoken while a command window stays open, e.g.
   * "Sir?" after a wake — the user's answer must still be captured).
   */
  noteEcho(text: string): void {
    this.echoText = normalize(text)
    this.echoUntil = Date.now() + Math.max(2500, text.length * 90 + 1500)
  }

  /** True when a transcript is (mostly) JARVIS's own voice bleeding back in. */
  private isEcho(transcript: string): boolean {
    if (Date.now() > this.echoUntil || !this.echoText) return false
    const t = normalize(transcript)
    if (!t) return true
    if (this.echoText.includes(t)) return true
    const words = t.split(' ')
    const hits = words.filter(w => w.length > 2 && this.echoText.includes(w)).length
    return words.length >= 3 && hits / words.length >= 0.7
  }

  /** Fully pause recognition (tab hidden). */
  mute(): void {
    this.muted = true
    this.clearTimers()
    try { this.recognition?.abort() } catch { /* noop */ }
  }

  unmute(): void {
    if (!this.muted) return
    this.muted = false
    this.backoffMs = 300
    if (!this.enabled) return
    setTimeout(() => { if (this.enabled && !this.muted) this.spinUp() }, 250)
  }

  /** Switch to command mode (after wake, or when the app opens the mic directly). */
  enterCommandMode(opts?: { initialSilenceTimeoutMs?: number; silenceMs?: number }): void {
    this.mode = 'command'
    this.commandBuffer = ''
    this.pendingAlternatives = []
    this.lastResultAt = 0
    this.silenceMs = opts?.silenceMs ?? 900
    this.clearTimers()
    // Every command window gets a deadline — JARVIS must never get stuck listening.
    this.armDeadline(opts?.initialSilenceTimeoutMs ?? 12000)
    if (this.enabled && !this.muted && !this.recognition) this.spinUp()
  }

  /**
   * Hard timeout for a command window. Noise and interim results do NOT cancel
   * it — it only extends while there is genuinely recent speech, and clears
   * when a real utterance is dispatched.
   */
  private armDeadline(ms: number): void {
    if (this.initialSilenceTimer) clearTimeout(this.initialSilenceTimer)
    this.initialSilenceTimer = setTimeout(() => {
      const speakingRecently = Date.now() - this.lastResultAt < 2000
      if (this.commandBuffer.trim() || speakingRecently) {
        // User is mid-answer — give them a short extension rather than cutting off
        this.armDeadline(3000)
        return
      }
      this.initialSilenceTimer = null
      this.mode = 'wake'
      this.commandBuffer = ''
      this.cb.onTimeout()
    }, ms)
  }

  enterWakeMode(): void {
    this.mode = 'wake'
    this.commandBuffer = ''
    this.pendingAlternatives = []
    this.clearTimers()
  }

  /** Re-arm the command deadline (e.g. after TTS finished speaking a prompt). */
  refreshDeadline(ms = 12000): void {
    if (this.mode === 'command') this.armDeadline(ms)
  }

  // ─── Internals ─────────────────────────────────────────────────────────────

  private spinUp(): void {
    if (this.recognition || this.starting) return
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SR) return

    const rec = new SR()
    rec.continuous = true
    rec.interimResults = true
    rec.lang = 'en-US'
    rec.maxAlternatives = 3 // extra hypotheses help fuzzy name matching

    rec.onresult = (event: any) => {
      // A healthy session that's producing results — reset the failure backoff
      this.backoffMs = 300
      let interim = ''
      let finals = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const r = event.results[i]
        if (r.isFinal) {
          finals += r[0].transcript + ' '
          // Collect the recognizer's other hypotheses for this chunk
          for (let a = 1; a < Math.min(r.length, 3); a++) {
            const alt = r[a]?.transcript?.trim()
            if (alt) this.pendingAlternatives.push(alt)
          }
        } else interim += r[0].transcript + ' '
      }
      const combined = (finals + interim).trim()

      // "Power down" / "power off" reacts IMMEDIATELY in every mode — even
      // mid-speech, even mid-wizard. Guarded against JARVIS's own voice.
      if (POWER_RE.test(combined) && !POWER_RE.test(this.echoText)) {
        this.clearTimers()
        this.mode = 'wake'
        this.commandBuffer = ''
        this.echoText = ''
        this.echoUntil = 0
        this.cb.onPowerDown()
        return
      }

      if (this.mode === 'speaking') {
        // React only to a wake-word barge-in; ignore all else (incl. our own
        // voice). Bare "JARVIS" barges unless JARVIS's own speech contains the
        // word — then the full "hey jarvis" is required so it can't
        // interrupt itself.
        if (Date.now() - this.speakingSince < 400) return
        const bargeRe = this.echoText.includes('jarvis') ? BARGE_RE : WAKE_RE
        const bm = bargeRe.exec(combined)
        if (bm) {
          const now = Date.now()
          if (now - this.lastWakeAt < 1500) return
          this.lastWakeAt = now
          const trailing = combined.slice((bm.index ?? 0) + bm[0].length).replace(/^[,.\s]+/, '').trim()
          this.mode = 'command'
          this.commandBuffer = ''
          this.armDeadline(12000)
          this.cb.onBargeIn(trailing)
          if (trailing) { this.commandBuffer = trailing; this.bumpSilenceTimer() }
        }
        return
      }

      if (this.mode === 'wake') {
        if (this.isEcho(combined)) return
        this.handleWakeScan(combined)
      } else {
        if (combined) this.lastResultAt = Date.now()
        let f = finals.trim()
        // Drop finals that are just JARVIS's own voice arriving late
        if (f && this.isEcho(f)) f = ''
        if (f) {
          // The final transcript of a "Hey JARVIS, <command>" breath re-includes
          // the wake phrase the interim already triggered on — strip it and
          // replace the interim-derived buffer instead of appending a duplicate.
          const wm = WAKE_RE.exec(f)
          if (wm && Date.now() - this.lastWakeAt < 4000) {
            f = f.slice((wm.index ?? 0) + wm[0].length).replace(/^[,.\s]+/, '').trim()
            this.commandBuffer = f
          } else {
            this.commandBuffer = (this.commandBuffer + ' ' + f).trim()
          }
        }
        const preview = (this.commandBuffer + ' ' + interim).trim()
        if (preview && !this.isEcho(preview)) this.cb.onInterim(preview)
        this.bumpSilenceTimer()
      }
    }

    rec.onerror = (event: any) => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        // Site permission denied, OR Chrome lacks OS-level mic permission
        // (macOS System Settings › Privacy › Microphone › Chrome).
        this.enabled = false
        this.recognition = null
        this.cb.onPermissionDenied()
        this.cb.onStateChange(false)
      } else if (event.error === 'audio-capture') {
        // No mic found, or another app/tab is holding it exclusively.
        this.enabled = false
        this.recognition = null
        this.cb.onPermissionDenied()
        this.cb.onStateChange(false)
      }
      // 'no-speech' / 'aborted' / 'network' → onend fires next; auto-restart handles it
    }

    rec.onend = () => {
      this.recognition = null
      this.starting = false
      if (this.enabled && !this.muted) {
        // If the session died almost immediately it's failing (mic contention,
        // audio-capture errors, Chrome throttling). Back off progressively so we
        // don't thrash the mic at 5x/second; a healthy session resets this.
        const uptime = Date.now() - this.startedAt
        if (uptime < 1000) this.backoffMs = Math.min(this.backoffMs * 2, 5000)
        else this.backoffMs = 300
        if (this.restartTimer) clearTimeout(this.restartTimer)
        this.restartTimer = setTimeout(() => {
          if (this.enabled && !this.muted) this.spinUp()
        }, this.backoffMs)
      } else {
        this.cb.onStateChange(false)
      }
    }

    this.starting = true
    try {
      rec.start()
      this.recognition = rec
      this.starting = false
      this.startedAt = Date.now()
      this.cb.onStateChange(true)
    } catch {
      // start() throws if called while already started — retry shortly
      this.starting = false
      if (this.restartTimer) clearTimeout(this.restartTimer)
      this.restartTimer = setTimeout(() => { if (this.enabled && !this.muted) this.spinUp() }, 500)
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
    this.lastResultAt = Date.now()
    this.armDeadline(12000)
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
      const alternatives = this.pendingAlternatives.slice(0, 4)
      this.commandBuffer = ''
      this.pendingAlternatives = []
      if (utterance && !this.isEcho(utterance)) {
        // Real utterance dispatched — the deadline has served its purpose
        if (this.initialSilenceTimer) { clearTimeout(this.initialSilenceTimer); this.initialSilenceTimer = null }
        this.cb.onUtterance(utterance, alternatives)
      }
    }, this.silenceMs)
  }

  private clearTimers(): void {
    if (this.silenceTimer) { clearTimeout(this.silenceTimer); this.silenceTimer = null }
    if (this.initialSilenceTimer) { clearTimeout(this.initialSilenceTimer); this.initialSilenceTimer = null }
  }
}
