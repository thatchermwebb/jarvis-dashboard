'use client'

import { cn } from '@/lib/utils'
import { USERS } from '@/lib/auth'

// Per-person circular avatar for a log/entry author. `created_by` may be a
// display name ("Diego"), a first name, or a user id ("trepp") — all resolve.

const COLORS: Record<string, string> = {
  diego: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  thatcher: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  trepp: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
  wilson: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
  samuel: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
}

function resolve(createdBy: string): { id: string; initials: string; name: string } {
  const key = createdBy.trim().toLowerCase()
  const u = USERS.find(
    x => x.id === key || x.name.toLowerCase() === key || x.name.split(' ')[0].toLowerCase() === key,
  )
  if (u) return { id: u.id, initials: u.initials, name: u.name }
  return { id: key, initials: createdBy.trim().slice(0, 2).toUpperCase(), name: createdBy }
}

export function AuthorBadge({ createdBy, size = 'md', className }: {
  createdBy?: string | null
  size?: 'sm' | 'md'
  className?: string
}) {
  if (!createdBy) return null
  const r = resolve(createdBy)
  const dim = size === 'sm' ? 'w-6 h-6 text-[9px]' : 'w-7 h-7 text-[11px]'
  return (
    <span
      title={r.name}
      className={cn(
        'inline-flex items-center justify-center rounded-full border font-bold flex-shrink-0 tracking-tight',
        dim,
        COLORS[r.id] ?? 'bg-secondary text-muted-foreground border-border',
        className,
      )}
    >
      {r.initials}
    </span>
  )
}
