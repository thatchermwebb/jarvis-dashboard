'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { USERS } from '@/lib/auth'
import { useAuth } from '@/contexts/AuthContext'
import { cn } from '@/lib/utils'

const GREEN = '#00f4a1'
const GREEN_RGB = '0,244,161'

export default function LoginPage() {
  const { login } = useAuth()
  const router = useRouter()
  const [selected, setSelected] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function handleSelect(userId: string) {
    setSelected(userId)
    setPassword('')
    setError('')
  }

  function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    const user = USERS.find(u => u.id === selected)
    if (!user) return
    if (password !== user.password) {
      setError('Incorrect password')
      return
    }
    login(user.id)
    router.replace('/')
  }

  const selectedUser = USERS.find(u => u.id === selected)

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      {/* Logo + Branding */}
      <div className="mb-10 flex flex-col items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/logo.png"
          alt="Detailing Accelerator"
          width={275}
          height={275}
          style={{ display: 'block' }}
        />
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground tracking-tight">CZA</div>
          <div className="text-xs text-muted-foreground tracking-widest uppercase mt-0.5">Command Center</div>
        </div>
      </div>

      <div className="w-full max-w-md space-y-6">
        <p className="text-sm text-muted-foreground text-center">Select your profile to continue</p>

        {/* User cards */}
        <div className="grid grid-cols-3 gap-3">
          {USERS.map(user => (
            <button
              key={user.id}
              onClick={() => handleSelect(user.id)}
              className={cn(
                'flex flex-col items-center gap-3 p-5 rounded-2xl border transition-all',
                selected === user.id
                  ? 'border-border bg-card'
                  : 'border-border bg-card hover:bg-card/80'
              )}
              style={{
                borderColor: selected === user.id ? `rgba(${GREEN_RGB},0.5)` : undefined,
                boxShadow: selected === user.id
                  ? `0 0 0 1px rgba(${GREEN_RGB},0.3), 0 0 20px rgba(${GREEN_RGB},0.15), 0 0 40px rgba(${GREEN_RGB},0.08)`
                  : `0 0 12px rgba(${GREEN_RGB},0.06), 0 0 4px rgba(${GREEN_RGB},0.04)`,
              }}
              onMouseEnter={e => {
                if (selected !== user.id) {
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 0 1px rgba(${GREEN_RGB},0.2), 0 0 24px rgba(${GREEN_RGB},0.18), 0 0 48px rgba(${GREEN_RGB},0.08)`
                  ;(e.currentTarget as HTMLElement).style.borderColor = `rgba(${GREEN_RGB},0.25)`
                }
              }}
              onMouseLeave={e => {
                if (selected !== user.id) {
                  (e.currentTarget as HTMLElement).style.boxShadow = `0 0 12px rgba(${GREEN_RGB},0.06), 0 0 4px rgba(${GREEN_RGB},0.04)`
                  ;(e.currentTarget as HTMLElement).style.borderColor = ''
                }
              }}
            >
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold transition-colors"
                style={selected === user.id
                  ? { backgroundColor: GREEN, color: '#0a0a0f' }
                  : { backgroundColor: 'var(--secondary)', color: 'var(--muted-foreground)' }
                }
              >
                {user.initials}
              </div>
              <div className="text-center">
                <div className="text-sm font-semibold text-foreground leading-tight">{user.name.split(' ')[0]}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{user.role}</div>
              </div>
            </button>
          ))}
        </div>

        {/* Password form */}
        {selected && (
          <form onSubmit={handleLogin} className="space-y-4 pt-2">
            <div className="text-center text-sm text-muted-foreground">
              Signing in as <span className="text-foreground font-medium">{selectedUser?.name}</span>
            </div>
            <div className="space-y-2">
              <input
                type="password"
                value={password}
                onChange={e => { setPassword(e.target.value); setError('') }}
                placeholder="Password"
                autoFocus
                className="w-full h-12 rounded-xl border bg-card px-4 text-base text-foreground placeholder:text-muted-foreground outline-none transition-all"
                style={{ borderColor: `rgba(${GREEN_RGB},0.3)` }}
                onFocus={e => { e.currentTarget.style.borderColor = `rgba(${GREEN_RGB},0.6)`; e.currentTarget.style.boxShadow = `0 0 0 1px rgba(${GREEN_RGB},0.2)` }}
                onBlur={e => { e.currentTarget.style.borderColor = `rgba(${GREEN_RGB},0.3)`; e.currentTarget.style.boxShadow = 'none' }}
              />
              {error && <p className="text-sm text-red-400 text-center">{error}</p>}
            </div>
            <button
              type="submit"
              className="w-full h-12 rounded-xl font-semibold text-sm transition-all"
              style={{ backgroundColor: GREEN, color: '#0a0a0f' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = '0.9' }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = '1' }}
            >
              Sign In
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
