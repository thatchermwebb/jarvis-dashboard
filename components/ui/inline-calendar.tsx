'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

interface Props {
  value: string
  onChange: (v: string) => void
  size?: 'sm' | 'lg'
}

export function InlineCalendar({ value, onChange, size = 'sm' }: Props) {
  const today = new Date(); today.setHours(0,0,0,0)
  const [viewYear,  setViewYear]  = useState(() => value ? +value.split('-')[0] : today.getFullYear())
  const [viewMonth, setViewMonth] = useState(() => value ? +value.split('-')[1] - 1 : today.getMonth())

  const firstDay    = new Date(viewYear, viewMonth, 1).getDay()
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  const selectedDate = value ? new Date(value + 'T00:00:00') : null

  function prevMonth() {
    if (viewMonth === 0) { setViewYear(y => y - 1); setViewMonth(11) }
    else setViewMonth(m => m - 1)
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewYear(y => y + 1); setViewMonth(0) }
    else setViewMonth(m => m + 1)
  }
  function selectDay(day: number) {
    onChange(`${viewYear}-${String(viewMonth + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`)
  }
  function setToday() {
    const d = new Date(); d.setHours(0,0,0,0)
    onChange(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`)
    setViewYear(d.getFullYear()); setViewMonth(d.getMonth())
  }

  const isLg = size === 'lg'
  const cellSize = isLg ? 'w-10 h-10' : 'w-7 h-7'
  const cellText = isLg ? 'text-sm' : 'text-xs'
  const pad      = isLg ? 'p-4' : 'p-3'
  const headText = isLg ? 'text-sm font-semibold' : 'text-xs font-semibold'
  const dayLabel = isLg ? 'text-[10px]' : 'text-[9px]'

  return (
    <div className={cn('bg-secondary/30 border border-border/40 rounded-xl select-none', pad)}>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={prevMonth}
          className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronLeft className={isLg ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        </button>
        <span className={headText}>{MONTHS[viewMonth]} {viewYear}</span>
        <button type="button" onClick={nextMonth}
          className="p-1.5 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors">
          <ChevronRight className={isLg ? 'w-4 h-4' : 'w-3.5 h-3.5'} />
        </button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 mb-1">
        {DAYS.map(d => (
          <div key={d} className={cn('text-center font-semibold text-muted-foreground/50 py-0.5', dayLabel)}>{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {cells.map((day, idx) => {
          if (!day) return <div key={`e-${idx}`} />
          const cellDate = new Date(viewYear, viewMonth, day); cellDate.setHours(0,0,0,0)
          const isToday    = cellDate.getTime() === today.getTime()
          const isSelected = selectedDate && cellDate.getTime() === selectedDate.getTime()
          return (
            <button
              key={`d-${idx}`}
              type="button"
              onClick={() => selectDay(day)}
              className={cn(
                'mx-auto flex items-center justify-center rounded-full font-medium transition-all',
                cellSize, cellText,
                isSelected ? 'bg-primary text-primary-foreground' :
                isToday    ? 'border border-primary/50 text-primary' :
                'text-foreground/80 hover:bg-white/10'
              )}
            >
              {day}
            </button>
          )
        })}
      </div>

      {/* Footer */}
      <div className={cn('flex items-center justify-between border-t border-border/30', isLg ? 'mt-3 pt-3' : 'mt-2 pt-2')}>
        <button type="button" onClick={() => onChange('')}
          className={cn('text-muted-foreground hover:text-foreground transition-colors', isLg ? 'text-xs' : 'text-[10px]')}>
          Clear
        </button>
        {value && (
          <span className={cn('text-primary font-medium', isLg ? 'text-xs' : 'text-[10px]')}>
            {new Date(value + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        )}
        <button type="button" onClick={setToday}
          className={cn('text-primary hover:text-primary/80 transition-colors font-medium', isLg ? 'text-xs' : 'text-[10px]')}>
          Today
        </button>
      </div>
    </div>
  )
}
