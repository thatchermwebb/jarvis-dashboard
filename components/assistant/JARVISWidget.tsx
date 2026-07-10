'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { cn } from '@/lib/utils'
import { JARVISPanel } from './JARVISPanel'
import { ArcReactorOrb } from './ArcReactorOrb'
import { useJarvis } from './JarvisProvider'

const SIZE = 56 // orb button diameter

function clampPos(p: { x: number; y: number }): { x: number; y: number } {
  if (typeof window === 'undefined') return p
  return {
    x: Math.min(Math.max(8, p.x), window.innerWidth - SIZE - 8),
    y: Math.min(Math.max(8, p.y), window.innerHeight - SIZE - 8),
  }
}

export function JARVISWidget({ mobile = false }: { mobile?: boolean }) {
  const { status, panelOpen, setPanelOpen } = useJarvis()
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null)
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number; moved: boolean } | null>(null)
  const posRef = useRef(pos)
  posRef.current = pos

  // Restore saved position, default to bottom-right
  useEffect(() => {
    try {
      const raw = localStorage.getItem('jarvis_widget_pos')
      if (raw) { setPos(clampPos(JSON.parse(raw))); return }
    } catch { /* fall through to default */ }
    setPos({
      x: window.innerWidth - SIZE - 20,
      y: window.innerHeight - SIZE - (mobile ? 92 : 20),
    })
  }, [mobile])

  useEffect(() => {
    const onResize = () => setPos(p => (p ? clampPos(p) : p))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    const p = posRef.current
    if (!p) return
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: p.x, origY: p.y, moved: false }
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.startX
    const dy = e.clientY - d.startY
    if (!d.moved && Math.hypot(dx, dy) < 6) return
    d.moved = true
    setPos(clampPos({ x: d.origX + dx, y: d.origY + dy }))
  }, [])

  const onPointerUp = useCallback(() => {
    const d = dragRef.current
    dragRef.current = null
    if (!d) return
    if (d.moved) {
      const p = posRef.current
      if (p) localStorage.setItem('jarvis_widget_pos', JSON.stringify(p))
    } else {
      setPanelOpen(!panelOpen)
    }
  }, [panelOpen, setPanelOpen])

  if (!pos) return null

  return (
    <>
      <button
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        className={cn(
          'fixed z-50 rounded-full jarvis-widget-btn flex items-center justify-center touch-none select-none cursor-grab active:cursor-grabbing',
          status === 'listening' && 'jarvis-widget-btn--hot',
          status === 'speaking' && 'jarvis-widget-btn--speaking',
        )}
        style={{ left: pos.x, top: pos.y, width: SIZE, height: SIZE }}
        title="JARVIS — click to open, drag to move"
      >
        <ArcReactorOrb status={status} size={40} />
      </button>

      <JARVISPanel
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        anchor={{ x: pos.x, y: pos.y, size: SIZE }}
      />
    </>
  )
}
