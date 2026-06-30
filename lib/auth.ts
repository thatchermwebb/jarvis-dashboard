export type UserType = 'admin' | 'va'

export interface AppUser {
  id: string
  name: string
  role: string
  initials: string
  userType: UserType
}

export const USERS: AppUser[] = [
  { id: 'thatcher', name: 'Thatcher Webb',  role: 'Co-Founder', initials: 'TW', userType: 'admin' },
  { id: 'trepp',    name: 'Trepp Grandich', role: 'Co-Founder', initials: 'TG', userType: 'admin' },
  { id: 'diego',    name: 'Diego Carranza', role: 'VP',         initials: 'DC', userType: 'admin' },
  { id: 'wilson',   name: 'Wilson',         role: 'Ads VA',     initials: 'WL', userType: 'va'    },
  { id: 'samuel',   name: 'Samuel',         role: 'Backend VA', initials: 'SM', userType: 'va'    },
]

export function getUserById(id: string): AppUser | undefined {
  return USERS.find(u => u.id === id)
}
