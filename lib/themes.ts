export const DEFAULT_COLOR = '#c9a84c'
export const DEFAULT_BG = '#111116'

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

function getContrastColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.55 ? '#0a0a0a' : '#ffffff'
}

// Slightly lighter version of a dark background for card/sidebar
function deriveCardColor(bgHex: string): string {
  const [r, g, b] = hexToRgb(bgHex)
  const bump = (v: number) => Math.min(255, Math.round(v + 18))
  return `rgb(${bump(r)},${bump(g)},${bump(b)})`
}

function deriveSidebarColor(bgHex: string): string {
  const [r, g, b] = hexToRgb(bgHex)
  const darken = (v: number) => Math.max(0, Math.round(v - 8))
  return `rgb(${darken(r)},${darken(g)},${darken(b)})`
}

export function applyColor(hex: string) {
  const fg = getContrastColor(hex)
  const root = document.documentElement
  root.style.setProperty('--primary', hex)
  root.style.setProperty('--primary-foreground', fg)
  root.style.setProperty('--ring', hex)
  root.style.setProperty('--sidebar-primary', hex)
  root.style.setProperty('--sidebar-primary-foreground', fg)
  root.style.setProperty('--sidebar-ring', hex)
  root.style.setProperty('--chart-1', hex)
}

export function applyBgColor(bgHex: string) {
  const root = document.documentElement
  root.style.setProperty('--background', bgHex)
  root.style.setProperty('--card', deriveCardColor(bgHex))
  root.style.setProperty('--popover', deriveCardColor(bgHex))
  root.style.setProperty('--sidebar', deriveSidebarColor(bgHex))
  root.style.setProperty('--secondary', deriveCardColor(bgHex))
  root.style.setProperty('--muted', deriveCardColor(bgHex))
}

export function getColorForUser(userId: string): string {
  if (typeof window === 'undefined') return DEFAULT_COLOR
  return localStorage.getItem(`cza_color_${userId}`) ?? DEFAULT_COLOR
}

export function setColorForUser(userId: string, hex: string) {
  localStorage.setItem(`cza_color_${userId}`, hex)
}

export function getBgColorForUser(userId: string): string {
  if (typeof window === 'undefined') return DEFAULT_BG
  return localStorage.getItem(`cza_bg_${userId}`) ?? DEFAULT_BG
}

export function setBgColorForUser(userId: string, hex: string) {
  localStorage.setItem(`cza_bg_${userId}`, hex)
}

// ─── Skins (Slack-style bold themes) ──────────────────────────────────────────
// A "skin" recolors the whole app: a bold gradient sidebar, a themed accent, and
// an ambient glow — the Slack model, where the sidebar carries the theme's
// identity while the content stays dark and readable. Each theme is data-driven:
// its palette + effect vars are set inline (so they beat the per-user bg/accent),
// and one generic `.app-skin` layer in globals.css consumes the effect vars.

export type Skin = string
export const DEFAULT_SKIN: Skin = 'default'

interface ThemeDef {
  key: string
  name: string
  group: 'Base' | 'Bold'
  /** Accent (buttons, highlights). Omit to keep the user's own accent (Midnight). */
  accent?: string
  /** Sidebar gradient — top and bottom stops (bold). */
  sideFrom: string
  sideTo: string
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// A tinted dark palette derived from the theme's sidebar hue — content stays
// dark & legible; the color lives in the sidebar, accent, and ambient glow.
function buildVars(def: ThemeDef): Record<string, string> {
  const { accent, sideFrom, sideTo } = def
  const vars: Record<string, string> = {
    '--card-foreground': 'oklch(0.98 0 0)',
    '--accent-foreground': 'oklch(0.98 0 0)',
    // Content surfaces: very dark, faintly tinted toward the sidebar color.
    '--background': `color-mix(in oklab, ${sideTo} 22%, oklch(0.07 0 0))`,
    '--card': `color-mix(in oklab, ${sideTo} 26%, oklch(0.13 0 0))`,
    '--popover': `color-mix(in oklab, ${sideTo} 26%, oklch(0.11 0 0))`,
    '--secondary': `color-mix(in oklab, ${sideTo} 30%, oklch(0.18 0 0))`,
    '--muted': `color-mix(in oklab, ${sideTo} 28%, oklch(0.16 0 0))`,
    '--muted-foreground': `color-mix(in oklab, ${sideFrom} 30%, oklch(0.68 0 0))`,
    '--accent': `color-mix(in oklab, ${sideFrom} 40%, oklch(0.2 0 0))`,
    '--border': rgba(sideFrom, 0.16),
    '--input': rgba(sideFrom, 0.2),
    // Sidebar: bold gradient (via --skin-sidebar) with a solid fallback.
    '--sidebar': sideTo,
    '--sidebar-accent': rgba(sideFrom, 0.55),
    '--sidebar-border': rgba(sideFrom, 0.3),
    '--skin-sidebar': `linear-gradient(168deg, ${sideFrom} 0%, ${sideTo} 100%)`,
    '--skin-body':
      `radial-gradient(120% 90% at 100% -10%, ${rgba(sideFrom, 0.30)} 0%, transparent 52%), ` +
      `radial-gradient(110% 90% at 0% 110%, ${rgba(accent ?? sideFrom, 0.14)} 0%, transparent 55%)`,
  }
  if (accent) {
    const fg = getContrastColor(accent)
    vars['--primary'] = accent
    vars['--primary-foreground'] = fg
    vars['--ring'] = accent
    vars['--sidebar-primary'] = accent
    vars['--sidebar-primary-foreground'] = fg
    vars['--chart-1'] = accent
  }
  return vars
}

// The theme catalog. Base = the two calm looks; Bold = the Slack-style palette.
export const THEMES: ThemeDef[] = [
  { key: 'default',  name: 'Classic',      group: 'Base', sideFrom: '#1a1a20', sideTo: '#0c0c10' },
  { key: 'midnight', name: 'Midnight',     group: 'Base', sideFrom: '#243049', sideTo: '#0b0e17' },
  { key: 'aubergine',name: 'Aubergine',    group: 'Bold', accent: '#d8b4fe', sideFrom: '#4a1152', sideTo: '#180a22' },
  { key: 'raspberry',name: 'Raspberry',    group: 'Bold', accent: '#f9a8d4', sideFrom: '#5c0f38', sideTo: '#1f0715' },
  { key: 'ember',    name: 'Ember',        group: 'Bold', accent: '#fda4af', sideFrom: '#6b1220', sideTo: '#210a0c' },
  { key: 'clementine',name: 'Clementine',  group: 'Bold', accent: '#fdba74', sideFrom: '#7a3410', sideTo: '#241005' },
  { key: 'sunrise',  name: 'Sunrise',      group: 'Bold', accent: '#fcd34d', sideFrom: '#7c2d12', sideTo: '#3b0d2e' },
  { key: 'jade',     name: 'Jade',         group: 'Bold', accent: '#6ee7b7', sideFrom: '#0f4d3a', sideTo: '#06201c' },
  { key: 'seaglass', name: 'Sea Glass',    group: 'Bold', accent: '#5eead4', sideFrom: '#134e4a', sideTo: '#1e1b3a' },
  { key: 'lagoon',   name: 'Lagoon',       group: 'Bold', accent: '#7dd3fc', sideFrom: '#0f3a5e', sideTo: '#081522' },
  { key: 'indigo',   name: 'Mood Indigo',  group: 'Bold', accent: '#a5b4fc', sideFrom: '#20207a', sideTo: '#0c0b2b' },
]

const THEME_MAP: Record<string, ThemeDef> = Object.fromEntries(THEMES.map((t) => [t.key, t]))

// Swatch gradient for the settings picker — a bold circle of the theme's colors.
export function themeSwatch(t: ThemeDef): string {
  const top = t.accent ?? '#8aa0c6'
  return `linear-gradient(145deg, ${top} 0%, ${t.sideFrom} 55%, ${t.sideTo} 100%)`
}

// Every var any theme can set — used to fully clear before applying a new one.
const ALL_SKIN_VAR_KEYS = Array.from(
  new Set(THEMES.filter((t) => t.key !== 'default').flatMap((t) => Object.keys(buildVars(t)))),
)

/**
 * Apply or clear a skin. Fully resets prior skin vars first, re-applies the
 * user's saved accent/bg (so themes without their own accent — Midnight — keep
 * the user's), then overlays the selected theme's palette + effect vars.
 */
export function applySkin(skin: Skin, restoreBg?: string, restoreAccent?: string) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('app-skin')
  for (const k of ALL_SKIN_VAR_KEYS) root.style.removeProperty(k)
  if (restoreAccent) applyColor(restoreAccent)
  if (restoreBg) applyBgColor(restoreBg)

  const theme = THEME_MAP[skin]
  if (!theme || theme.key === 'default') return

  root.classList.add('app-skin')
  for (const [k, v] of Object.entries(buildVars(theme))) root.style.setProperty(k, v)
}

export function getSkinForUser(userId: string): Skin {
  if (typeof window === 'undefined') return DEFAULT_SKIN
  const stored = localStorage.getItem(`cza_skin_${userId}`)
  return stored && THEME_MAP[stored] ? stored : DEFAULT_SKIN
}

export function setSkinForUser(userId: string, skin: Skin) {
  localStorage.setItem(`cza_skin_${userId}`, skin)
}
