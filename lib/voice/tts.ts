// JARVIS voice output. Prefers ElevenLabs (via /api/jarvis/tts) for the
// cinematic British voice; falls back to the browser's speechSynthesis
// en-GB voice when ElevenLabs is not configured or errors.

let cachedVoice: SpeechSynthesisVoice | null = null
let voicesLoaded = false

// null = untested, true/false = known state (503 marks it unavailable for the session)
let elevenAvailable: boolean | null = null
let currentAudio: HTMLAudioElement | null = null

function rankVoice(v: SpeechSynthesisVoice): number {
  const name = v.name.toLowerCase()
  const isGB = v.lang.startsWith('en-GB') || v.lang.startsWith('en_GB')
  if (!isGB) return 0
  if (name.includes('daniel')) return 5            // macOS Daniel — the classic
  if (name.includes('google uk english male')) return 4
  if (name.includes('male')) return 3
  if (name.includes('google uk')) return 2
  return 1
}

export function pickBritishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !window.speechSynthesis) return null
  if (cachedVoice) return cachedVoice
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const best = [...voices].sort((a, b) => rankVoice(b) - rankVoice(a))[0]
  cachedVoice = rankVoice(best) > 0 ? best : (voices.find(v => v.lang.startsWith('en')) ?? voices[0])
  return cachedVoice
}

/** Warm the voice cache (Chrome returns [] until voiceschanged fires). */
export function initVoices(): void {
  if (typeof window === 'undefined' || !window.speechSynthesis) return
  if (voicesLoaded) return
  pickBritishVoice()
  window.speechSynthesis.addEventListener('voiceschanged', () => {
    cachedVoice = null
    pickBritishVoice()
    voicesLoaded = true
  }, { once: true })
}

export function ttsSupported(): boolean {
  return typeof window !== 'undefined' && ('speechSynthesis' in window || elevenAvailable !== false)
}

// ─── ElevenLabs playback ─────────────────────────────────────────────────────

async function speakEleven(text: string): Promise<boolean> {
  if (elevenAvailable === false) return false
  try {
    const res = await fetch('/api/jarvis/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    })
    if (res.status === 503) { elevenAvailable = false; return false } // not configured
    if (!res.ok) return false // transient failure — fall back this once, try again next time
    const blob = await res.blob()
    elevenAvailable = true

    await new Promise<void>((resolve) => {
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      currentAudio = audio
      let done = false
      const finish = () => {
        if (done) return
        done = true
        URL.revokeObjectURL(url)
        if (currentAudio === audio) currentAudio = null
        resolve()
      }
      audio.onended = finish
      audio.onerror = finish
      // Safety net in case ended never fires
      audio.onloadedmetadata = () => {
        const ms = isFinite(audio.duration) ? audio.duration * 1000 + 2000 : 30000
        setTimeout(finish, ms)
      }
      audio.play().catch(finish)
    })
    return true
  } catch {
    return false
  }
}

// ─── Browser fallback ────────────────────────────────────────────────────────

function speakBrowser(text: string): Promise<void> {
  return new Promise(resolve => {
    if (!('speechSynthesis' in window)) { resolve(); return }
    window.speechSynthesis.cancel()

    const u = new SpeechSynthesisUtterance(text)
    const voice = pickBritishVoice()
    if (voice) u.voice = voice
    u.rate = 1.12
    u.pitch = 1.0

    let done = false
    const finish = () => {
      if (done) return
      done = true
      resolve()
    }
    u.onend = finish
    u.onerror = finish
    const est = Math.max(2000, text.length * 90)
    setTimeout(finish, est + 3000)

    window.speechSynthesis.speak(u)
  })
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Speak text with the JARVIS voice (ElevenLabs first, browser fallback).
 * Cancels anything already playing. Resolves when the utterance finishes.
 */
export async function speak(
  text: string,
  opts?: { onStart?: () => void; onEnd?: () => void },
): Promise<void> {
  if (typeof window === 'undefined' || !text.trim()) { opts?.onEnd?.(); return }
  stopSpeaking()
  opts?.onStart?.()
  try {
    const ok = await speakEleven(text)
    if (!ok) await speakBrowser(text)
  } finally {
    opts?.onEnd?.()
  }
}

export function stopSpeaking(): void {
  if (typeof window === 'undefined') return
  if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  if (currentAudio) {
    currentAudio.pause()
    currentAudio.src = ''
    currentAudio = null
  }
}
