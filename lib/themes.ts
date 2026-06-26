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
