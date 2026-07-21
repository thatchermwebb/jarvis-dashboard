'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { JARVISWidget } from '@/components/assistant/JARVISWidget'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  Phone,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Package,
  CalendarDays,
  CheckSquare,
  Users2,
  Menu,
  X,
  Search,
} from 'lucide-react'

const ALL_NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calls', label: 'Calls', icon: Phone },
  { href: '/clients', label: 'All Clients', icon: Users },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/ad-production', label: 'Fulfillment', icon: Package },
  { href: '/team', label: 'Team', icon: Users2 },
  { href: '/calendar', label: 'Calendar', icon: CalendarDays },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const VA_ALLOWED_HREFS = ['/clients', '/ad-production', '/tasks', '/team', '/settings']

// Primary tabs shown in the bottom bar; everything else lives in "More"
const TAB_HREFS = ['/', '/clients', '/team', '/payments']

export function MobileShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [search, setSearch] = useState('')
  const mainRef = useScrollRestoration<HTMLElement>()

  const navItems = user?.userType === 'va'
    ? ALL_NAV_ITEMS.filter(item => VA_ALLOWED_HREFS.includes(item.href))
    : ALL_NAV_ITEMS

  const tabs = navItems.filter(item => TAB_HREFS.includes(item.href))
  const moreItems = navItems.filter(item => !TAB_HREFS.includes(item.href))

  function isActive(href: string) {
    return pathname === href || (href !== '/' && pathname.startsWith(href))
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (search.trim()) {
      router.push(`/clients?search=${encodeURIComponent(search.trim())}`)
      setSearchOpen(false)
      setSearch('')
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* Top bar */}
      <header className="h-14 flex items-center gap-3 px-4 border-b border-border bg-sidebar/80 backdrop-blur-sm flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Logo" width={24} height={24} style={{ flexShrink: 0 }} />
          <span className="text-sm font-bold text-foreground tracking-tight">CZA</span>
        </div>
        <div className="flex-1" />
        <button onClick={() => setSearchOpen(true)} className="p-2 text-muted-foreground hover:text-foreground transition-colors">
          <Search className="w-4.5 h-4.5" />
        </button>
      </header>

      {/* Content */}
      <main ref={mainRef} className="flex-1 overflow-y-auto px-4 pt-4 pb-4">
        {children}
      </main>

      <JARVISWidget mobile />

      {/* Bottom tab bar */}
      <nav className="flex-shrink-0 flex items-stretch border-t border-sidebar-border bg-sidebar/95 backdrop-blur-sm" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {tabs.map(({ href, label, icon: Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 transition-colors',
                active ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium leading-none">{label}</span>
            </Link>
          )
        })}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center gap-0.5 py-2.5 text-muted-foreground"
        >
          <Menu className="w-5 h-5" />
          <span className="text-[10px] font-medium leading-none">More</span>
        </button>
      </nav>

      {/* Search sheet */}
      {searchOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center pt-20 px-4" onClick={() => setSearchOpen(false)}>
          <form onSubmit={handleSearch} className="w-full max-w-md bg-card border border-border rounded-2xl p-3 flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <Search className="w-4 h-4 text-muted-foreground flex-shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <button type="button" onClick={() => setSearchOpen(false)} className="text-muted-foreground">
              <X className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {/* More menu sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 flex flex-col justify-end" onClick={() => setMoreOpen(false)}>
          <div
            className="bg-card border-t border-border rounded-t-2xl p-4 space-y-1 max-h-[75vh] overflow-y-auto"
            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1rem)' }}
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-2 pb-2">
              <span className="text-xs font-semibold text-muted-foreground/60 uppercase tracking-wider">Menu</span>
              <button onClick={() => setMoreOpen(false)} className="text-muted-foreground">
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
            {navItems.map(({ href, label, icon: Icon }) => {
              const active = isActive(href)
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMoreOpen(false)}
                  className={cn(
                    'flex items-center gap-3 px-3 py-3 rounded-xl text-sm transition-colors',
                    active ? 'bg-primary/10 text-primary font-medium' : 'text-foreground hover:bg-secondary/50'
                  )}
                >
                  <Icon className="w-4.5 h-4.5" />
                  {label}
                </Link>
              )
            })}
            {user && (
              <>
                <div className="border-t border-border/40 my-2" />
                <div className="flex items-center gap-3 px-3 py-2">
                  <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
                    {user.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground truncate">{user.name}</div>
                    <div className="text-xs text-muted-foreground/60 truncate">{user.role}</div>
                  </div>
                  <button onClick={logout} className="text-muted-foreground/50 hover:text-foreground p-2">
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
