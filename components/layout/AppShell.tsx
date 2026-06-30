'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileShell } from './MobileShell'
import { JARVISWidget } from '@/components/assistant/JARVISWidget'
import { useIsMobile } from '@/hooks/useIsMobile'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMobile = useIsMobile()

  if (pathname === '/login') {
    return <>{children}</>
  }

  if (isMobile) {
    return <MobileShell>{children}</MobileShell>
  }

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      <JARVISWidget />
    </div>
  )
}
