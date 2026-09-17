'use client'

import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { USERS, getUserById } from '@/lib/auth'
import {
  applyColor, applyBgColor,
  getColorForUser, setColorForUser, DEFAULT_COLOR,
  getBgColorForUser, setBgColorForUser, DEFAULT_BG,
  applySkin, getSkinForUser, setSkinForUser, DEFAULT_SKIN, type Skin,
} from '@/lib/themes'
import type { AppUser } from '@/lib/auth'

interface AuthContextType {
  user: AppUser | null
  accentColor: string
  bgColor: string
  skin: Skin
  login: (userId: string) => void
  logout: () => void
  setAccentColor: (hex: string) => void
  setBgColor: (hex: string) => void
  setSkin: (skin: Skin) => void
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  accentColor: DEFAULT_COLOR,
  bgColor: DEFAULT_BG,
  skin: DEFAULT_SKIN,
  login: () => {},
  logout: () => {},
  setAccentColor: () => {},
  setBgColor: () => {},
  setSkin: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null)
  const [accentColor, setAccentColorState] = useState<string>(DEFAULT_COLOR)
  const [bgColor, setBgColorState] = useState<string>(DEFAULT_BG)
  const [skin, setSkinState] = useState<Skin>(DEFAULT_SKIN)

  const loadAndApplyColors = useCallback((userId: string) => {
    const color = getColorForUser(userId)
    const bg = getBgColorForUser(userId)
    const sk = getSkinForUser(userId)
    setAccentColorState(color)
    setBgColorState(bg)
    setSkinState(sk)
    applyColor(color)
    applyBgColor(bg)
    applySkin(sk) // must run last — its inline vars override the bg palette
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
    // Midnight overrides the base palette — re-assert it so the picker doesn't
    // visually break the skin (the preference is still saved for when it's off).
    if (skin === 'midnight') applySkin('midnight')
  }

  function setSkin(next: Skin) {
    if (!user) return
    setSkinState(next)
    setSkinForUser(user.id, next)
    applySkin(next, getBgColorForUser(user.id), getColorForUser(user.id))
  }

  return (
    <AuthContext.Provider value={{ user, accentColor, bgColor, skin, login, logout, setAccentColor, setBgColor, setSkin }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
