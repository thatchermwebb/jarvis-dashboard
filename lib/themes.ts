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

// ─── Skins ──────────────────────────────────────────────────────────────────
// A "skin" is a full curated palette (deeper than the per-user bg/accent tweak).
// Midnight = the constellation aesthetic: deep navy surfaces + luminous blue
// borders; the ombre gradient + card glow live in globals.css (.skin-midnight).

export type Skin = 'default' | 'midnight'
export const DEFAULT_SKIN: Skin = 'default'

// Overrides applied inline (so they beat the per-user bg vars while active).
const MIDNIGHT_VARS: Record<string, string> = {
  '--background': 'oklch(0.09 0.024 264)',
  '--card': 'oklch(0.155 0.030 264)',
  '--card-foreground': 'oklch(0.97 0.008 264)',
  '--popover': 'oklch(0.12 0.026 264)',
  '--secondary': 'oklch(0.185 0.028 264)',
  '--muted': 'oklch(0.17 0.026 264)',
  '--muted-foreground': 'oklch(0.65 0.03 262)',
  '--accent': 'oklch(0.20 0.032 264)',
  '--accent-foreground': 'oklch(0.97 0.008 264)',
  '--border': 'oklch(0.72 0.09 255 / 15%)',
  '--input': 'oklch(0.72 0.09 255 / 15%)',
  '--sidebar': 'oklch(0.07 0.022 264)',
  '--sidebar-accent': 'oklch(0.16 0.026 264)',
  '--sidebar-border': 'oklch(0.72 0.09 255 / 11%)',
}

/**
 * Apply or clear the Midnight skin. On clear, the caller's saved accent/bg are
 * re-applied so the user's custom colors come back (removing the inline midnight
 * vars alone would fall back to defaults, not their saved bg).
 */
export function applySkin(skin: Skin, restoreBg?: string, restoreAccent?: string) {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  if (skin === 'midnight') {
    root.classList.add('skin-midnight')
    for (const [k, v] of Object.entries(MIDNIGHT_VARS)) root.style.setProperty(k, v)
  } else {
    root.classList.remove('skin-midnight')
    for (const k of Object.keys(MIDNIGHT_VARS)) root.style.removeProperty(k)
    if (restoreAccent) applyColor(restoreAccent)
    if (restoreBg) applyBgColor(restoreBg)
  }
}

export function getSkinForUser(userId: string): Skin {
  if (typeof window === 'undefined') return DEFAULT_SKIN
  return (localStorage.getItem(`cza_skin_${userId}`) as Skin) || DEFAULT_SKIN
}

export function setSkinForUser(userId: string, skin: Skin) {
  localStorage.setItem(`cza_skin_${userId}`, skin)
}
