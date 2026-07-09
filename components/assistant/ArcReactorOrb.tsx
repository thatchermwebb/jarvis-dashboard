'use client'

import { cn } from '@/lib/utils'

export type OrbStatus = 'off' | 'wake' | 'listening' | 'thinking' | 'speaking'

// Animated arc-reactor emblem. Styles live in globals.css (.jarvis-orb--*).
//   off       — dim, static
//   wake      — slow idle pulse (passively listening for the wake word)
//   listening — spokes spin, ring glows (actively capturing a command)
//   thinking  — dash shimmer
//   speaking  — staggered ripples
export function ArcReactorOrb({ status, size = 48, className }: {
  status: OrbStatus
  size?: number
  className?: string
}) {
  const active = status !== 'off'
  const spokes = Array.from({ length: 10 }, (_, i) => i * 36)

  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={cn('jarvis-orb', `jarvis-orb--${status}`, className)}
    >
      {/* Speaking ripples */}
      <circle className="orb-ripple orb-ripple-1" cx="24" cy="24" r="14" fill="none" strokeWidth="1.5" />
      <circle className="orb-ripple orb-ripple-2" cx="24" cy="24" r="14" fill="none" strokeWidth="1.5" />

      {/* Outer ring */}
      <circle
        className="orb-ring"
        cx="24" cy="24" r="20"
        fill="none"
        strokeWidth="1.5"
        strokeDasharray={status === 'thinking' ? '8 5' : undefined}
      />

      {/* Radial spokes */}
      <g className="orb-spokes">
        {spokes.map(deg => (
          <line
            key={deg}
            x1="24" y1="8.5" x2="24" y2="12.5"
            strokeWidth="1.6"
            strokeLinecap="round"
            transform={`rotate(${deg} 24 24)`}
          />
        ))}
      </g>

      {/* Mid ring */}
      <circle className="orb-mid" cx="24" cy="24" r="14" fill="none" strokeWidth="1" opacity="0.5" />

      {/* Core */}
      <circle className="orb-core" cx="24" cy="24" r={active ? 6.5 : 5.5} />
      <circle className="orb-core-glow" cx="24" cy="24" r="9" opacity="0.35" />
    </svg>
  )
}
