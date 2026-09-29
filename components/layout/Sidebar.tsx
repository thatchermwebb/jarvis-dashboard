'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { ASSOCIATE_ALLOWED_HREFS, SETTER_ALLOWED_HREFS, NO_PAYMENTS_HREFS } from '@/lib/auth'
import {
  LayoutDashboard,
  Phone,
  Users,
  CreditCard,
  BarChart3,
  Settings,
  LogOut,
  Package,
  CheckSquare,
  Users2,
  Megaphone,
  CalendarRange,
  ChevronRight,
} from 'lucide-react'

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
  children?: { href: string; label: string; icon: typeof LayoutDashboard }[]
}

const ALL_NAV_ITEMS: NavItem[] = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calls', label: 'Calls', icon: Phone },
  { href: '/clients', label: 'All Clients', icon: Users },
  { href: '/tasks', label: 'Tasks', icon: CheckSquare },
  { href: '/ad-production', label: 'Fulfillment', icon: Package },
  {
    href: '/media-buying',
    label: 'Media Buying',
    icon: Megaphone,
    children: [{ href: '/media-buying/monthly', label: 'Monthly Ad Update', icon: CalendarRange }],
  },
  { href: '/team', label: 'Team', icon: Users2 },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

const VA_ALLOWED_HREFS = ['/clients', '/ad-production', '/media-buying', '/tasks', '/team', '/settings']

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  // Parent hrefs whose sub-pages are expanded. A group opens itself when you
  // land on one of its sub-pages; otherwise the chevron toggles it.
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  useEffect(() => {
    const parent = ALL_NAV_ITEMS.find(i => i.children?.some(c => pathname.startsWith(c.href)))
    if (parent) setExpanded(prev => (prev.has(parent.href) ? prev : new Set(prev).add(parent.href)))
  }, [pathname])
  function toggle(href: string) {
    setExpanded(prev => {
      const next = new Set(prev)
      if (next.has(href)) next.delete(href)
      else next.add(href)
      return next
    })
  }

  const navItems = (user?.userType === 'va'
    ? ALL_NAV_ITEMS.filter(item => VA_ALLOWED_HREFS.includes(item.href))
    : user?.userType === 'associate'
    ? ALL_NAV_ITEMS.filter(item => ASSOCIATE_ALLOWED_HREFS.includes(item.href))
    : user?.userType === 'setter'
    ? ALL_NAV_ITEMS.filter(item => SETTER_ALLOWED_HREFS.includes(item.href))
    : ALL_NAV_ITEMS
  ).filter(item => !(user?.noPayments && NO_PAYMENTS_HREFS.includes(item.href)))

  return (
    <aside className="w-52 flex-shrink-0 flex flex-col h-screen bg-sidebar border-r border-sidebar-border">
      {/* Branding */}
      <div className="px-4 py-4 border-b border-sidebar-border">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Logo"
            width={28}
            height={28}
            style={{ filter: 'drop-shadow(0 0 4px rgba(0,229,176,0.5)) brightness(1.05)', flexShrink: 0 }}
          />
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-sm font-bold text-foreground tracking-tight">CZA</span>
              <span className="text-muted-foreground/40 text-xs">|</span>
              <span className="text-[10px] text-muted-foreground tracking-wide">Command Center</span>
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-5 px-4">
        <div className="sb-label text-[9px] font-semibold text-muted-foreground/40 tracking-widest uppercase mb-3 px-1">
          Navigation
        </div>
        <div className="flex flex-col">
          {navItems.map(({ href, label, icon: Icon, children }, i) => {
            const childActive = children?.some(c => pathname.startsWith(c.href)) ?? false
            const active = !childActive && (pathname === href || (href !== '/' && pathname.startsWith(href)))
            return (
              <div key={href}>
                {i > 0 && <div className="sb-divider border-t border-sidebar-border/40 mx-1" />}
                <div className="relative flex items-center">
                  <Link
                    href={href}
                    data-active={active || undefined}
                    className={cn(
                      'sb-link flex-1 flex items-center gap-3 px-2 py-2.5 rounded-md text-[15px] transition-all',
                      children && 'pr-8',
                      active
                        ? 'text-primary font-medium'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Icon className={cn('w-[17px] h-[17px] flex-shrink-0', active ? 'text-primary' : 'text-muted-foreground/60')} />
                    {label}
                  </Link>
                  {children && (
                    <button
                      type="button"
                      onClick={() => toggle(href)}
                      aria-expanded={expanded.has(href)}
                      aria-label={`${expanded.has(href) ? 'Collapse' : 'Expand'} ${label}`}
                      className="sb-toggle absolute right-1 p-1 rounded text-muted-foreground/60 hover:text-foreground hover:bg-foreground/5 transition-colors"
                    >
                      <ChevronRight className={cn('w-3.5 h-3.5 transition-transform duration-200', expanded.has(href) && 'rotate-90')} />
                    </button>
                  )}
                </div>
                {children && (
                  <div
                    className={cn(
                      'grid transition-[grid-template-rows,opacity] duration-200 ease-out',
                      expanded.has(href) ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                    )}
                  >
                    <div className="overflow-hidden">
                      <div className="sb-subgroup ml-[17px] pl-3 border-l border-sidebar-border mb-1.5">
                        {children.map(({ href: cHref, label: cLabel, icon: CIcon }) => {
                          const cActive = pathname.startsWith(cHref)
                          return (
                            <Link
                              key={cHref}
                              href={cHref}
                              tabIndex={expanded.has(href) ? undefined : -1}
                              data-active={cActive || undefined}
                              className={cn(
                                'sb-link sb-sublink flex items-center gap-2.5 px-2 py-2 rounded-md text-[13px] whitespace-nowrap transition-all',
                                cActive ? 'text-primary font-medium' : 'text-muted-foreground hover:text-foreground'
                              )}
                            >
                              <CIcon className={cn('w-[14px] h-[14px] flex-shrink-0', cActive ? 'text-primary' : 'text-muted-foreground/60')} />
                              {cLabel}
                            </Link>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* User footer */}
      {user && (
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="sb-avatar w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
              {user.initials}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-medium text-foreground truncate">{user.name.split(' ')[0]}</div>
              <div className="text-[10px] text-muted-foreground/60 truncate">{user.role}</div>
            </div>
            <button
              onClick={logout}
              className="text-muted-foreground/40 hover:text-muted-foreground transition-colors flex-shrink-0"
              title="Sign out"
            >
              <LogOut className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
