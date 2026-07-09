'use client'

import { useState, useRef, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
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
  'Who am I overdue to follow up with?',
  'Which clients have payment issues?',
  'Who should I prioritize calling first?',
]

const STATUS_LABEL: Record<string, string> = {
  off: 'Voice off',
  wake: "Say 'Hey JARVIS'",
  listening: 'Listening…',
  thinking: 'Thinking…',
  speaking: 'Speaking…',
}

interface Props {
  open: boolean
  onClose: () => void
  clientName?: string
}

export function JARVISPanel({ open, onClose, clientName }: Props) {
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

  function send(text?: string) {
    const msg = (text ?? input).trim()
    if (!msg || busy) return
    setInput('')
    sendText(msg)
  }

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent
        side="right"
        className="w-[420px] sm:w-[480px] bg-card border-border flex flex-col p-0"
      >
        <SheetHeader className="px-5 py-4 border-b border-border flex-shrink-0">
          <SheetTitle className="flex items-center gap-3">
            <ArcReactorOrb status={status} size={30} />
            <div className="flex-1 min-w-0">
              <div>JARVIS</div>
              <div className="text-[10px] font-normal text-muted-foreground">
                {permissionDenied ? 'Microphone blocked — check browser settings' : STATUS_LABEL[status]}
              </div>
            </div>
            {supported && (
              <button
                onClick={() => voiceEnabled ? disableVoice() : enableVoice()}
                title={voiceEnabled ? 'Turn voice off' : 'Turn voice on'}
                className={cn(
                  'p-2 rounded-lg border transition-colors',
                  voiceEnabled
                    ? 'text-primary border-primary/40 bg-primary/10 hover:bg-primary/20'
                    : 'text-muted-foreground border-border hover:text-foreground hover:border-border/80',
                )}
              >
                {voiceEnabled ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
              </button>
            )}
          </SheetTitle>
        </SheetHeader>

        {/* Live wizard draft */}
        {wizard && wizard.step !== 'done' && (
          <div className="px-5 pt-4 flex-shrink-0">
            <LiveDraftForm draft={wizard.draft} step={wizard.step} />
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {messages.length === 0 && !wizard && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">
                {supported
                  ? voiceEnabled
                    ? 'Listening for "Hey JARVIS". Or type below — same brain.'
                    : 'Turn on the mic to talk, or type below. JARVIS can answer questions, log calls, and add tasks.'
                  : 'JARVIS can answer questions, log calls, and add tasks. (Voice requires Chrome.)'}
              </p>
              <button
                onClick={() => startLogWizard()}
                className="w-full flex items-center gap-2 text-left text-xs px-3 py-2.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary transition-colors border border-primary/30 font-medium"
              >
                <PhoneCall className="w-3.5 h-3.5" /> Log a call
              </button>
              <div className="space-y-1.5">
                {PRESET_PROMPTS.map((p) => (
                  <button
                    key={p}
                    onClick={() => send(p)}
                    className="w-full text-left text-xs px-3 py-2 rounded-md bg-secondary/50 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors border border-border"
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
                'max-w-[85%] rounded-xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap',
                m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary/70 text-foreground',
              )}>
                {m.content || <span className="text-muted-foreground animate-pulse">Thinking...</span>}
              </div>
            </div>
          ))}

          {/* Live interim transcript while speaking to JARVIS */}
          {interim && (
            <div className="flex justify-end">
              <div className="max-w-[85%] rounded-xl px-4 py-2.5 text-sm bg-primary/40 text-primary-foreground/80 italic">
                {interim}
              </div>
            </div>
          )}

          {busy && status === 'thinking' && messages[messages.length - 1]?.role === 'user' && (
            <div className="flex justify-start">
              <div className="rounded-xl px-4 py-2.5 text-sm bg-secondary/70 text-muted-foreground animate-pulse">
                Thinking...
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-5 py-4 border-t border-border flex-shrink-0">
          {messages.length > 0 && (
            <button
              onClick={clearMessages}
              className="text-xs text-muted-foreground hover:text-foreground mb-2 flex items-center gap-1"
            >
              <X className="w-3 h-3" /> Clear chat
            </button>
          )}
          <div className="flex items-center gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
              placeholder={wizard ? 'Type your answer…' : 'Ask JARVIS anything…'}
              className="bg-secondary/50 border-border text-sm"
              disabled={busy}
            />
            <Button size="icon" onClick={() => send()} disabled={!input.trim() || busy} className="flex-shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}
