'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { userColor } from '@/lib/auth'

// Minimal rich text used by call/contact notes: bold / italic / underline,
// @-mentions, and inline images. Notes are authored in a contentEditable field
// (RichTextField, in LogCallDialog) that emits HTML from document.execCommand,
// and read back through <RichText>. Mentions are stored as
// <span data-mention="<userId>">@Name</span>; their color is derived from the
// user at render time, never trusted from storage. Images are stored as
// <img src="<url>"> and only a safe src survives sanitizing.

const ALLOWED_TAGS = new Set(['b', 'strong', 'i', 'em', 'u', 'br', 'div', 'p', 'span', 'ul', 'ol', 'li', 'img'])

/** Keep only a safe image src: our https storage URLs, root-relative paths, or
 *  inline data:image. Blocks javascript:, protocol-relative //host, etc. */
function safeImgSrc(attrs: string): string {
  const m = /\bsrc\s*=\s*"([^"]*)"/i.exec(attrs) || /\bsrc\s*=\s*'([^']*)'/i.exec(attrs)
  const src = (m ? m[1] : '').trim()
  if (!/^(https:\/\/|data:image\/|\/(?!\/))/i.test(src)) return ''
  return src.replace(/["'<>]/g, '')
}

/** Strip everything except basic formatting tags; keep `data-mention` on spans
 *  and a safe `src` on images. */
export function sanitizeRichText(html: string): string {
  if (!html) return ''
  let s = html.replace(/<\/?(?:script|style|iframe|object|embed)[^>]*>/gi, '')
  s = s.replace(/<(\/?)([a-zA-Z0-9]+)((?:\s[^>]*)?)>/g, (_m, close: string, tag: string, attrs: string) => {
    const t = tag.toLowerCase()
    if (!ALLOWED_TAGS.has(t)) return ''
    if (t === 'br') return '<br>'
    if (t === 'img') {
      if (close) return ''
      const src = safeImgSrc(attrs || '')
      return src ? `<img src="${src}">` : ''
    }
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

/** Give sanitized images their display styling + the zoomable hook class. */
function styleImages(html: string): string {
  return html.replace(/<img src="([^"]*)">/g, (_m, src: string) =>
    `<img src="${src}" class="rt-img" alt="attachment" ` +
    `style="max-width:min(340px,100%);max-height:300px;border-radius:10px;margin:6px 0;` +
    `display:block;cursor:zoom-in;border:1px solid rgba(255,255,255,0.08)" />`)
}

/** Plain text of a rich value — used for empty checks and truncated previews.
 *  An image counts as content so an image-only note isn't treated as empty. */
export function richTextToPlain(html: string): string {
  if (!html) return ''
  return html
    .replace(/<img\b[^>]*>/gi, ' [image] ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Read-only renderer for stored note HTML (colored mentions + zoomable images). */
export function RichText({ html, className }: { html?: string | null; className?: string }) {
  const [zoom, setZoom] = useState<string | null>(null)
  const out = styleMentions(styleImages(sanitizeRichText(html ?? '')))

  function onClick(e: React.MouseEvent) {
    const el = e.target as HTMLElement
    if (el instanceof HTMLImageElement && el.classList.contains('rt-img')) {
      e.stopPropagation()
      setZoom(el.currentSrc || el.src)
    }
  }

  return (
    <>
      <div className={className} onClick={onClick} dangerouslySetInnerHTML={{ __html: out }} />
      {zoom && typeof document !== 'undefined' && createPortal(
        <div
          onClick={() => setZoom(null)}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-6 cursor-zoom-out backdrop-blur-sm"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={zoom} alt="attachment" className="max-h-full max-w-full rounded-xl shadow-2xl" />
        </div>,
        document.body,
      )}
    </>
  )
}
