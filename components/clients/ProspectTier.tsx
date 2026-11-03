'use client'

import { useState, useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export const PROSPECT_TIERS = [
  {
    value: 1, label: 'Tier 1', chip: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40', dot: 'bg-emerald-400', color: 'text-emerald-300',
    desc: 'Knows they need help and is confident we’re the solution and the ones to help them. Done their research — ready to go.',
  },
  {
    value: 2, label: 'Tier 2', chip: 'bg-amber-500/15 text-amber-300 border-amber-500/40', dot: 'bg-amber-400', color: 'text-amber-300',
    desc: 'Knows they have a problem with the marketing system in their business, but isn’t 100% clear we’re the solution. Not super bought-in or excited about the program.',
  },
  {
    value: 3, label: 'Tier 3', chip: 'bg-rose-500/15 text-rose-300 border-rose-500/40', dot: 'bg-rose-400', color: 'text-rose-300',
    desc: 'All over the place — may be new detailers. Not very sure how all of this works or how the business works as a whole; a lot of uncertainty around the process.',
  },
]

function Cheatsheet() {
  return (
    <div className="rounded-lg bg-popover border border-border shadow-2xl px-3 py-2.5 text-[11px] leading-snug w-72 space-y-2">
      {PROSPECT_TIERS.map(t => (
        <div key={t.value}>
          <span className={cn('font-semibold', t.color)}>{t.label}:</span>{' '}
          <span className="text-foreground/80">{t.desc}</span>
        </div>
      ))}
    </div>
  )
}

export function ProspectTier({ tier, onChange, readOnly, prospect }: {
  tier?: number | null
  onChange: (t: number | null) => void
  readOnly?: boolean
  /** Prospect-phase clients (onboarding/trial) show it open; others start tucked. */
  prospect: boolean
}) {
  const [open, setOpen] = useState(false)
  const [expanded, setExpanded] = useState(prospect)
  const ref = useRef<HTMLDivElement>(null)
  const current = PROSPECT_TIERS.find(t => t.value === tier)

  useEffect(() => {
    if (!open) return
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  // Active (non-prospect) clients: hide behind a small disclosure until expanded.
  if (!prospect && !expanded) {
    return (
      <button
        onClick={() => setExpanded(true)}
        className="inline-flex items-center gap-1 text-[10px] font-medium text-muted-foreground/50 hover:text-muted-foreground uppercase tracking-widest transition-colors"
      >
        <ChevronDown className="w-3 h-3" />
        Prospect Tier{current ? <span className={cn('normal-case tracking-normal font-semibold ml-0.5', current.color)}>· {current.label}</span> : ''}
      </button>
    )
  }

  return (
    <div ref={ref}>
      {/* Label — hover shows the cheatsheet */}
      <div className="relative group inline-block mb-1">
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest border-b border-dotted border-muted-foreground/40 cursor-help">Prospect Tier</span>
        <div className="pointer-events-none absolute left-0 top-full mt-1.5 z-50 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150">
          <Cheatsheet />
        </div>
      </div>

      <div className="relative">
        {/* Selected pill — hover also shows the cheatsheet */}
        <div className="relative group inline-block">
          <button
            onClick={() => { if (!readOnly) setOpen(o => !o) }}
            disabled={readOnly}
            className={cn(
              'inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border transition-all',
              current ? current.chip : 'bg-secondary/30 text-muted-foreground border-dashed border-border/60 hover:text-foreground',
              readOnly && 'cursor-default',
            )}
          >
            {current && <span className={cn('w-2 h-2 rounded-full', current.dot)} />}
            {current ? current.label : 'Set tier'}
            {!readOnly && <ChevronDown className={cn('w-3 h-3 transition-transform', open && 'rotate-180')} />}
          </button>
          {current && !open && (
            <div className="pointer-events-none absolute left-0 top-full mt-1.5 z-50 opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150">
              <Cheatsheet />
            </div>
          )}
        </div>

        {/* Dropdown — descriptions shown inline while selecting */}
        {open && (
          <div className="absolute top-full left-0 mt-1.5 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden w-80 p-1.5">
            {PROSPECT_TIERS.map(t => (
              <button
                key={t.value}
                onClick={() => { onChange(t.value); setOpen(false) }}
                className={cn(
                  'w-full flex items-start gap-2.5 px-2.5 py-2 text-left rounded-lg transition-colors',
                  t.value === tier ? 'bg-secondary/50' : 'hover:bg-secondary/40',
                )}
              >
                <span className={cn('w-2 h-2 rounded-full flex-shrink-0 mt-1.5', t.dot)} />
                <span className="min-w-0">
                  <span className={cn('text-sm font-semibold', t.color)}>{t.label}</span>
                  <span className="block text-[11px] text-muted-foreground leading-snug">{t.desc}</span>
                </span>
              </button>
            ))}
            {tier != null && (
              <button
                onClick={() => { onChange(null); setOpen(false) }}
                className="w-full text-left text-[11px] text-muted-foreground/60 hover:text-red-400 px-2.5 py-1.5 mt-0.5 transition-colors"
              >
                Clear tier
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
