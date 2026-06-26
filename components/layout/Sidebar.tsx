'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import {
  LayoutDashboard,
  Phone,
  Users,
  CreditCard,
  CheckSquare,
  BarChart3,
  Settings,
  LogOut,
} from 'lucide-react'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/calls', label: 'Calls', icon: Phone },
  { href: '/clients', label: 'All Clients', icon: Users },
  { href: '/payments', label: 'Payments', icon: CreditCard },
  { href: '/va-tasks', label: 'VA Tasks', icon: CheckSquare },
  { href: '/reports', label: 'Reports', icon: BarChart3 },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

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
        <div className="text-[9px] font-semibold text-muted-foreground/40 tracking-widest uppercase mb-3 px-1">
          Navigation
        </div>
        <div className="flex flex-col">
          {navItems.map(({ href, label, icon: Icon }, i) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href))
            return (
              <div key={href}>
                {i > 0 && <div className="border-t border-sidebar-border/40 mx-1" />}
                <Link
                  href={href}
                  className={cn(
                    'flex items-center gap-3 px-2 py-2.5 rounded-md text-[13px] transition-all',
                    active
                      ? 'text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <Icon className={cn('w-[15px] h-[15px] flex-shrink-0', active ? 'text-primary' : 'text-muted-foreground/60')} />
                  {label}
                </Link>
              </div>
            )
          })}
        </div>
      </nav>

      {/* User footer */}
      {user && (
        <div className="px-4 py-4 border-t border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-primary/20 border border-primary/30 flex items-center justify-center text-xs font-bold text-primary flex-shrink-0">
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
