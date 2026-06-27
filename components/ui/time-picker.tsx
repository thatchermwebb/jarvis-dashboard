'use client'

import { useState, useRef, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

const HOURS   = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, '0'))
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))

interface Props {
  value: string       // "HH:MM" 24h, or ''
  onChange: (v: string) => void
  placeholder?: string
}

function parse(value: string) {
  if (!value) return { h: '', m: '', ampm: 'AM' as 'AM' | 'PM' }
  const [hRaw, mRaw] = value.split(':').map(Number)
  const ampm = hRaw >= 12 ? 'PM' : 'AM'
  return {
    h:    String(hRaw % 12 || 12).padStart(2, '0'),
    m:    String(mRaw).padStart(2, '0'),
    ampm: ampm as 'AM' | 'PM',
  }
}

function to24(h: string, m: string, ampm: string): string {
  const hNum = parseInt(h) || 12
  const h24  = ampm === 'PM' ? (hNum === 12 ? 12 : hNum + 12) : (hNum === 12 ? 0 : hNum)
  return `${String(h24).padStart(2, '0')}:${m.padStart(2, '0')}`
}

export function TimePicker({ value, onChange, placeholder = 'Set time...' }: Props) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const hourRef   = useRef<HTMLDivElement>(null)
  const minuteRef = useRef<HTMLDivElement>(null)

  const { h, m, ampm } = parse(value)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  // Scroll selected item into view when opened
  useEffect(() => {
    if (!open) return
    const scrollTo = (el: HTMLDivElement | null, value: string, items: string[]) => {
      if (!el) return
      const idx = items.indexOf(value)
      if (idx >= 0) el.scrollTop = idx * 36
    }
    setTimeout(() => {
      scrollTo(hourRef.current, h || '12', HOURS)
      scrollTo(minuteRef.current, m || '00', MINUTES)
    }, 30)
  }, [open, h, m])

  function pickH(hh: string) {
    onChange(to24(hh, m || '00', ampm))
  }
  function pickM(mm: string) {
    onChange(to24(h || '12', mm, ampm))
  }
  function pickAmpm(ap: 'AM' | 'PM') {
    onChange(to24(h || '12', m || '00', ap))
  }

  const display = value
    ? `${h}:${m} ${ampm}`
    : placeholder

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className={cn(
          'w-full h-10 px-3 flex items-center gap-2.5 bg-secondary/50 border border-input rounded-xl text-sm transition-colors hover:border-border',
          open && 'border-primary/50'
        )}
      >
        <Clock className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <span className={value ? 'text-foreground' : 'text-muted-foreground/60'}>{display}</span>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 bg-card border border-border rounded-xl shadow-2xl overflow-hidden" style={{ width: 230 }}>
          {/* Current selection header */}
          <div className="flex items-center justify-center gap-2 px-4 py-3 bg-secondary/40 border-b border-border/40">
            <span className={cn(
              'min-w-[2.5rem] text-center font-bold text-sm px-2.5 py-1.5 rounded-lg border transition-colors',
              h ? 'bg-primary/15 text-primary border-primary/30' : 'bg-secondary/60 text-muted-foreground border-border/40'
            )}>{h || '--'}</span>
            <span className="text-muted-foreground font-bold text-lg">:</span>
            <span className={cn(
              'min-w-[2.5rem] text-center font-bold text-sm px-2.5 py-1.5 rounded-lg border transition-colors',
              m ? 'bg-primary/15 text-primary border-primary/30' : 'bg-secondary/60 text-muted-foreground border-border/40'
            )}>{m || '--'}</span>
            <span className={cn(
              'font-bold text-sm px-2.5 py-1.5 rounded-lg border transition-colors',
              value ? 'bg-primary/15 text-primary border-primary/30' : 'bg-secondary/60 text-muted-foreground border-border/40'
            )}>{ampm}</span>
          </div>

          {/* Scrollable columns */}
          <div className="flex h-52">
            {/* Hours */}
            <div ref={hourRef} className="flex-1 overflow-y-auto border-r border-border/20 py-1 scroll-smooth">
              {HOURS.map(hh => (
                <button
                  key={hh}
                  type="button"
                  onClick={() => pickH(hh)}
                  className={cn(
                    'w-full h-9 flex items-center justify-center text-sm transition-colors',
                    h === hh
                      ? 'text-primary font-semibold bg-primary/10'
                      : 'text-foreground/60 hover:text-foreground hover:bg-secondary/50'
                  )}
                >
                  {hh}
                </button>
              ))}
            </div>

            {/* Minutes */}
            <div ref={minuteRef} className="flex-1 overflow-y-auto border-r border-border/20 py-1 scroll-smooth">
              {MINUTES.map(mm => (
                <button
                  key={mm}
                  type="button"
                  onClick={() => pickM(mm)}
                  className={cn(
                    'w-full h-9 flex items-center justify-center text-sm transition-colors',
                    m === mm
                      ? 'text-primary font-semibold bg-primary/10'
                      : 'text-foreground/60 hover:text-foreground hover:bg-secondary/50'
                  )}
                >
                  {mm}
                </button>
              ))}
            </div>

            {/* AM / PM */}
            <div className="flex-1 flex flex-col py-1">
              {(['AM', 'PM'] as const).map(ap => (
                <button
                  key={ap}
                  type="button"
                  onClick={() => pickAmpm(ap)}
                  className={cn(
                    'flex-1 flex items-center justify-center text-sm font-medium transition-colors',
                    ampm === ap && value
                      ? 'text-primary bg-primary/10'
                      : 'text-foreground/60 hover:text-foreground hover:bg-secondary/50'
                  )}
                >
                  {ap}
                </button>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-border/40 px-4 py-2.5 flex justify-between items-center bg-secondary/20">
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false) }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
