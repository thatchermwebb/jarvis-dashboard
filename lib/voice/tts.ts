// British-voice TTS via the browser's speechSynthesis. No external API.

let cachedVoice: SpeechSynthesisVoice | null = null
let voicesLoaded = false

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
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

/**
 * Speak text with the British voice. Cancels anything already queued.
 * onStart/onEnd hooks let the caller mute/unmute recognition around speech.
 * Resolves when the utterance finishes (or errors/cancels).
 */
export function speak(
  text: string,
  opts?: { onStart?: () => void; onEnd?: () => void },
): Promise<void> {
  return new Promise(resolve => {
    if (!ttsSupported() || !text.trim()) { opts?.onEnd?.(); resolve(); return }

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
      opts?.onEnd?.()
      resolve()
    }

    u.onstart = () => opts?.onStart?.()
    u.onend = finish
    u.onerror = finish
    // Safety net: Chrome occasionally drops onend
    const est = Math.max(2000, text.length * 90)
    setTimeout(finish, est + 3000)

    window.speechSynthesis.speak(u)
  })
}

export function stopSpeaking(): void {
  if (ttsSupported()) window.speechSynthesis.cancel()
}
