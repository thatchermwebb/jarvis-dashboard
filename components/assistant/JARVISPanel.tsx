'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, X, Mic, MicOff, PhoneCall } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useJarvis } from './JarvisProvider'
import { ArcReactorOrb } from './ArcReactorOrb'
import { LiveDraftForm } from './LiveDraftForm'

const PRESET_PROMPTS = [
  'How many follow-ups do I have today?',
  'Who needs Thatcher today?',
  'Who has a trial ending soon?',
  'Who should I prioritize calling first?',
]

const STATUS_LABEL: Record<string, string> = {
  off: 'Voice off',
  wake: "Say 'JARVIS'",
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
}

const PANEL_W = 352

interface Props {
  open: boolean
  onClose: () => void
  clientName?: string
  /** Orb position — the popup anchors itself next to it */
  anchor?: { x: number; y: number; size: number }
}

export function JARVISPanel({ open, onClose, clientName, anchor }: Props) {
  const {
    supported, status, voiceEnabled, permissionDenied,
    messages, clearMessages, interim, busy, wizard,
    enableVoice, disableVoice, sendText, startLogWizard,
  } = useJarvis()

  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open && clientName && messages.length === 0) {
      setInput(`What should I say to ${clientName}?`)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, clientName])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, interim, wizard])

  if (!open) return null

  function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || busy) return
    setInput('')
    sendText(msg)
  }

  // ── Anchor-aware placement: open beside the orb, never off-screen ─────────
  const style: React.CSSProperties = { width: PANEL_W }
  if (anchor && typeof window !== 'undefined') {
    const orbOnRight = anchor.x + anchor.size / 2 > window.innerWidth / 2
    const orbOnBottom = anchor.y + anchor.size / 2 > window.innerHeight / 2
    if (orbOnRight) style.right = Math.max(8, window.innerWidth - anchor.x - anchor.size)
    else style.left = Math.max(8, anchor.x)
    if (orbOnBottom) style.bottom = Math.max(8, window.innerHeight - anchor.y + 10)
    else style.top = anchor.y + anchor.size + 10
  } else {
    style.right = 20
    style.bottom = 88
  }

  return (
    <div
      className="fixed z-50 jarvis-hud flex flex-col overflow-hidden"
      style={{ ...style, maxHeight: 'min(560px, 72vh)' }}
    >
      <div className="jarvis-hud-sweep" />
      {/* Header */}
      <div className="flex items-center gap-2.5 px-4 pt-3 pb-2 flex-shrink-0">
        <ArcReactorOrb status={status} size={26} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold tracking-[0.3em] text-[#9be5ff]">JARVIS</div>
        </div>
        {supported && (
          <button
            onClick={() => voiceEnabled ? disableVoice() : enableVoice()}
            title={voiceEnabled ? 'Turn voice off' : 'Turn voice on'}
            className={cn(
              'p-1.5 rounded-lg border transition-colors',
              voiceEnabled
                ? 'text-[#22ccff] border-[#22ccff]/40 bg-[#22ccff]/10 hover:bg-[#22ccff]/20'
                : 'text-muted-foreground border-border hover:text-foreground',
            )}
          >
            {voiceEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
          </button>
        )}
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg border border-transparent text-muted-foreground hover:text-foreground hover:border-border transition-colors"
          title="Close"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Status readout strip */}
      <div className="flex items-center gap-3 px-4 py-1.5 border-y border-[#22ccff]/12 flex-shrink-0 text-[9px] tracking-[0.22em] text-[#22ccff]/55 uppercase">
        <span className="flex items-center gap-1.5"><span className="jarvis-dot" /> SYS.ONLINE</span>
        <span>MIC.{permissionDenied ? 'BLOCKED' : voiceEnabled ? 'HOT' : 'COLD'}</span>
        <span className="ml-auto text-[#22ccff]/80">
          {permissionDenied ? 'CHECK BROWSER' : (STATUS_LABEL[status] ?? status).toUpperCase()}
        </span>
      </div>

      {/* Live wizard draft (mirror of what JARVIS is typing on screen) */}
      {wizard && wizard.step !== 'done' && (
        <div className="px-4 pt-3 flex-shrink-0">
          <LiveDraftForm draft={wizard.draft} step={wizard.step} />
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5 min-h-[120px]">
        {messages.length === 0 && !wizard && (
          <div className="space-y-2.5">
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {supported
                ? voiceEnabled
                  ? 'Say "JARVIS" anytime. "Power down" shuts me off.'
                  : 'Turn on the mic to talk, or type below.'
                : 'Type below — voice requires Chrome.'}
            </p>
            <button
              onClick={() => startLogWizard()}
              className="w-full flex items-center gap-2 text-left text-xs px-3 py-2 rounded-md bg-[#22ccff]/10 hover:bg-[#22ccff]/20 text-[#9be5ff] transition-colors border border-[#22ccff]/25 font-medium"
            >
              <PhoneCall className="w-3.5 h-3.5" /> Log a call
            </button>
            <div className="space-y-1">
              {PRESET_PROMPTS.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="w-full text-left text-[11px] px-3 py-1.5 rounded-md bg-secondary/40 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors border border-border/50"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}>
            <div className={cn(
              'max-w-[88%] rounded-md px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap',
              m.role === 'user'
                ? 'bg-[#22ccff]/15 text-[#c9f0ff] border border-[#22ccff]/20'
                : 'bg-secondary/60 text-foreground',
            )}>
              {m.content || <span className="text-muted-foreground animate-pulse">Thinking...</span>}
            </div>
          </div>
        ))}

        {/* Live interim transcript while speaking to JARVIS */}
        {interim && (
          <div className="flex justify-end">
            <div className="max-w-[88%] rounded-md px-3 py-2 text-xs bg-[#22ccff]/25 text-[#c9f0ff]/80 italic">
              {interim}
            </div>
          </div>
        )}

        {busy && status === 'thinking' && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex justify-start">
            <div className="rounded-md px-3 py-2 text-xs bg-secondary/60 text-muted-foreground animate-pulse">
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2.5 border-t border-[#22ccff]/15 flex-shrink-0">
        {messages.length > 0 && (
          <button
            onClick={clearMessages}
            className="text-[10px] text-muted-foreground hover:text-foreground mb-1.5 flex items-center gap-1"
          >
            <X className="w-2.5 h-2.5" /> Clear
          </button>
        )}
        <div className="flex items-center gap-1.5">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                send()
              }
            }}
            placeholder={wizard ? 'Type your answer…' : 'Ask JARVIS…'}
            className="bg-secondary/50 border-border text-xs h-8"
            disabled={busy}
          />
          <Button size="icon" onClick={() => send()} disabled={!input.trim() || busy} className="flex-shrink-0 h-8 w-8">
            <Send className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  )
}
