'use client'

import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import { geoAlbersUsa, geoPath, geoGraticule10, geoContains } from 'd3-geo'
import { feature } from 'topojson-client'
import type { Feature, FeatureCollection, Geometry, MultiLineString } from 'geojson'
import type { Topology } from 'topojson-specification'
import { Plus, Minus, Maximize2, MapPin, Loader2 } from 'lucide-react'
import { stageLabel } from '@/lib/utils'

// One detailer, already geocoded server-side.
export type DetailerPoint = {
  id: string
  business: string
  owner?: string | null
  location: string
  stage: string
  lat: number
  lng: number
  approx: boolean
}

const W = 975
const H = 610
const BRAND = '#00E5B0' // signature green glow
const MIN_K = 1
const MAX_K = 9

type Site = {
  key: string
  lng: number
  lat: number
  x: number // base (k=1) projected coords
  y: number
  members: DetailerPoint[]
  approx: boolean
}

export function DetailerMap({ points }: { points: DetailerPoint[] }) {
  const svgRef = useRef<SVGSVGElement | null>(null)
  const [geo, setGeo] = useState<{
    states: Feature<Geometry>[]
    paths: Map<string, string>
    graticule: string
    litStateIds: Set<string>
    sites: Site[]
  } | null>(null)
  const [err, setErr] = useState<string | null>(null)

  // View transform (screen = translate(tx,ty) · scale(k) · base).
  const [view, setView] = useState({ k: 1, tx: 0, ty: 0 })
  const [hover, setHover] = useState<string | null>(null)
  const drag = useRef<{ x: number; y: number; tx: number; ty: number } | null>(null)
  const moved = useRef(false)

  // Load geography + project once.
  useEffect(() => {
    let cancelled = false
    fetch('/geo/us-states-10m.json')
      .then(r => { if (!r.ok) throw new Error(`map data ${r.status}`); return r.json() })
      .then((topo: Topology) => {
        if (cancelled) return
        const fc = feature(topo, topo.objects.states) as unknown as FeatureCollection<Geometry>
        const projection = geoAlbersUsa().fitSize([W, H], fc)
        const pathGen = geoPath(projection)

        const paths = new Map<string, string>()
        for (const f of fc.features) {
          const d = pathGen(f)
          if (d) paths.set(String(f.id), d)
        }
        const graticule = pathGen(geoGraticule10() as MultiLineString) || ''

        // Project detailer points and merge any that land on the same spot.
        const siteMap = new Map<string, Site>()
        for (const p of points) {
          const xy = projection([p.lng, p.lat])
          if (!xy) continue
          const key = `${p.lng.toFixed(2)},${p.lat.toFixed(2)}`
          const existing = siteMap.get(key)
          if (existing) {
            existing.members.push(p)
            existing.approx = existing.approx && p.approx
          } else {
            siteMap.set(key, {
              key, lng: p.lng, lat: p.lat, x: xy[0], y: xy[1],
              members: [p], approx: p.approx,
            })
          }
        }
        const sites = [...siteMap.values()]

        // Which states contain at least one detailer (for the faint green wash).
        const litStateIds = new Set<string>()
        for (const f of fc.features) {
          if (points.some(p => geoContains(f, [p.lng, p.lat]))) litStateIds.add(String(f.id))
        }

        setGeo({ states: fc.features, paths, graticule, litStateIds, sites })
      })
      .catch(e => !cancelled && setErr(e.message || 'Failed to load map'))
    return () => { cancelled = true }
  }, [points])

  // clientX/Y → viewBox coords.
  const toViewBox = useCallback((clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return { vx: 0, vy: 0 }
    return {
      vx: ((clientX - rect.left) / rect.width) * W,
      vy: ((clientY - rect.top) / rect.height) * H,
    }
  }, [])

  const zoomAround = useCallback((vx: number, vy: number, factor: number) => {
    setView(v => {
      const k = Math.max(MIN_K, Math.min(MAX_K, v.k * factor))
      if (k === v.k) return v
      const wx = (vx - v.tx) / v.k
      const wy = (vy - v.ty) / v.k
      let tx = vx - wx * k
      let ty = vy - wy * k
      // keep the map from drifting fully out of frame
      const max = 0
      const minX = W - W * k, minY = H - H * k
      tx = Math.min(max, Math.max(minX, tx))
      ty = Math.min(max, Math.max(minY, ty))
      return { k, tx, ty }
    })
  }, [])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const { vx, vy } = toViewBox(e.clientX, e.clientY)
    zoomAround(vx, vy, e.deltaY < 0 ? 1.18 : 1 / 1.18)
  }, [toViewBox, zoomAround])

  const onPointerDown = (e: React.PointerEvent) => {
    moved.current = false
    drag.current = { x: e.clientX, y: e.clientY, tx: view.tx, ty: view.ty }
    ;(e.target as Element).setPointerCapture?.(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) return
    const dx = ((e.clientX - drag.current.x) / (svgRef.current?.getBoundingClientRect().width || W)) * W
    const dy = ((e.clientY - drag.current.y) / (svgRef.current?.getBoundingClientRect().height || H)) * H
    if (Math.abs(e.clientX - drag.current.x) + Math.abs(e.clientY - drag.current.y) > 3) moved.current = true
    setView(v => {
      const k = v.k
      const minX = W - W * k, minY = H - H * k
      return {
        k,
        tx: Math.min(0, Math.max(minX, drag.current!.tx + dx)),
        ty: Math.min(0, Math.max(minY, drag.current!.ty + dy)),
      }
    })
  }
  const onPointerUp = () => { drag.current = null }

  const btnZoom = (factor: number) => zoomAround(W / 2, H / 2, factor)
  const reset = () => setView({ k: 1, tx: 0, ty: 0 })

  const stateCount = geo?.litStateIds.size ?? 0

  // Dot radius shrinks as you zoom in so dots stay a sensible screen size.
  const dotScale = 1 / Math.sqrt(view.k)

  const hoverSite = useMemo(
    () => geo?.sites.find(s => s.key === hover) || null,
    [geo, hover],
  )

  return (
    <div className="relative w-full overflow-hidden rounded-2xl border border-border bg-[#070c10]"
      style={{ aspectRatio: `${W} / ${H}` }}>
      {/* ambient brand wash */}
      <div className="pointer-events-none absolute inset-0 z-0"
        style={{
          background:
            `radial-gradient(60% 55% at 50% 42%, rgba(0,229,176,0.10), transparent 70%),` +
            `radial-gradient(40% 40% at 85% 90%, rgba(0,229,176,0.06), transparent 70%)`,
        }} />

      {!geo && !err && (
        <div className="absolute inset-0 z-20 flex items-center justify-center text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading map…
        </div>
      )}
      {err && (
        <div className="absolute inset-0 z-20 flex items-center justify-center text-sm text-destructive">
          {err}
        </div>
      )}

      {geo && (
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          className="absolute inset-0 h-full w-full touch-none select-none"
          style={{ cursor: drag.current ? 'grabbing' : 'grab' }}
          onWheel={onWheel}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          <defs>
            <filter id="dotGlow" x="-120%" y="-120%" width="340%" height="340%">
              <feGaussianBlur stdDeviation="5.5" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <radialGradient id="siteFill" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#9bffe6" />
              <stop offset="55%" stopColor={BRAND} />
              <stop offset="100%" stopColor="#00a37e" />
            </radialGradient>
          </defs>

          {/* Geography scales/pans with the view; dots are drawn after in screen space. */}
          <g transform={`translate(${view.tx},${view.ty}) scale(${view.k})`}>
            <path d={geo.graticule} fill="none" stroke="rgba(120,160,175,0.07)"
              strokeWidth={0.5} vectorEffect="non-scaling-stroke" />
            {geo.states.map(f => {
              const id = String(f.id)
              const lit = geo.litStateIds.has(id)
              return (
                <path
                  key={id}
                  d={geo.paths.get(id)}
                  fill={lit ? 'rgba(0,229,176,0.09)' : 'rgba(255,255,255,0.018)'}
                  stroke={lit ? 'rgba(0,229,176,0.35)' : 'rgba(150,180,195,0.16)'}
                  strokeWidth={lit ? 0.9 : 0.6}
                  vectorEffect="non-scaling-stroke"
                  style={{ transition: 'fill 200ms' }}
                />
              )
            })}
          </g>

          {/* Detailer dots — screen space, constant size, glowing. */}
          {geo.sites.map(s => {
            const sx = view.tx + view.k * s.x
            const sy = view.ty + view.k * s.y
            if (sx < -20 || sx > W + 20 || sy < -20 || sy > H + 20) return null
            const isHover = hover === s.key
            const n = s.members.length
            const base = (n > 1 ? 7.5 : 6) * dotScale
            return (
              <g
                key={s.key}
                transform={`translate(${sx},${sy})`}
                onPointerEnter={() => setHover(s.key)}
                onPointerLeave={() => setHover(h => (h === s.key ? null : h))}
                style={{ cursor: 'pointer' }}
              >
                {/* live pulse */}
                <circle r={base} fill={BRAND} opacity={0.5}>
                  <animate attributeName="r" from={base} to={base * 3.4}
                    dur="2.6s" begin={`${(s.x + s.y) % 2}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.5" to="0"
                    dur="2.6s" begin={`${(s.x + s.y) % 2}s`} repeatCount="indefinite" />
                </circle>
                {/* soft halo */}
                <circle r={base * 2.1} fill={BRAND} opacity={isHover ? 0.3 : 0.16} filter="url(#dotGlow)" />
                {/* core */}
                <circle
                  r={isHover ? base * 1.35 : base}
                  fill="url(#siteFill)"
                  stroke="#defff5"
                  strokeWidth={isHover ? 1.4 : 0.9}
                  style={{ transition: 'r 120ms' }}
                />
                {n > 1 && (
                  <text textAnchor="middle" dy={base * 0.45} fontSize={base * 1.1}
                    fontWeight={800} fill="#042019" style={{ pointerEvents: 'none' }}>
                    {n}
                  </text>
                )}
              </g>
            )
          })}
        </svg>
      )}

      {/* Hover tooltip (HTML overlay, positioned in container %) */}
      {geo && hoverSite && (() => {
        const sx = view.tx + view.k * hoverSite.x
        const sy = view.ty + view.k * hoverSite.y
        const left = (sx / W) * 100
        const top = (sy / H) * 100
        const flipX = left > 62
        const flipY = top < 22
        return (
          <div
            className="pointer-events-none absolute z-30 w-60 rounded-xl border border-primary/25 bg-popover/95 p-3 shadow-2xl backdrop-blur"
            style={{
              left: `${left}%`, top: `${top}%`,
              transform: `translate(${flipX ? 'calc(-100% - 14px)' : '14px'}, ${flipY ? '14px' : 'calc(-100% - 14px)'})`,
            }}
          >
            <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium text-primary">
              <MapPin className="h-3 w-3" />
              {hoverSite.members[0].location}
              {hoverSite.approx && <span className="text-muted-foreground/60">(approx.)</span>}
            </div>
            <div className="space-y-1.5">
              {hoverSite.members.map(m => (
                <div key={m.id} className="leading-tight">
                  <div className="truncate text-[13px] font-semibold text-foreground">{m.business}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                    {m.owner && <span className="truncate">{m.owner}</span>}
                    {m.owner && <span className="text-muted-foreground/40">·</span>}
                    <span className="text-emerald-300/90">{stageLabel(m.stage as never)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })()}

      {/* Count chip */}
      <div className="absolute left-3 top-3 z-20 flex items-center gap-2 rounded-full border border-border bg-background/70 px-3 py-1.5 text-xs backdrop-blur">
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-60"
            style={{ background: BRAND }} />
          <span className="relative inline-flex h-2 w-2 rounded-full" style={{ background: BRAND }} />
        </span>
        <span className="font-semibold text-foreground">{points.length}</span>
        <span className="text-muted-foreground">active detailer{points.length === 1 ? '' : 's'}</span>
        <span className="text-muted-foreground/40">·</span>
        <span className="text-muted-foreground">{stateCount} state{stateCount === 1 ? '' : 's'}</span>
      </div>

      {/* Zoom controls */}
      <div className="absolute bottom-3 right-3 z-20 flex flex-col gap-1.5">
        <button onClick={() => btnZoom(1.5)} title="Zoom in"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/80 text-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-primary">
          <Plus className="h-4 w-4" />
        </button>
        <button onClick={() => btnZoom(1 / 1.5)} title="Zoom out"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/80 text-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-primary">
          <Minus className="h-4 w-4" />
        </button>
        <button onClick={reset} title="Reset view"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background/80 text-foreground backdrop-blur transition-colors hover:border-primary/40 hover:text-primary">
          <Maximize2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
