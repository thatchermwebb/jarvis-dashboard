'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'

/**
 * Persists and restores the scroll position of an inner scroll container across
 * client-side navigations (back/forward included). The whole app scrolls inside
 * a `<main class="overflow-y-auto">`, not the window, so Next's built-in
 * scroll restoration can't help — this fills that gap.
 *
 * Keyed by pathname in sessionStorage. Because list pages fetch their data on
 * mount, the saved offset may exceed the container height at first paint, so we
 * retry the restore over a short window until the content is tall enough.
 *
 * Usage: `const ref = useScrollRestoration<HTMLElement>(); <main ref={ref}>`
 */
export function useScrollRestoration<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const pathname = usePathname()

  // Save on scroll (throttled via rAF)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    let ticking = false
    const key = `scroll:${pathname}`
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => {
        try { sessionStorage.setItem(key, String(el.scrollTop)) } catch { /* quota / private mode */ }
        ticking = false
      })
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [pathname])

  // Restore on pathname change. List pages fetch on mount, so the content
  // isn't tall enough to scroll to the saved offset at first paint. Rather than
  // a fixed retry window (which loses the race when a fetch is slow), watch the
  // container for content growth and re-apply until the offset is reachable —
  // aborting if the user scrolls first.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const key = `scroll:${pathname}`
    let saved = 0
    try { saved = Number(sessionStorage.getItem(key)) || 0 } catch { saved = 0 }
    if (saved <= 0) { el.scrollTop = 0; return }

    let done = false
    const finish = () => {
      if (done) return
      done = true
      mo.disconnect()
      clearTimeout(timer)
      el.removeEventListener('wheel', onUser)
      el.removeEventListener('touchmove', onUser)
    }
    const apply = () => {
      if (done || !ref.current) return
      const node = ref.current
      node.scrollTop = saved // clamps to max while content is still growing
      if (node.scrollHeight - node.clientHeight >= saved) finish()
    }
    // A genuine user scroll (wheel/touch) means they've taken over — stop restoring.
    const onUser = () => finish()
    const mo = new MutationObserver(apply)
    const timer = setTimeout(finish, 5000) // safety cap

    mo.observe(el, { childList: true, subtree: true })
    el.addEventListener('wheel', onUser, { passive: true })
    el.addEventListener('touchmove', onUser, { passive: true })
    apply() // first attempt (content may already be present, e.g. cached)

    return finish
  }, [pathname])

  return ref
}
