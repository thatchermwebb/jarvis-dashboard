'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { CallQueueCard } from '@/components/call-queue/CallQueueCard'
import type { Client } from '@/types'

export function CollapsibleQueue({ clients }: { clients: Client[] }) {
  const [open, setOpen] = useState(true)

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-2 group"
        >
          <h2 className="text-lg font-semibold group-hover:text-primary transition-colors">
            Priority Call Queue
          </h2>
          {open
            ? <ChevronUp className="w-4 h-4 text-muted-foreground" />
            : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          {clients.length > 0 && (
            <span className="bg-primary/20 text-primary text-xs font-bold px-2 py-0.5 rounded-full">
              {clients.length}
            </span>
          )}
        </button>
        <Link href="/calls" className="text-sm text-primary hover:underline">
          View all →
        </Link>
      </div>

      {open && (
        <div className="space-y-3">
          {clients.length === 0 ? (
            <div className="bg-card border border-border rounded-xl p-10 text-center text-muted-foreground text-sm">
              No active clients yet. Add your first client to get started.
            </div>
          ) : (
            clients.map(c => <CallQueueCard key={c.id} client={c} />)
          )}
        </div>
      )}
    </div>
  )
}
