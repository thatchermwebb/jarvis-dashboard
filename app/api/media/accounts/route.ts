import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { MEDIA_ACTIVE_STAGES } from '@/lib/media'
import type { MediaAccount, MediaAccountLog } from '@/types'

// The main Media Buying tracker: every active ad client with their latest review,
// rotated so the ones DUE (follow-up today/overdue) or never reviewed float up.
export async function GET() {
  const supabase = await createClient()

  const [clientsRes, logsRes] = await Promise.all([
    // Full client records so the tracker can render the same rich card as the
    // calls list (sentiment, last contact, flags, note preview, etc.).
    supabase
      .from('clients')
      .select('*')
      .in('stage', MEDIA_ACTIVE_STAGES)
      .order('name', { ascending: true }),
    supabase
      .from('media_account_logs')
      .select('*')
      .order('created_at', { ascending: false }),
  ])

  if (clientsRes.error) return NextResponse.json({ error: clientsRes.error.message }, { status: 500 })

  const logs = (logsRes.data ?? []) as MediaAccountLog[]
  const latestByClient = new Map<string, MediaAccountLog>()
  const countByClient = new Map<string, number>()
  for (const l of logs) {
    countByClient.set(l.client_id, (countByClient.get(l.client_id) ?? 0) + 1)
    if (!latestByClient.has(l.client_id)) latestByClient.set(l.client_id, l) // first = newest
  }

  const accounts: MediaAccount[] = (clientsRes.data ?? []).map(c => {
    const latest = latestByClient.get(c.id) ?? null
    return {
      ...c,
      latest,
      last_checked: latest?.created_at ?? null,
      next_followup: latest?.follow_up_date ?? null,
      log_count: countByClient.get(c.id) ?? 0,
    }
  })

  // Rotating sort: the "due" key is the follow-up date; never-reviewed or no
  // follow-up set = top (empty string sorts first). Then overdue → soonest.
  // Tie-break by longest-since-checked (oldest last_checked first).
  accounts.sort((a, b) => {
    const ak = a.next_followup ?? ''
    const bk = b.next_followup ?? ''
    if (ak !== bk) return ak < bk ? -1 : 1
    const al = a.last_checked ?? ''
    const bl = b.last_checked ?? ''
    return al < bl ? -1 : al > bl ? 1 : 0
  })

  return NextResponse.json(accounts)
}
