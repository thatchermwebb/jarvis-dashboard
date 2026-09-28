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
  /** Accent (buttons, highlights). Omit to keep the user's own accent. */
  accent?: string
  /** Sidebar gradient — top (richer) and bottom (deep) stops. */
  sideFrom: string
  sideTo: string
  /** Bold themes get the vivid gradient sidebar + glossy buttons; Base stay calm. */
  bold?: boolean
  /** Explicit body background-image (e.g. Constellation's ombre sky). */
  body?: string
}

function rgba(hex: string, a: number): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// A tinted dark palette derived from the theme's sidebar hue — content stays
// dark & legible; the color lives in the sidebar, accent, and ambient glow.
function buildVars(def: ThemeDef): Record<string, string> {
  const { accent, sideFrom, sideTo, bold, body } = def
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
    '--border': rgba(sideFrom, bold ? 0.16 : 0.12),
    '--input': rgba(sideFrom, bold ? 0.2 : 0.14),
    '--sidebar': sideTo,
    '--sidebar-accent': rgba(sideFrom, 0.5),
    '--sidebar-border': rgba(sideFrom, bold ? 0.3 : 0.18),
  }
  if (bold) {
    // A prettier sidebar: a luminous accent-kissed top → rich mid → deep base,
    // on a gentle diagonal. The accent blend makes the top glow instead of
    // reading as a flat dark block.
    const top = accent
      ? `color-mix(in oklab, ${sideFrom} 72%, ${accent})`
      : sideFrom
    vars['--skin-sidebar'] =
      `linear-gradient(158deg, ${top} 0%, ${sideFrom} 34%, ${sideTo} 100%)`
    vars['--skin-body'] = body ??
      `radial-gradient(105% 80% at 100% -8%, ${rgba(sideFrom, 0.34)} 0%, transparent 50%), ` +
      `radial-gradient(95% 80% at -5% 108%, ${rgba(accent ?? sideFrom, 0.16)} 0%, transparent 52%)`
  } else {
    // Calm: no loud sidebar gradient; just a soft ambient wash (or a supplied one).
    vars['--skin-body'] = body ??
      `radial-gradient(130% 90% at 50% -20%, ${rgba(sideFrom, 0.28)} 0%, transparent 55%)`
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

// The old Midnight "constellation" ombre sky — luminous navy/violet radial layers.
const CONSTELLATION_SKY =
  'radial-gradient(135% 95% at 50% -20%, oklch(0.30 0.07 265 / 0.55) 0%, transparent 55%), ' +
  'radial-gradient(90% 70% at 100% -10%, oklch(0.28 0.09 290 / 0.30) 0%, transparent 55%), ' +
  'radial-gradient(80% 70% at 0% 5%, oklch(0.26 0.07 250 / 0.22) 0%, transparent 55%)'

// The theme catalog. Base = calm/classic looks; Bold = the vivid gradient palette.
export const THEMES: ThemeDef[] = [
  { key: 'default',       name: 'Classic',     group: 'Base', sideFrom: '#1a1a20', sideTo: '#0c0c10' },
  { key: 'midnight',      name: 'Midnight',    group: 'Base', sideFrom: '#243049', sideTo: '#0b0e17' },
  { key: 'constellation', name: 'Constellation', group: 'Base', sideFrom: '#2a3a5c', sideTo: '#0b0e17', body: CONSTELLATION_SKY },
  { key: 'aubergine', name: 'Aubergine',   group: 'Bold', bold: true, accent: '#e0bbff', sideFrom: '#63146f', sideTo: '#180a24' },
  { key: 'raspberry', name: 'Raspberry',   group: 'Bold', bold: true, accent: '#fbb6ce', sideFrom: '#7a1450', sideTo: '#1d0713' },
  { key: 'ember',     name: 'Ember',       group: 'Bold', bold: true, accent: '#ffb1a7', sideFrom: '#8a1a22', sideTo: '#210809' },
  { key: 'clementine',name: 'Clementine',  group: 'Bold', bold: true, accent: '#ffc487', sideFrom: '#9a4512', sideTo: '#231005' },
  { key: 'sunrise',   name: 'Sunrise',     group: 'Bold', bold: true, accent: '#ffdd63', sideFrom: '#9a3516', sideTo: '#3a0d2c' },
  { key: 'jade',      name: 'Jade',        group: 'Bold', bold: true, accent: '#7ff0c2', sideFrom: '#0f6349', sideTo: '#05201b' },
  { key: 'seaglass',  name: 'Sea Glass',   group: 'Bold', bold: true, accent: '#6ff0dc', sideFrom: '#12615f', sideTo: '#1b1c3c' },
  { key: 'lagoon',    name: 'Lagoon',      group: 'Bold', bold: true, accent: '#8bd9ff', sideFrom: '#0f5580', sideTo: '#07131f' },
  { key: 'indigo',    name: 'Mood Indigo', group: 'Bold', bold: true, accent: '#b0bcff', sideFrom: '#2d2f9e', sideTo: '#0c0b2c' },
]

const THEME_MAP: Record<string, ThemeDef> = Object.fromEntries(THEMES.map((t) => [t.key, t]))

// Swatch for the settings picker — a glossy 3D orb: a light highlight top-left,
// the theme's rich color, fading to its deep base. Reads far prettier than a
// flat linear wedge.
export function themeSwatch(t: ThemeDef): string {
  const top = t.accent ?? '#9db0d4'
  const highlight = `color-mix(in oklab, ${top} 55%, white)`
  return (
    `radial-gradient(circle at 32% 26%, ${highlight} 0%, ${top} 30%, ` +
    `${t.sideFrom} 68%, ${t.sideTo} 100%)`
  )
}

// Every var any theme can set — used to fully clear before applying a new one.
const ALL_SKIN_VAR_KEYS = Array.from(
  new Set(THEMES.filter((t) => t.key !== 'default').flatMap((t) => Object.keys(buildVars(t)))),
)

/**
 * Apply or clear a skin. Fully resets prior skin vars first, re-applies the
 * user's saved accent/bg (so Base themes without their own accent keep the
 * user's), then overlays the selected theme's palette + effect vars. Bold themes
 * additionally get the `skin-bold` class (vivid sidebar gradient + glossy buttons).
 */
export function applySkin(skin: Skin, restoreBg?: string, restoreAccent?: string) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove('app-skin', 'skin-bold')
  for (const k of ALL_SKIN_VAR_KEYS) root.style.removeProperty(k)
  if (restoreAccent) applyColor(restoreAccent)
  if (restoreBg) applyBgColor(restoreBg)

  const theme = THEME_MAP[skin]
  if (!theme || theme.key === 'default') return

  root.classList.add('app-skin')
  if (theme.bold) root.classList.add('skin-bold')
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
