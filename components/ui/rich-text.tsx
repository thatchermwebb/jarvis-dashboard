'use client'

import { userColor } from '@/lib/auth'

// Minimal rich text used by call/contact notes: bold / italic / underline, plus
// @-mentions. Notes are authored in a contentEditable field (RichTextField, in
// LogCallDialog) that emits HTML from document.execCommand, and read back through
// <RichText>. Mentions are stored as <span data-mention="<userId>">@Name</span>;
// their color is derived from the user at render time, never trusted from storage.

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'div', 'p', 'span', 'ul', 'ol', 'li'])

/** Strip everything except basic formatting tags; keep only `data-mention` on spans. */
export function sanitizeRichText(html: string): string {
  if (!html) return ''
  let s = html.replace(/<\/?(?:script|style|iframe|object|embed)[^>]*>/gi, '')
  s = s.replace(/<(\/?)([a-zA-Z0-9]+)((?:\s[^>]*)?)>/g, (_m, close: string, tag: string, attrs: string) => {
    const t = tag.toLowerCase()
    if (!ALLOWED_TAGS.has(t)) return ''
    if (t === 'br') return '<br>'
    if (t === 'span' && !close) {
      const m = /data-mention\s*=\s*"([a-z0-9_-]+)"/i.exec(attrs || '')
      if (m) return `<span data-mention="${m[1].toLowerCase()}">`
    }
    return `<${close}${t}>`
  })
  return s
}

/** Re-apply each mention's user color (from our own map, so it's XSS-safe). */
export function styleMentions(html: string): string {
  return html.replace(/<span data-mention="([a-z0-9_-]+)">/g, (_m, id: string) =>
    `<span data-mention="${id}" style="color:${userColor(id)};font-weight:600">`)
}

/** Plain text of a rich value — used for empty checks and truncated previews. */
export function richTextToPlain(html: string): string {
  if (!html) return ''
  return html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim()
}

/** Read-only renderer for stored note HTML (with colored mentions). */
export function RichText({ html, className }: { html?: string | null; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: styleMentions(sanitizeRichText(html ?? '')) }} />
}
