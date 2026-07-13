import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { withinWorkHoursCST } from '@/lib/team'
import type { TeamTimeEntry } from '@/types'

// Admin pay-period compile of the TEAM pipeline KPI: onboarding assigned ->
// completed within 1 hour, grouped per client across both VAs. The pipeline
// starts at the earliest assigned_at for the client (Wilson's ads) and ends
// at the onboarding completion (Samuel). Tasks assigned outside 8-17 CST are
// excluded entirely.

const ONE_HOUR_MS = 60 * 60 * 1000

interface PipelineRow {
  client_id: string
  client: string | null
  assigned_at: string          // earliest (Wilson ads)
  completed_at: string | null  // onboarding completion (or latest completed)
  status: 'completed' | 'pending'
  span_minutes: number | null
  eligible: boolean
  within_hour: boolean
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const since = searchParams.get('since') ?? new Date(Date.now() - 7 * 86_400_000).toISOString()

  const { data, error } = await supabase
    .from('team_time_entries')
    .select('*, client:clients(id, name, business_name)')
    .not('assigned_at', 'is', null)
    .not('client_id', 'is', null)
    .gte('assigned_at', since)
    .order('assigned_at', { ascending: true })

  if (error) return NextResponse.json({ rows: [], summary: emptySummary(since) })

  // Group the pipeline by client
  const groups = new Map<string, TeamTimeEntry[]>()
  for (const e of (data ?? []) as TeamTimeEntry[]) {
    if (!e.client_id) continue
    const arr = groups.get(e.client_id) ?? []
    arr.push(e)
    groups.set(e.client_id, arr)
  }

  const rows: PipelineRow[] = []
  for (const [clientId, entries] of groups) {
    const assignedList = entries.filter(e => e.assigned_at).map(e => e.assigned_at as string).sort()
    const pipelineAssigned = assignedList[0]
    if (!pipelineAssigned) continue

    // Onboarding completion = Samuel's completed onboarding, else latest completion
    const samuelDone = entries
      .filter(e => e.va_id === 'samuel' && e.completed_at)
      .map(e => e.completed_at as string).sort()
    const anyDone = entries.filter(e => e.completed_at).map(e => e.completed_at as string).sort()
    // All standard steps completed? (both VAs' standard tasks done)
    const standardSteps = entries.filter(e => e.is_standard)
    const allStandardDone = standardSteps.length > 0 && standardSteps.every(e => e.status === 'completed')
    const pipelineCompleted = allStandardDone
      ? (samuelDone[samuelDone.length - 1] ?? anyDone[anyDone.length - 1] ?? null)
      : null

    const eligible = withinWorkHoursCST(pipelineAssigned)
    const spanMs = pipelineCompleted ? Date.parse(pipelineCompleted) - Date.parse(pipelineAssigned) : null
    rows.push({
      client_id: clientId,
      client: entries[0].client?.name ?? null,
      assigned_at: pipelineAssigned,
      completed_at: pipelineCompleted,
      status: pipelineCompleted ? 'completed' : 'pending',
      span_minutes: spanMs != null ? Math.round(spanMs / 60000) : null,
      eligible,
      within_hour: spanMs != null ? spanMs <= ONE_HOUR_MS : false,
    })
  }

  rows.sort((a, b) => b.assigned_at.localeCompare(a.assigned_at))

  const eligibleCompleted = rows.filter(r => r.eligible && r.status === 'completed')
  const hits = eligibleCompleted.filter(r => r.within_hour).length
  const pct = eligibleCompleted.length ? Math.round((hits / eligibleCompleted.length) * 100) : null

  return NextResponse.json({
    rows,
    summary: {
      since,
      total: rows.length,
      excluded_out_of_hours: rows.filter(r => !r.eligible).length,
      pending: rows.filter(r => r.status !== 'completed').length,
      eligible_completed: eligibleCompleted.length,
      hits,
      pct,
      bonus_eligible: pct != null && pct >= 90,
    },
  })
}

function emptySummary(since: string) {
  return { since, total: 0, excluded_out_of_hours: 0, pending: 0, eligible_completed: 0, hits: 0, pct: null, bonus_eligible: false }
}
