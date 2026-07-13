'use client'

import { useEffect, useRef, useState } from 'react'

// Animated count-up bank total. Ticks from the previous value to the new one
// whenever `amount` changes — satisfying to watch it climb.
export function BankMeter({ amount, rate, hours }: { amount: number; rate: number; hours: number }) {
  const [display, setDisplay] = useState(amount)
  const prev = useRef(amount)

  useEffect(() => {
    const from = prev.current
    const to = amount
    prev.current = amount
    if (from === to) { setDisplay(to); return }
    let raf = 0
    const start = performance.now()
    const dur = 800
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - k, 3)
      setDisplay(from + (to - from) * eased)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [amount])

  return (
    <div className="relative overflow-hidden rounded-2xl border border-emerald-500/25 bg-gradient-to-br from-emerald-500/10 to-emerald-500/[0.02] px-5 py-4">
      <div className="text-[10px] font-bold uppercase tracking-widest text-emerald-400/70">Unpaid Bank</div>
      <div className="mt-1 text-4xl font-black tabular-nums text-emerald-300"
        style={{ textShadow: '0 0 18px rgba(16,185,129,0.35)' }}>
        ${display.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {hours.toFixed(2)} hrs · ${rate.toFixed(2)}/hr
      </div>
    </div>
  )
}
