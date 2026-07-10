'use client'

import { cn } from '@/lib/utils'
import { JARVISPanel } from './JARVISPanel'
import { ArcReactorOrb } from './ArcReactorOrb'
import { useJarvis } from './JarvisProvider'

export function JARVISWidget({ mobile = false }: { mobile?: boolean }) {
  const { status, panelOpen, setPanelOpen } = useJarvis()

  return (
    <>
      <button
        onClick={() => setPanelOpen(true)}
        className={cn(
          'fixed right-4 z-50 w-12 h-12 rounded-full bg-card border border-border shadow-lg flex items-center justify-center transition-all hover:border-[#22ccff]/50 hover:shadow-[#22ccff]/20 hover:shadow-xl',
          status === 'listening' && 'border-[#22ccff]/60 shadow-[#22ccff]/30 shadow-xl',
          mobile ? 'right-4' : 'right-6'
        )}
        style={mobile ? { bottom: 'calc(env(safe-area-inset-bottom) + 76px)' } : { bottom: '1.5rem' }}
        title="JARVIS"
      >
        <ArcReactorOrb status={status} size={34} />
      </button>

      <JARVISPanel open={panelOpen} onClose={() => setPanelOpen(false)} />
    </>
  )
}
