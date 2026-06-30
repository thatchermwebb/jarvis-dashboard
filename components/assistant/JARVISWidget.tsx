'use client'

import { useState } from 'react'
import { Bot, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { JARVISPanel } from './JARVISPanel'

export function JARVISWidget({ mobile = false }: { mobile?: boolean }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className={cn(
          'fixed right-4 z-50 w-12 h-12 rounded-full bg-card border border-border shadow-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all hover:shadow-primary/20 hover:shadow-xl',
          mobile ? 'right-4' : 'right-6'
        )}
        style={mobile ? { bottom: 'calc(env(safe-area-inset-bottom) + 76px)' } : { bottom: '1.5rem' }}
        title="Ask JARVIS"
      >
        <Bot className="w-5 h-5" />
      </button>

      <JARVISPanel open={open} onClose={() => setOpen(false)} />
    </>
  )
}
