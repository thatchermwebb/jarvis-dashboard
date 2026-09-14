'use client'

// Minimal rich text used by call/contact notes: bold / italic / underline only.
// Notes are authored in a contentEditable field (RichTextField, in LogCallDialog)
// that emits HTML from document.execCommand, and read back through <RichText>.

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'div', 'p', 'span', 'ul', 'ol', 'li'])

/** Strip everything except basic formatting tags + drop all attributes (no XSS surface). */
export function sanitizeRichText(html: string): string {
  if (!html) return ''
  let s = html.replace(/<\/?(?:script|style|iframe|object|embed)[^>]*>/gi, '')
  s = s.replace(/<(\/?)([a-zA-Z0-9]+)(?:\s[^>]*)?>/g, (_m, close: string, tag: string) => {
    const t = tag.toLowerCase()
    if (!ALLOWED_TAGS.has(t)) return ''
    if (t === 'br') return '<br>'
    return `<${close}${t}>`
  })
  return s
}

/** Plain text of a rich value — used for empty checks and truncated previews. */
export function richTextToPlain(html: string): string {
  if (!html) return ''
  return html.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim()
}

/** Read-only renderer for stored note HTML. */
export function RichText({ html, className }: { html?: string | null; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizeRichText(html ?? '') }} />
}
