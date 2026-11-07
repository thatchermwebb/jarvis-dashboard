import { createClient } from '@/lib/supabase/server'
import { getAffiliateScope } from '@/lib/auth-server'
import { MRR_STAGES } from '@/lib/analytics'
import { geocodeLocation } from '@/lib/geo/usGeocode'
import { DetailerMap, type DetailerPoint } from '@/components/map/DetailerMap'
import type { Client } from '@/types'

export const dynamic = 'force-dynamic'

// "Active detailers" = the live retainer book (same stages Reports/Media use for
// MRR). Trials, onboarding, paused and churned are intentionally excluded.
const ACTIVE_STAGES = [...MRR_STAGES]

export default async function MapPage() {
  const supabase = await createClient()
  const scope = await getAffiliateScope()

  let q = supabase
    .from('clients')
    .select('id, business_name, name, owner_name, market_location, stage, affiliate_id')
    .in('stage', ACTIVE_STAGES)
  if (scope) q = q.eq('affiliate_id', scope) // associates only see their own book

  const { data } = await q
  const clients = (data ?? []) as Client[]

  const points: DetailerPoint[] = []
  const unplaced: string[] = []
  for (const c of clients) {
    const g = geocodeLocation(c.market_location)
    if (!g) {
      unplaced.push(c.business_name || c.name)
      continue
    }
    points.push({
      id: c.id,
      business: c.business_name || c.name,
      owner: c.owner_name ?? null,
      location: c.market_location || '',
      stage: c.stage,
      lat: g.lat,
      lng: g.lng,
      approx: g.approx,
    })
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Map</h1>
          <p className="text-xs text-muted-foreground">
            Where our active detailers are — hover a dot for the account.
          </p>
        </div>
        {unplaced.length > 0 && (
          <p className="text-[11px] text-muted-foreground/70 text-right max-w-[40%]">
            {unplaced.length} without a mappable location: {unplaced.slice(0, 4).join(', ')}
            {unplaced.length > 4 ? '…' : ''}
          </p>
        )}
      </div>

      {points.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-10 text-center text-sm text-muted-foreground">
          No active detailers to map yet.
        </div>
      ) : (
        <DetailerMap points={points} />
      )}
    </div>
  )
}
