import { createClient } from '@/lib/supabase/server'
import { sortClientsByPriority } from '@/lib/scoring'
import { CallQueueCard } from '@/components/call-queue/CallQueueCard'
import type { Client } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ThatcherPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('*')
    .or('thatcher_needed.eq.true,last_client_sentiment.eq.close_ready')

  const clients = sortClientsByPriority((data ?? []) as Client[])
  const closeReady = clients.filter((c) => c.last_client_sentiment === 'close_ready' || (c.trial_health_score ?? 0) >= 80)
  const needsThatcher = clients.filter((c) => c.thatcher_needed && !closeReady.includes(c))

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Close Ready / Thatcher View</h1>
        <p className="text-xs text-muted-foreground">People who need Thatcher to close or save</p>
      </div>

      {closeReady.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-violet-400">🎯 Close-Ready Trials</h2>
          {closeReady.map((c) => <CallQueueCard key={c.id} client={c} />)}
        </div>
      )}

      {needsThatcher.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-amber-400">⭐ Needs Thatcher</h2>
          {needsThatcher.map((c) => <CallQueueCard key={c.id} client={c} />)}
        </div>
      )}

      {clients.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
          No clients need Thatcher right now. Mark clients as "Needs Thatcher" or "Close-Ready" to see them here.
        </div>
      )}
    </div>
  )
}
