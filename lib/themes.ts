export const DEFAULT_COLOR = '#c9a84c'

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

export function getColorForUser(userId: string): string {
  if (typeof window === 'undefined') return DEFAULT_COLOR
  return localStorage.getItem(`cza_color_${userId}`) ?? DEFAULT_COLOR
}

export function setColorForUser(userId: string, hex: string) {
  localStorage.setItem(`cza_color_${userId}`, hex)
}
