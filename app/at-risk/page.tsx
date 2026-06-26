import { createClient } from '@/lib/supabase/server'
import { sortClientsByPriority } from '@/lib/scoring'
import { CallQueueCard } from '@/components/call-queue/CallQueueCard'
import type { Client } from '@/types'

export const dynamic = 'force-dynamic'

export default async function AtRiskPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('*')
    .or('stage.eq.churn_risk,churn_risk_score.gte.60,urgency_level.eq.critical')

  const clients = sortClientsByPriority((data ?? []) as Client[])

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold">At Risk</h1>
        <p className="text-xs text-muted-foreground">{clients.length} clients at churn risk or critical urgency</p>
      </div>
      {clients.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center">
          <p className="text-emerald-400 text-sm font-medium">✓ No clients at risk right now</p>
          <p className="text-muted-foreground text-xs mt-1">Clients appear here when marked Churn Risk or when churn score ≥ 60</p>
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => <CallQueueCard key={c.id} client={c} />)}
        </div>
      )}
    </div>
  )
}
