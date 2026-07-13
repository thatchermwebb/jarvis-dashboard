'use client'

import { useState, useRef, useEffect } from 'react'
import { Sparkles, Send, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const PRESETS = [
  'Average cash collected within 30 days of signing a client',
  'Project MRR 90 days out',
  'LTV leaderboard — top 10 clients',
  'How does this month compare to last month?',
]

interface QA { role: 'user' | 'assistant'; content: string }

// Minimal markdown: **bold**, ## headings, "- " bullets — matches what the
// analyst route's prompt allows.
function renderMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    const bolded = line.split(/(\*\*[^*]+\*\*)/g).map((seg, j) =>
      seg.startsWith('**') && seg.endsWith('**')
        ? <strong key={j} className="text-foreground font-semibold">{seg.slice(2, -2)}</strong>
        : seg
    )
    if (line.startsWith('## ')) {
      return <div key={i} className="text-sm font-semibold text-foreground mt-3 mb-1">{line.slice(3)}</div>
    }
    if (line.startsWith('- ')) {
      return <div key={i} className="pl-4 relative before:content-['·'] before:absolute before:left-1 before:text-muted-foreground">{bolded.map(b => typeof b === 'string' && b === line ? line.slice(2) : b)}</div>
    }
    return <div key={i} className={line.trim() === '' ? 'h-2' : undefined}>{bolded}</div>
  })
}

export function ReportsAnalyst() {
  const [messages, setMessages] = useState<QA[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, busy])

  async function ask(q?: string) {
    const question = (q ?? input).trim()
    if (!question || busy) return
    setInput('')
    setBusy(true)
    setMessages(prev => [...prev, { role: 'user', content: question }])
    try {
      const res = await fetch('/api/reports/analyst', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history: messages.slice(-6) }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: res.ok ? (data.reply ?? 'No analysis produced.') : 'The analyst hit a snag — try again.',
      }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'The analyst hit a snag — try again.' }])
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <div>
            <div className="text-sm font-semibold">Analyst</div>
            <div className="text-xs text-muted-foreground">Ask anything about the numbers — trends, LTV, cohorts, projections</div>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={() => setMessages([])}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {messages.length === 0 && (
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map(p => (
            <button
              key={p}
              onClick={() => ask(p)}
              disabled={busy}
              className="text-[11px] px-3 py-1.5 rounded-full border border-border/60 text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {(messages.length > 0 || busy) && (
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {messages.map((m, i) => (
            m.role === 'user' ? (
              <div key={i} className="flex justify-end">
                <div className="max-w-[85%] rounded-xl px-3.5 py-2 text-xs bg-primary/10 text-foreground border border-primary/20">
                  {m.content}
                </div>
              </div>
            ) : (
              <div key={i} className="text-xs text-muted-foreground leading-relaxed bg-secondary/30 rounded-xl px-4 py-3">
                {renderMarkdown(m.content)}
              </div>
            )
          ))}
          {busy && (
            <div className="text-xs text-muted-foreground bg-secondary/30 rounded-xl px-4 py-3 animate-pulse">
              Crunching the numbers…
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      )}

      <div className="flex items-center gap-2">
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask() } }}
          placeholder='e.g. "What&apos;s Kelly&apos;s LTV?" or "Which cohort churns fastest?"'
          className={cn('bg-secondary/40 border-border/50 text-xs h-9', busy && 'opacity-60')}
          disabled={busy}
        />
        <Button size="icon" className="h-9 w-9 flex-shrink-0" onClick={() => ask()} disabled={!input.trim() || busy}>
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  )
}
