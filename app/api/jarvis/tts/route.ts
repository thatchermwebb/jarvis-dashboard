import { NextRequest, NextResponse } from 'next/server'

// ElevenLabs TTS proxy for JARVIS. Returns 503 when no key is configured —
// the client then falls back to browser speechSynthesis.
// Voice: "Daniel" (deep British male) unless overridden via ELEVENLABS_VOICE_ID.

const DEFAULT_VOICE_ID = 'onwK4e9ZLuTAKqWW03F9' // Daniel — British, authoritative

export async function POST(req: NextRequest) {
  const apiKey = process.env.ELEVENLABS_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ElevenLabs not configured' }, { status: 503 })
  }

  const { text } = await req.json()
  if (!text || typeof text !== 'string') {
    return NextResponse.json({ error: 'text required' }, { status: 400 })
  }

  const voiceId = process.env.ELEVENLABS_VOICE_ID || DEFAULT_VOICE_ID

  try {
    // /stream + optimize_streaming_latency gives the lowest time-to-first-byte;
    // mp3_22050_32 is a smaller payload that transfers faster than 44.1k.
    const res = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream?output_format=mp3_22050_32&optimize_streaming_latency=3`,
      {
        method: 'POST',
        headers: { 'xi-api-key': apiKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text,
          // Flash: ~75ms model latency and half the credit cost of multilingual
          model_id: 'eleven_flash_v2_5',
          // speed 1.2 is ElevenLabs' max — ~20% quicker delivery
          voice_settings: { stability: 0.4, similarity_boost: 0.75, speed: 1.2 },
        }),
      },
    )

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[jarvis/tts] ElevenLabs error', res.status, detail.slice(0, 200))
      return NextResponse.json({ error: 'TTS failed' }, { status: 502 })
    }

    return new NextResponse(res.body, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[jarvis/tts]', err)
    return NextResponse.json({ error: 'TTS failed' }, { status: 502 })
  }
}
