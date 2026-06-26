import type { ThemeId } from './themes'

export interface AppUser {
  id: string
  name: string
  role: string
  initials: string
  password: string
}

export const USERS: AppUser[] = [
  { id: 'thatcher', name: 'Thatcher Webb',   role: 'Co-Founder', initials: 'TW', password: 'Iluv2read2!'  },
  { id: 'trepp',    name: 'Trepp Grandich',  role: 'Co-Founder', initials: 'TG', password: 'Lacrosse33!'  },
  { id: 'diego',    name: 'Diego Carranza',  role: 'VP',         initials: 'DC', password: 'Lambo143$'    },
]

export function getUserById(id: string): AppUser | undefined {
  return USERS.find(u => u.id === id)
}

export function getThemeForUser(userId: string): ThemeId {
  if (typeof window === 'undefined') return 'gold'
  return (localStorage.getItem(`cza_theme_${userId}`) as ThemeId) ?? 'gold'
}

export function setThemeForUser(userId: string, themeId: ThemeId) {
  localStorage.setItem(`cza_theme_${userId}`, themeId)
}
