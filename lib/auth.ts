export interface AppUser {
  id: string
  name: string
  role: string
  initials: string
}

export const USERS: AppUser[] = [
  { id: 'thatcher', name: 'Thatcher Webb',  role: 'Co-Founder', initials: 'TW' },
  { id: 'trepp',    name: 'Trepp Grandich', role: 'Co-Founder', initials: 'TG' },
  { id: 'diego',    name: 'Diego Carranza', role: 'VP',         initials: 'DC' },
]

export function getUserById(id: string): AppUser | undefined {
  return USERS.find(u => u.id === id)
}
