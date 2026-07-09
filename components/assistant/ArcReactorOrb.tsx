'use client'

import { cn } from '@/lib/utils'

export type OrbStatus = 'off' | 'wake' | 'listening' | 'thinking' | 'speaking'

// Animated arc-reactor emblem. Status drives the animation:
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
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      <svg
        viewBox="0 0 48 48"
        width={size}
        height={size}
        className={cn('jarvis-orb', `jarvis-orb--${status}`)}
      >
        {/* Speaking ripples */}
        <circle className="orb-ripple orb-ripple-1" cx="24" cy="24" r="14" fill="none" strokeWidth="1.5" />
        <circle className="orb-ripple orb-ripple-2" cx="24" cy="24" r="14" fill="none" strokeWidth="1.5" />

        {/* Outer glow ring */}
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

        {/* Inner triangle hint (arc reactor mk II) */}
        <circle className="orb-mid" cx="24" cy="24" r="14" fill="none" strokeWidth="1" opacity="0.5" />

        {/* Core */}
        <circle className="orb-core" cx="24" cy="24" r={active ? 6.5 : 5.5} />
        <circle className="orb-core-glow" cx="24" cy="24" r="9" opacity="0.35" />
      </svg>

      <style jsx>{`
        .jarvis-orb .orb-ring,
        .jarvis-orb .orb-mid,
        .jarvis-orb .orb-spokes line {
          stroke: hsl(var(--primary));
        }
        .jarvis-orb .orb-core {
          fill: hsl(var(--primary));
        }
        .jarvis-orb .orb-core-glow {
          fill: hsl(var(--primary));
          filter: blur(3px);
        }
        .jarvis-orb .orb-ripple {
          stroke: hsl(var(--primary));
          opacity: 0;
        }

        /* off — dim everything */
        .jarvis-orb--off .orb-ring,
        .jarvis-orb--off .orb-mid,
        .jarvis-orb--off .orb-spokes line {
          stroke: hsl(var(--muted-foreground));
          opacity: 0.4;
        }
        .jarvis-orb--off .orb-core {
          fill: hsl(var(--muted-foreground));
          opacity: 0.5;
        }
        .jarvis-orb--off .orb-core-glow { opacity: 0; }

        /* wake — slow idle pulse */
        .jarvis-orb--wake .orb-core,
        .jarvis-orb--wake .orb-core-glow {
          animation: orbPulse 2.6s ease-in-out infinite;
        }
        .jarvis-orb--wake .orb-spokes { opacity: 0.55; }

        /* listening — spin the spokes, glow the ring */
        .jarvis-orb--listening .orb-spokes {
          animation: orbSpin 1.2s linear infinite;
          transform-origin: 24px 24px;
        }
        .jarvis-orb--listening .orb-ring {
          filter: drop-shadow(0 0 3px hsl(var(--primary)));
        }
        .jarvis-orb--listening .orb-core {
          animation: orbPulse 0.9s ease-in-out infinite;
        }

        /* thinking — shimmer the dashed ring */
        .jarvis-orb--thinking .orb-ring {
          animation: orbDash 1s linear infinite;
        }
        .jarvis-orb--thinking .orb-spokes { opacity: 0.4; }

        /* speaking — ripples */
        .jarvis-orb--speaking .orb-ripple-1 {
          animation: orbRipple 1.4s ease-out infinite;
        }
        .jarvis-orb--speaking .orb-ripple-2 {
          animation: orbRipple 1.4s ease-out 0.7s infinite;
        }
        .jarvis-orb--speaking .orb-core {
          animation: orbPulse 0.7s ease-in-out infinite;
        }

        @keyframes orbPulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.45; }
        }
        @keyframes orbSpin {
          to { transform: rotate(360deg); }
        }
        @keyframes orbDash {
          to { stroke-dashoffset: -26; }
        }
        @keyframes orbRipple {
          0% { transform: scale(1); opacity: 0.5; transform-origin: 24px 24px; }
          100% { transform: scale(1.55); opacity: 0; transform-origin: 24px 24px; }
        }
      `}</style>
    </div>
  )
}
