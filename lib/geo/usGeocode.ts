// Offline geocoder for the Map page. Client `market_location` is free text
// ("Ashburn, VA", "Flathead Valley, Montana", "Charlotte NC", "Porterville, CA
// // Tulare County, CA"), so there are no coordinates on the record. Rather than
// depend on a geocoding API (key, rate limits, flaky at runtime) we keep a
// curated lookup: every distinct active-client location resolves to a real city
// coordinate, and anything unknown falls back to its state centroid so a future
// "City, ST" still drops a dot in the right place (flagged `approx`).
//
// Coordinates are [longitude, latitude] — the order d3-geo projections expect.

export type GeoPoint = { lng: number; lat: number }
export type GeocodeResult = GeoPoint & {
  /** true when we only resolved to a state centroid, not the specific city. */
  approx: boolean
  /** The place label we actually matched on (for debugging / tooltips). */
  matched: string
}

// ─── State centroids (fallback) ──────────────────────────────────────────────
// Keyed by both USPS abbreviation and full lowercase name.
const STATE_CENTROIDS: Record<string, GeoPoint> = {
  al: { lat: 32.806, lng: -86.791 }, ak: { lat: 61.37, lng: -152.404 },
  az: { lat: 33.729, lng: -111.431 }, ar: { lat: 34.969, lng: -92.373 },
  ca: { lat: 36.116, lng: -119.682 }, co: { lat: 39.059, lng: -105.311 },
  ct: { lat: 41.597, lng: -72.755 }, de: { lat: 39.318, lng: -75.507 },
  fl: { lat: 27.766, lng: -81.686 }, ga: { lat: 33.04, lng: -83.643 },
  hi: { lat: 21.094, lng: -157.498 }, id: { lat: 44.24, lng: -114.478 },
  il: { lat: 40.349, lng: -88.986 }, in: { lat: 39.849, lng: -86.258 },
  ia: { lat: 42.011, lng: -93.21 }, ks: { lat: 38.526, lng: -96.726 },
  ky: { lat: 37.668, lng: -84.67 }, la: { lat: 31.169, lng: -91.867 },
  me: { lat: 44.693, lng: -69.381 }, md: { lat: 39.064, lng: -76.741 },
  ma: { lat: 42.23, lng: -71.53 }, mi: { lat: 43.326, lng: -84.536 },
  mn: { lat: 45.694, lng: -93.9 }, ms: { lat: 32.741, lng: -89.678 },
  mo: { lat: 38.456, lng: -92.288 }, mt: { lat: 46.921, lng: -110.454 },
  ne: { lat: 41.125, lng: -98.268 }, nv: { lat: 38.313, lng: -117.055 },
  nh: { lat: 43.452, lng: -71.564 }, nj: { lat: 40.298, lng: -74.521 },
  nm: { lat: 34.84, lng: -106.248 }, ny: { lat: 42.166, lng: -74.948 },
  nc: { lat: 35.63, lng: -79.806 }, nd: { lat: 47.528, lng: -99.784 },
  oh: { lat: 40.388, lng: -82.764 }, ok: { lat: 35.565, lng: -96.928 },
  or: { lat: 44.572, lng: -122.071 }, pa: { lat: 40.59, lng: -77.209 },
  ri: { lat: 41.68, lng: -71.511 }, sc: { lat: 33.856, lng: -80.945 },
  sd: { lat: 44.299, lng: -99.438 }, tn: { lat: 35.747, lng: -86.692 },
  tx: { lat: 31.054, lng: -97.563 }, ut: { lat: 40.15, lng: -111.862 },
  vt: { lat: 44.045, lng: -72.71 }, va: { lat: 37.769, lng: -78.17 },
  wa: { lat: 47.401, lng: -121.49 }, wv: { lat: 38.491, lng: -80.954 },
  wi: { lat: 44.268, lng: -89.616 }, wy: { lat: 42.756, lng: -107.302 },
  dc: { lat: 38.897, lng: -77.026 },
}

const STATE_NAME_TO_ABBR: Record<string, string> = {
  alabama: 'al', alaska: 'ak', arizona: 'az', arkansas: 'ar', california: 'ca',
  colorado: 'co', connecticut: 'ct', delaware: 'de', florida: 'fl', georgia: 'ga',
  hawaii: 'hi', idaho: 'id', illinois: 'il', indiana: 'in', iowa: 'ia',
  kansas: 'ks', kentucky: 'ky', louisiana: 'la', maine: 'me', maryland: 'md',
  massachusetts: 'ma', michigan: 'mi', minnesota: 'mn', mississippi: 'ms',
  missouri: 'mo', montana: 'mt', nebraska: 'ne', nevada: 'nv',
  'new hampshire': 'nh', 'new jersey': 'nj', 'new mexico': 'nm', 'new york': 'ny',
  'north carolina': 'nc', 'north dakota': 'nd', ohio: 'oh', oklahoma: 'ok',
  oregon: 'or', pennsylvania: 'pa', 'rhode island': 'ri', 'south carolina': 'sc',
  'south dakota': 'sd', tennessee: 'tn', texas: 'tx', utah: 'ut', vermont: 'vt',
  virginia: 'va', washington: 'wa', 'west virginia': 'wv', wisconsin: 'wi',
  wyoming: 'wy', 'district of columbia': 'dc',
}

// ─── City coordinates ────────────────────────────────────────────────────────
// Keyed by a normalized "city, st" (lowercase, single-spaced, USPS abbr). Covers
// every current active-client location plus common major metros for headroom.
const CITY_COORDS: Record<string, GeoPoint> = {
  // Active-client book (as of build) — exact cities
  'ashburn, va': { lat: 39.0438, lng: -77.4874 },
  'round rock, tx': { lat: 30.5083, lng: -97.6789 },
  'porterville, ca': { lat: 36.0652, lng: -119.0168 },
  'tulare, ca': { lat: 36.2077, lng: -119.3473 },
  'vancouver, wa': { lat: 45.6387, lng: -122.6615 },
  'half moon bay, ca': { lat: 37.4636, lng: -122.4286 },
  'naperville, il': { lat: 41.7508, lng: -88.1535 },
  'sacramento, ca': { lat: 38.5816, lng: -121.4944 },
  'gwinnett, ga': { lat: 33.9601, lng: -84.0233 }, // county seat Lawrenceville area
  'lawrenceville, ga': { lat: 33.9562, lng: -83.988 },
  'winter park, fl': { lat: 28.5999, lng: -81.3392 },
  'flathead valley, mt': { lat: 48.1958, lng: -114.3129 }, // ~Kalispell
  'kalispell, mt': { lat: 48.1958, lng: -114.3129 },
  'mchenry county, il': { lat: 42.3242, lng: -88.4526 }, // ~Woodstock
  'mchenry, il': { lat: 42.3334, lng: -88.267 },
  'north kingstown, ri': { lat: 41.5801, lng: -71.4528 },
  'polk county, fl': { lat: 28.0395, lng: -81.9498 }, // ~Lakeland
  'lakeland, fl': { lat: 28.0395, lng: -81.9498 },
  'endwell, ny': { lat: 42.112, lng: -76.0205 },
  'southside, al': { lat: 33.9043, lng: -86.0247 },
  'jacksonville, fl': { lat: 30.3322, lng: -81.6557 },
  'chester county, pa': { lat: 39.9607, lng: -75.6055 }, // ~West Chester
  'west chester, pa': { lat: 39.9607, lng: -75.6055 },
  'short hills, nj': { lat: 40.749, lng: -74.326 },
  'virginia beach, va': { lat: 36.8529, lng: -75.978 },
  'cape may, nj': { lat: 38.9351, lng: -74.906 },
  'princeton, tx': { lat: 33.1801, lng: -96.4983 },
  'tri cities, wa': { lat: 46.2362, lng: -119.2278 }, // Kennewick/Richland/Pasco
  'sarasota, fl': { lat: 27.3364, lng: -82.5307 },
  'gainesville, fl': { lat: 29.6516, lng: -82.3248 },
  'spokane, wa': { lat: 47.6588, lng: -117.426 },
  'north port, fl': { lat: 27.0442, lng: -82.2359 },
  'seattle, wa': { lat: 47.6062, lng: -122.3321 },
  'houston, tx': { lat: 29.7604, lng: -95.3698 },
  'wichita, ks': { lat: 37.6872, lng: -97.3301 },
  'sunnyvale, ca': { lat: 37.3688, lng: -122.0363 },
  'victoria, tx': { lat: 28.8053, lng: -97.0036 },
  'hilton head island, sc': { lat: 32.2163, lng: -80.7526 },
  'hilton head, sc': { lat: 32.2163, lng: -80.7526 },
  'moberly, mo': { lat: 39.4184, lng: -92.4382 },
  'grand rapids, mi': { lat: 42.9634, lng: -85.6681 },
  'loudoun, va': { lat: 39.0904, lng: -77.6358 }, // ~Leesburg
  'leesburg, va': { lat: 39.1157, lng: -77.5636 },
  'rochester hills, mi': { lat: 42.6584, lng: -83.1499 },
  'winston salem, nc': { lat: 36.0999, lng: -80.2442 },
  'winston-salem, nc': { lat: 36.0999, lng: -80.2442 },
  'pembroke pines, fl': { lat: 26.0078, lng: -80.2963 },
  'cincinnati, oh': { lat: 39.1031, lng: -84.512 },
  'prescott, az': { lat: 34.54, lng: -112.4685 },
  'dewey, az': { lat: 34.5355, lng: -112.2399 },
  'charlotte, nc': { lat: 35.2271, lng: -80.8431 },
  'marathon, fl': { lat: 24.7137, lng: -81.0905 },
  'richland, wa': { lat: 46.2857, lng: -119.2845 },
  'milwaukee, wi': { lat: 43.0389, lng: -87.9065 },
  'northwest indiana, in': { lat: 41.4828, lng: -87.3328 }, // ~Merrillville
  'merrillville, in': { lat: 41.4828, lng: -87.3328 },
  // Common major metros (headroom for new clients)
  'new york, ny': { lat: 40.7128, lng: -74.006 },
  'los angeles, ca': { lat: 34.0522, lng: -118.2437 },
  'chicago, il': { lat: 41.8781, lng: -87.6298 },
  'dallas, tx': { lat: 32.7767, lng: -96.797 },
  'austin, tx': { lat: 30.2672, lng: -97.7431 },
  'san antonio, tx': { lat: 29.4241, lng: -98.4936 },
  'phoenix, az': { lat: 33.4484, lng: -112.074 },
  'philadelphia, pa': { lat: 39.9526, lng: -75.1652 },
  'san diego, ca': { lat: 32.7157, lng: -117.1611 },
  'san jose, ca': { lat: 37.3382, lng: -121.8863 },
  'san francisco, ca': { lat: 37.7749, lng: -122.4194 },
  'denver, co': { lat: 39.7392, lng: -104.9903 },
  'miami, fl': { lat: 25.7617, lng: -80.1918 },
  'orlando, fl': { lat: 28.5383, lng: -81.3792 },
  'tampa, fl': { lat: 27.9506, lng: -82.4572 },
  'atlanta, ga': { lat: 33.749, lng: -84.388 },
  'boston, ma': { lat: 42.3601, lng: -71.0589 },
  'nashville, tn': { lat: 36.1627, lng: -86.7816 },
  'portland, or': { lat: 45.5152, lng: -122.6784 },
  'detroit, mi': { lat: 42.3314, lng: -83.0458 },
  'minneapolis, mn': { lat: 44.9778, lng: -93.265 },
  'columbus, oh': { lat: 39.9612, lng: -82.9988 },
  'kansas city, mo': { lat: 39.0997, lng: -94.5786 },
  'las vegas, nv': { lat: 36.1699, lng: -115.1398 },
  'raleigh, nc': { lat: 35.7796, lng: -78.6382 },
}

/** Normalize a raw place fragment to the "city, st" key shape. */
function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*,\s*/g, ', ')
    .trim()
}

/** Pull a USPS abbr from a fragment: an explicit ", xx" suffix, a bare 2-letter
 *  token, or a spelled-out state name anywhere in the text. */
function stateFromFragment(frag: string): string | null {
  const n = normalize(frag)
  // "city, st" or "... st" — trailing 2-letter token
  const tail = n.match(/(?:,\s*|\s)([a-z]{2})$/)
  if (tail && STATE_CENTROIDS[tail[1]]) return tail[1]
  // spelled-out state name (check longer names first)
  for (const name of Object.keys(STATE_NAME_TO_ABBR).sort((a, b) => b.length - a.length)) {
    if (n.includes(name)) return STATE_NAME_TO_ABBR[name]
  }
  return null
}

/**
 * Resolve a free-text market location to coordinates. Returns null only when no
 * state can be determined at all. Multi-location strings ("A // B", "A / B",
 * "A; B") resolve on the first segment.
 */
export function geocodeLocation(raw: string | null | undefined): GeocodeResult | null {
  if (!raw) return null
  const first = raw.split(/\/\/|\s\/\s|;|\band\b/i)[0]
  let n = normalize(first)
  if (!n) return null

  // Fold a spelled-out state down to its abbr so "..., montana" keys match
  // "..., mt" entries in the city table.
  const abbr = stateFromFragment(first)
  if (abbr) {
    for (const [name, a] of Object.entries(STATE_NAME_TO_ABBR)) {
      if (a === abbr && n.endsWith(', ' + name)) {
        n = n.slice(0, -name.length) + abbr
        break
      }
    }
  }

  // 1) exact city match
  if (CITY_COORDS[n]) return { ...CITY_COORDS[n], approx: false, matched: n }

  // 2) city match ignoring the state (handles "charlotte nc" → "charlotte, nc"
  //    style gaps by trying the bare city against same-state entries)
  const cityOnly = n.replace(/(?:,\s*|\s)[a-z]{2}$/, '').trim()
  if (abbr) {
    const keyed = `${cityOnly}, ${abbr}`
    if (CITY_COORDS[keyed]) return { ...CITY_COORDS[keyed], approx: false, matched: keyed }
  }

  // 3) state centroid fallback
  if (abbr && STATE_CENTROIDS[abbr]) {
    return { ...STATE_CENTROIDS[abbr], approx: true, matched: abbr.toUpperCase() }
  }

  return null
}
