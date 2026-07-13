'use client'

import { useEffect, useRef } from 'react'

// Tiny self-contained canvas confetti burst — no deps. Renders a full-screen
// fixed canvas, fires when `trigger` increments, and cleans itself up.
export function Confetti({ trigger }: { trigger: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (trigger === 0) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = window.innerWidth * dpr
    canvas.height = window.innerHeight * dpr
    ctx.scale(dpr, dpr)
    const W = window.innerWidth, H = window.innerHeight

    const colors = ['#10b981', '#22ccff', '#eab308', '#f472b6', '#a78bfa', '#ffffff']
    const N = 140
    const parts = Array.from({ length: N }, () => ({
      x: W / 2 + (Math.random() - 0.5) * 120,
      y: H * 0.42,
      vx: (Math.random() - 0.5) * 12,
      vy: -Math.random() * 14 - 4,
      size: 4 + Math.random() * 6,
      color: colors[(Math.random() * colors.length) | 0],
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      life: 1,
    }))

    let raf = 0
    const gravity = 0.35
    const start = performance.now()
    const render = (t: number) => {
      const elapsed = t - start
      ctx.clearRect(0, 0, W, H)
      let alive = false
      for (const p of parts) {
        p.vy += gravity
        p.x += p.vx
        p.y += p.vy
        p.vx *= 0.99
        p.rot += p.vr
        p.life = Math.max(0, 1 - elapsed / 2200)
        if (p.life > 0 && p.y < H + 20) {
          alive = true
          ctx.save()
          ctx.globalAlpha = p.life
          ctx.translate(p.x, p.y)
          ctx.rotate(p.rot)
          ctx.fillStyle = p.color
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6)
          ctx.restore()
        }
      }
      if (alive) raf = requestAnimationFrame(render)
      else ctx.clearRect(0, 0, W, H)
    }
    raf = requestAnimationFrame(render)
    return () => cancelAnimationFrame(raf)
  }, [trigger])

  return (
    <canvas
      ref={canvasRef}
      className="pointer-events-none fixed inset-0 z-[100]"
      style={{ width: '100vw', height: '100vh' }}
    />
  )
}
