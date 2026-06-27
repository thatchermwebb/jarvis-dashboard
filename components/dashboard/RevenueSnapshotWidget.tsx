'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn, localToday, formatCurrency } from '@/lib/utils'
import type { Payment } from '@/types'

interface Props {
  payments: Payment[]
}

function Section({
  label, payments, accent, defaultOpen = true,
}: {
  label: string
  payments: Payment[]
  accent: 'red' | 'amber' | 'blue' | 'muted'
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  if (payments.length === 0) return null
  const total = payments.reduce((s, p) => s + p.amount, 0)

  const headerCls = {
    red:   'text-red-400',
    amber: 'text-amber-400',
    blue:  'text-blue-400',
    muted: 'text-muted-foreground',
  }[accent]

  const rowTint = {
    red:   'bg-red-500/5',
    amber: 'bg-amber-500/5',
    blue:  '',
    muted: '',
  }[accent]

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-secondary/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-semibold', headerCls)}>{label}</span>
          <span className={cn('text-[11px] font-bold', headerCls)}>{formatCurrency(total)}</span>
          <span className="text-[10px] text-muted-foreground/50">· {payments.length}</span>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
      </button>
      {open && (
        <div className={cn('px-4 pb-2', rowTint)}>
          {payments.map(p => {
            const clientName = (p.client as { name?: string } | undefined)?.name ?? 'Unknown'
            const label = p.description || p.payment_type.replace(/_/g, ' ')
            return (
              <div key={p.id} className="flex items-center justify-between py-1.5 border-b border-border/20 last:border-0">
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{clientName}</div>
                  <div className="text-[11px] text-muted-foreground capitalize truncate">{label}</div>
                </div>
                <span className="text-sm font-semibold tabular-nums ml-3 shrink-0">{formatCurrency(p.amount)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function RevenueSnapshotWidget({ payments }: Props) {
  const today = localToday()
  const tomorrow = (() => {
    const [y, m, d] = today.split('-').map(Number)
    const ms = Date.UTC(y, m - 1, d) + 86_400_000
    const dt = new Date(ms)
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
  })()
  const in14 = (() => {
    const [y, m, d] = today.split('-').map(Number)
    const ms = Date.UTC(y, m - 1, d) + 14 * 86_400_000
    const dt = new Date(ms)
    return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
  })()

  const overdue   = payments.filter(p => p.status === 'overdue')
  const dueToday  = payments.filter(p => p.status === 'pending' && p.due_date === today)
  const dueTomorrow = payments.filter(p => p.status === 'pending' && p.due_date === tomorrow)
  const upcoming  = payments.filter(p => p.status === 'pending' && p.due_date > tomorrow && p.due_date <= in14)

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold">Payments</h2>
        <Link href="/payments" className="text-sm text-primary hover:underline">
          View all →
        </Link>
      </div>

      <div className="bg-card border border-border rounded-xl overflow-hidden flex-1 divide-y divide-border/40">
        {overdue.length === 0 && dueToday.length === 0 && dueTomorrow.length === 0 && upcoming.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">No pending payments</div>
        ) : (
          <>
            <Section label="Due Today"     payments={dueToday}    accent="amber" defaultOpen={true} />
            <Section label="Due Tomorrow"  payments={dueTomorrow} accent="blue"  defaultOpen={true} />
            <Section label="⚠ Overdue"    payments={overdue}     accent="red"   defaultOpen={true} />
            <Section label="Upcoming"      payments={upcoming}    accent="muted" defaultOpen={false} />
          </>
        )}
      </div>
    </div>
  )
}
