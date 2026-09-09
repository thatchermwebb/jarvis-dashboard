import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { weekMonday, MEDIA_ACTIVE_STAGES } from '@/lib/media'
import type { MediaAd, MediaReview } from '@/types'

// The weekly review board: every active client running ads, with their active
// ad slots and this week's review (if done yet).
export async function GET() {
  const supabase = await createClient()
  const week = weekMonday()

  const [clientsRes, adsRes, reviewsRes, creativesRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, business_name, market_location, stage, advertised_package, ad_account_link, campaign_link')
      .in('stage', MEDIA_ACTIVE_STAGES)
      .order('name', { ascending: true }),
    supabase.from('media_ads').select('*').in('status', ['active', 'paused', 'in_production']),
    supabase.from('media_reviews').select('*').eq('week', week),
    // Active creative codes so the review/library pickers stay linked to the library.
    supabase.from('media_creatives').select('code, name').eq('status', 'active').order('code', { ascending: true }),
  ])

  if (clientsRes.error) return NextResponse.json({ error: clientsRes.error.message }, { status: 500 })

  const ads = (adsRes.data ?? []) as MediaAd[]
  const reviews = (reviewsRes.data ?? []) as MediaReview[]

  const adsByClient: Record<string, MediaAd[]> = {}
  for (const a of ads) (adsByClient[a.client_id] ??= []).push(a)
  const reviewByClient: Record<string, MediaReview> = {}
  for (const r of reviews) reviewByClient[r.client_id] = r

  const clients = (clientsRes.data ?? []).map(c => ({
    ...c,
    ads: (adsByClient[c.id] ?? []).sort((a, b) => (a.slot ?? 9) - (b.slot ?? 9)),
    review: reviewByClient[c.id] ?? null,
  }))

  return NextResponse.json({ week, clients, creatives: creativesRes.data ?? [] })
}
