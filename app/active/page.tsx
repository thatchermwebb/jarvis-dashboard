import { createClient } from '@/lib/supabase/server'
import { sortClientsByPriority } from '@/lib/scoring'
import { CallQueueCard } from '@/components/call-queue/CallQueueCard'
import type { Client } from '@/types'

export const dynamic = 'force-dynamic'

export default async function ActiveClientsPage() {
  const supabase = await createClient()
  const { data } = await supabase
    .from('clients')
    .select('*')
    .eq('stage', 'active_client')

  const clients = sortClientsByPriority((data ?? []) as Client[])

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Active Clients</h1>
        <p className="text-xs text-muted-foreground">{clients.length} active clients</p>
      </div>
      {clients.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-muted-foreground text-sm">
          No active clients yet.
        </div>
      ) : (
        <div className="space-y-3">
          {clients.map((c) => <CallQueueCard key={c.id} client={c} />)}
        </div>
      )}
    </div>
  )
}
