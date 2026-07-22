'use client'

import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { MobileShell } from './MobileShell'
import { JARVISWidget } from '@/components/assistant/JARVISWidget'
import { JarvisProvider } from '@/components/assistant/JarvisProvider'
import { useIsMobile } from '@/hooks/useIsMobile'
import { useScrollRestoration } from '@/hooks/useScrollRestoration'
import { useAuth } from '@/contexts/AuthContext'

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isMobile = useIsMobile()
  const mainRef = useScrollRestoration<HTMLElement>()
  const { user } = useAuth()

  if (pathname === '/login') {
    return <>{children}</>
  }

  // Associates don't get JARVIS: the agent can read across the whole book,
  // which would bypass their affiliate scoping. (/api/jarvis is 403 for them.)
  const assistantEnabled = user?.userType !== 'associate'

  if (isMobile) {
    return assistantEnabled ? (
      <JarvisProvider>
        <MobileShell>{children}</MobileShell>
      </JarvisProvider>
    ) : (
      <MobileShell>{children}</MobileShell>
    )
  }

  const shell = (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar />
        <main ref={mainRef} className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
      {assistantEnabled && <JARVISWidget />}
    </div>
  )

  return assistantEnabled ? <JarvisProvider>{shell}</JarvisProvider> : shell
}
