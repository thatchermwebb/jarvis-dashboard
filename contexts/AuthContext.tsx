'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { USERS, getUserById } from '@/lib/auth'
import { applyColor, getColorForUser, setColorForUser, DEFAULT_COLOR } from '@/lib/themes'
import type { AppUser } from '@/lib/auth'

interface AuthContextType {
  user: AppUser | null
  accentColor: string
  login: (userId: string) => void
  logout: () => void
  setAccentColor: (hex: string) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  accentColor: DEFAULT_COLOR,
  login: () => {},
  logout: () => {},
  setAccentColor: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [accentColor, setAccentColorState] = useState<string>(DEFAULT_COLOR)

  const loadAndApplyColor = useCallback((userId: string) => {
    const color = getColorForUser(userId)
    setAccentColorState(color)
    applyColor(color)
  }, [])

  useEffect(() => {
    const match = document.cookie.match(/cza_user=([^;]+)/)
    const id = match?.[1]
    if (id) {
      const u = getUserById(id)
      if (u) {
        setUser(u)
        loadAndApplyColor(id)
      }
    }
  }, [loadAndApplyColor])

  function login(userId: string) {
    document.cookie = `cza_user=${userId}; path=/; max-age=${60 * 60 * 24 * 30}`
    const u = getUserById(userId)
    if (u) {
      setUser(u)
      loadAndApplyColor(userId)
    }
  }

  function logout() {
    document.cookie = 'cza_user=; path=/; max-age=0'
    setUser(null)
    window.location.href = '/login'
  }

  function setAccentColor(hex: string) {
    if (!user) return
    setAccentColorState(hex)
    setColorForUser(user.id, hex)
    applyColor(hex)
  }

  return (
    <AuthContext.Provider value={{ user, accentColor, login, logout, setAccentColor }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
