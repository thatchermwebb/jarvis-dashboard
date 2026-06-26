import { createClient } from '@/lib/supabase/server'
import { sortClientsByPriority } from '@/lib/scoring'
import { CallQueueCard } from '@/components/call-queue/CallQueueCard'
import { differenceInDays } from 'date-fns'
import type { Client } from '@/types'

export const dynamic = 'force-dynamic'

export default async function TrialsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('*')
    .in('stage', ['free_trial', 'trial_ending_soon', 'trial_concluded'])
    .order('trial_end', { ascending: true })

  const clients = sortClientsByPriority((data ?? []) as Client[])
  const active = clients.filter((c) => c.stage !== 'trial_concluded')
  const concluded = clients.filter((c) => c.stage === 'trial_concluded')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Free Trials</h1>
        <p className="text-xs text-muted-foreground">{active.length} active · {concluded.length} concluded</p>
      </div>

      {active.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
          No active trials. Add a client in Free Trial stage to get started.
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((c) => (
            <CallQueueCard key={c.id} client={c} />
          ))}
        </div>
      )}

      {concluded.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Concluded</h2>
          <div className="space-y-2">
            {concluded.map((c) => (
              <CallQueueCard key={c.id} client={c} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
