'use client'

import { useEffect } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { toast } from 'sonner'
import { Handshake } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'

/**
 * On app open, if the signed-in user has any commissions due or overdue, raise
 * a single in-app notification that deep-links to the Affiliate Portal. Fires
 * once per browser session (per full load), not on every client-side nav.
 */
export function CommissionNotifier() {
  const router = useRouter()
  const pathname = usePathname()
  const { user } = useAuth()

  useEffect(() => {
    // The on-open notification is Thatcher's only. (The sidebar red dot still
    // shows for every admin / scoped affiliate.)
    if (user?.id !== 'thatcher') return
    if (pathname === '/affiliates') return
    try {
      if (sessionStorage.getItem('cza_comm_notified') === '1') return
    } catch { /* private mode */ }

    let cancelled = false
    fetch('/api/affiliate-commissions/alerts')
      .then(r => (r.ok ? r.json() : { count: 0 }))
      .then(({ count }) => {
        if (cancelled || !count) return
        try { sessionStorage.setItem('cza_comm_notified', '1') } catch { /* ignore */ }
        toast.custom(id => (
          <button
            onClick={() => { router.push('/affiliates'); toast.dismiss(id) }}
            className="flex items-center gap-3 w-[340px] max-w-[90vw] text-left rounded-xl border border-emerald-500/40 bg-card shadow-2xl px-4 py-3 hover:border-emerald-400/60 transition-colors"
          >
            <span className="w-9 h-9 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
              <Handshake className="w-4.5 h-4.5 text-emerald-400" />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground">
                {count} commission{count === 1 ? '' : 's'} due
              </span>
              <span className="block text-xs text-muted-foreground">
                Tap to review affiliate payouts &rarr;
              </span>
            </span>
          </button>
        ), { duration: 12000 })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [user, pathname, router])

  return null
}
