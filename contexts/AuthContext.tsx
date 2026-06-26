'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { USERS, getUserById } from '@/lib/auth'
import {
  applyColor, applyBgColor,
  getColorForUser, setColorForUser, DEFAULT_COLOR,
  getBgColorForUser, setBgColorForUser, DEFAULT_BG,
} from '@/lib/themes'
import type { AppUser } from '@/lib/auth'

interface AuthContextType {
  user: AppUser | null
  accentColor: string
  bgColor: string
  login: (userId: string) => void
  logout: () => void
  setAccentColor: (hex: string) => void
  setBgColor: (hex: string) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  accentColor: DEFAULT_COLOR,
  bgColor: DEFAULT_BG,
  login: () => {},
  logout: () => {},
  setAccentColor: () => {},
  setBgColor: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [accentColor, setAccentColorState] = useState<string>(DEFAULT_COLOR)
  const [bgColor, setBgColorState] = useState<string>(DEFAULT_BG)

  const loadAndApplyColors = useCallback((userId: string) => {
    const color = getColorForUser(userId)
    const bg = getBgColorForUser(userId)
    setAccentColorState(color)
    setBgColorState(bg)
    applyColor(color)
    applyBgColor(bg)
  }, [])

  useEffect(() => {
    const match = document.cookie.match(/cza_user=([^;]+)/)
    const id = match?.[1]
    if (id) {
      const u = getUserById(id)
      if (u) {
        setUser(u)
        loadAndApplyColors(id)
      }
    }
  }, [loadAndApplyColors])

  function login(userId: string) {
    document.cookie = `cza_user=${userId}; path=/; max-age=${60 * 60 * 24 * 30}`
    const u = getUserById(userId)
    if (u) {
      setUser(u)
      loadAndApplyColors(userId)
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

  function setBgColor(hex: string) {
    if (!user) return
    setBgColorState(hex)
    setBgColorForUser(user.id, hex)
    applyBgColor(hex)
  }

  return (
    <AuthContext.Provider value={{ user, accentColor, bgColor, login, logout, setAccentColor, setBgColor }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
