'use client'

import { useEffect, useState } from 'react'
import type { KpiZone } from '@/lib/team'

const ZONE_COLOR: Record<KpiZone, string> = {
  green: '#10b981',
  yellow: '#eab308',
  red: '#ef4444',
  neutral: '#64748b',
}
const ZONE_LABEL: Record<KpiZone, string> = {
  green: 'BONUS ELIGIBLE',
  yellow: 'ALMOST THERE',
  red: 'BELOW TARGET',
  neutral: 'NO DATA YET',
}

// A 270° gauge. Needle animates to the KPI %; the 90° bonus mark is drawn on
// the arc. Color reflects the zone (green ≥90, yellow 80-89, red <80).
export function Tachometer({ pct, zone, hits, total }: {
  pct: number | null
  zone: KpiZone
  hits: number
  total: number
}) {
  const target = pct ?? 0
  const [display, setDisplay] = useState(0)

  // Ease the needle toward the target
  useEffect(() => {
    let raf = 0
    const start = performance.now()
    const from = display
    const dur = 700
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / dur)
      const eased = 1 - Math.pow(1 - k, 3)
      setDisplay(from + (target - from) * eased)
      if (k < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  const color = ZONE_COLOR[zone]
  const START = 135 // degrees (SVG), sweeps 270° clockwise to 405 (=45)
  const SWEEP = 270
  const cx = 100, cy = 100, r = 78

  const polar = (deg: number, radius = r) => {
    const rad = (deg * Math.PI) / 180
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) }
  }
  const arcPath = (fromPct: number, toPct: number, radius = r) => {
    const a0 = START + (SWEEP * fromPct) / 100
    const a1 = START + (SWEEP * toPct) / 100
    const p0 = polar(a0, radius), p1 = polar(a1, radius)
    const large = a1 - a0 > 180 ? 1 : 0
    return `M ${p0.x} ${p0.y} A ${radius} ${radius} 0 ${large} 1 ${p1.x} ${p1.y}`
  }

  const needleAngle = START + (SWEEP * Math.min(100, Math.max(0, display))) / 100
  const needle = polar(needleAngle, r - 14)
  const bonusMark0 = polar(START + (SWEEP * 90) / 100, r + 3)
  const bonusMark1 = polar(START + (SWEEP * 90) / 100, r - 12)

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 175" className="w-full max-w-[240px]">
        {/* Track */}
        <path d={arcPath(0, 100)} fill="none" stroke="rgba(148,163,184,0.15)" strokeWidth="12" strokeLinecap="round" />
        {/* Value arc */}
        {display > 0 && (
          <path d={arcPath(0, Math.min(100, display))} fill="none" stroke={color} strokeWidth="12" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${color}88)`, transition: 'stroke 0.4s' }} />
        )}
        {/* 90% bonus threshold mark */}
        <line x1={bonusMark0.x} y1={bonusMark0.y} x2={bonusMark1.x} y2={bonusMark1.y}
          stroke="#10b981" strokeWidth="2.5" strokeLinecap="round" />
        {/* Needle */}
        <line x1={cx} y1={cy} x2={needle.x} y2={needle.y} stroke={color} strokeWidth="3.5" strokeLinecap="round"
          style={{ transition: 'stroke 0.4s' }} />
        <circle cx={cx} cy={cy} r="7" fill={color} style={{ transition: 'fill 0.4s' }} />
        <circle cx={cx} cy={cy} r="3" fill="#0a0a0f" />
        {/* Value */}
        <text x={cx} y={cy + 40} textAnchor="middle" className="fill-foreground" style={{ fontSize: 30, fontWeight: 800 }}>
          {pct == null ? '—' : `${Math.round(display)}%`}
        </text>
      </svg>
      <div className="text-center -mt-1">
        <div className="text-[11px] font-bold tracking-widest uppercase" style={{ color }}>{ZONE_LABEL[zone]}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">
          {total > 0 ? `${hits} of ${total} standard tasks on time` : 'Complete standard tasks to fill the gauge'}
        </div>
      </div>
    </div>
  )
}
