import type { AdRating } from '@/types'

// ─── Explore/Exploit creative assignment ────────────────────────────────────────
// Picks which master creative a new ad should be built on. Exploits proven network
// winners while fast-tracking under-tested new creatives so Thatcher's fresh designs
// actually get reps. Pure + deterministic so it's easy to test and reason about.

// New creatives with fewer than this many total deployments are "under-tested" and
// get explore priority.
export const EXPLORE_MIN_DEPLOYMENTS = 3
// Don't fire the same under-tested creative at more clients than this before results
// come back (open = still running or in production, i.e. not yet rated).
export const EXPLORE_MAX_CONCURRENT = 3

const RATING_POINTS: Record<AdRating, number> = { good: 2, decent: 1, bad: 0 }

export interface CreativeStat {
  code: string
  deployments: number      // total times ever launched (network-wide)
  openCount: number        // currently running/in-production (unrated) network-wide
  ratedCount: number       // how many have a rating
  score: number | null     // mean rating points; null if never rated
  avgCpl: number | null
}

export interface ClientCreativeHistory {
  running: Set<string>     // creatives this client is running now (active/paused)
  bad: Set<string>         // creatives ever rated 'bad' for this client
  everRan: Set<string>     // any creative this client has ever run
}

/**
 * Choose a creative code for one new ad, or null if the library has nothing eligible.
 * `alreadyPicked` holds codes chosen earlier in the same review so Bad+Bad yields two
 * distinct creatives.
 */
export function assignCreative(
  pool: CreativeStat[],
  client: ClientCreativeHistory,
  alreadyPicked: Set<string> = new Set(),
): string | null {
  // Hard exclusions: currently running, known losers for this client, already
  // picked this review.
  const notExcluded = pool.filter(
    c => !client.running.has(c.code) && !client.bad.has(c.code) && !alreadyPicked.has(c.code),
  )
  if (!notExcluded.length) return null

  // Prefer creatives this client has never run at all; fall back to seen-but-not-bad.
  const unseen = notExcluded.filter(c => !client.everRan.has(c.code))
  const eligible = unseen.length ? unseen : notExcluded

  // Explore: under-tested creatives that aren't already saturated with open tests.
  const explore = eligible
    .filter(c => c.deployments < EXPLORE_MIN_DEPLOYMENTS && c.openCount < EXPLORE_MAX_CONCURRENT)
    .sort((a, b) => a.deployments - b.deployments || a.code.localeCompare(b.code))
  if (explore.length) return explore[0].code

  // Exploit: best proven performer. Rated winners first (by score, then lower CPL),
  // then anything else by fewer deployments so nothing stays untested forever.
  const exploit = [...eligible].sort((a, b) => {
    const sa = a.score ?? -1, sb = b.score ?? -1
    if (sb !== sa) return sb - sa
    const ca = a.avgCpl ?? Infinity, cb = b.avgCpl ?? Infinity
    if (ca !== cb) return ca - cb
    return a.deployments - b.deployments || a.code.localeCompare(b.code)
  })
  return exploit[0]?.code ?? null
}

/** Mean rating points → a 0–2 score, or null when there are no ratings. */
export function ratingScore(ratings: AdRating[]): number | null {
  if (!ratings.length) return null
  return ratings.reduce((s, r) => s + RATING_POINTS[r], 0) / ratings.length
}

// ─── Network aggregation ─────────────────────────────────────────────────────────
// Roll up media_ads rows into per-creative performance, feeding both the engine
// (CreativeStat) and the admin dashboard (good/decent/bad + running-now).

export interface AdLike {
  creative?: string | null
  rating?: AdRating | null
  cpl?: number | null
  status?: string | null
  client_id?: string | null
}

export interface CreativeAgg {
  deployments: number
  openCount: number
  ratedCount: number
  good: number
  decent: number
  bad: number
  score: number | null
  avgCpl: number | null
  runningNow: number   // distinct clients running it now (active/paused)
}

export function aggregateCreativeStats(ads: AdLike[]): Map<string, CreativeAgg> {
  interface Acc { deployments: number; openCount: number; ratings: AdRating[]; cpls: number[]; runningClients: Set<string> }
  const acc = new Map<string, Acc>()
  for (const a of ads) {
    const code = a.creative
    if (!code) continue
    const s = acc.get(code) ?? { deployments: 0, openCount: 0, ratings: [], cpls: [], runningClients: new Set<string>() }
    s.deployments += 1
    if (!a.rating && (a.status === 'active' || a.status === 'in_production')) s.openCount += 1
    if (a.rating) s.ratings.push(a.rating)
    if (a.cpl != null) s.cpls.push(a.cpl)
    if ((a.status === 'active' || a.status === 'paused') && a.client_id) s.runningClients.add(a.client_id)
    acc.set(code, s)
  }
  const out = new Map<string, CreativeAgg>()
  for (const [code, s] of acc) {
    out.set(code, {
      deployments: s.deployments,
      openCount: s.openCount,
      ratedCount: s.ratings.length,
      good: s.ratings.filter(r => r === 'good').length,
      decent: s.ratings.filter(r => r === 'decent').length,
      bad: s.ratings.filter(r => r === 'bad').length,
      score: ratingScore(s.ratings),
      avgCpl: s.cpls.length ? s.cpls.reduce((x, y) => x + y, 0) / s.cpls.length : null,
      runningNow: s.runningClients.size,
    })
  }
  return out
}
