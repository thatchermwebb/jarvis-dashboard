'use client'

import { useRef, useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

const ACCENT_PRESETS = [
  { name: 'Gold',    hex: '#c9a84c' },
  { name: 'Mint',    hex: '#00f4a1' },
  { name: 'Violet',  hex: '#7c3aed' },
  { name: 'Ocean',   hex: '#2563eb' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Crimson', hex: '#dc2626' },
  { name: 'Rose',    hex: '#e11d48' },
  { name: 'Cyan',    hex: '#0891b2' },
]

const BG_PRESETS = [
  { name: 'Void',       hex: '#0a0a0f' },
  { name: 'Dark Slate', hex: '#111116' },
  { name: 'Navy',       hex: '#0d1117' },
  { name: 'Deep Plum',  hex: '#120d1a' },
  { name: 'Forest',     hex: '#0d1410' },
  { name: 'Obsidian',   hex: '#13111a' },
  { name: 'Charcoal',   hex: '#171717' },
  { name: 'Midnight',   hex: '#0f1520' },
]

function ColorSection({
  title,
  description,
  presets,
  currentHex,
  onSelect,
}: {
  title: string
  description: string
  presets: { name: string; hex: string }[]
  currentHex: string
  onSelect: (hex: string) => void
}) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const [inputVal, setInputVal] = useState(currentHex.toUpperCase())

  // keep input in sync when currentHex changes from outside
  useEffect(() => {
    setInputVal(currentHex.toUpperCase())
  }, [currentHex])

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value
    setInputVal(raw)
    // apply immediately when valid 6-char hex (with or without #)
    const normalized = raw.startsWith('#') ? raw : `#${raw}`
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      onSelect(normalized)
    }
  }

  function handleInputBlur() {
    // on blur try to apply even partial input
    const normalized = inputVal.startsWith('#') ? inputVal : `#${inputVal}`
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      onSelect(normalized)
    } else {
      // reset to valid value
      setInputVal(currentHex.toUpperCase())
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').trim()
    const normalized = pasted.startsWith('#') ? pasted : `#${pasted}`
    setInputVal(normalized.toUpperCase())
    if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
      onSelect(normalized)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <div className="text-sm font-semibold text-foreground">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-2">
        {presets.map(({ name, hex }) => (
          <button
            key={hex}
            title={name}
            onClick={() => onSelect(hex)}
            className="relative w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
            style={{
              backgroundColor: hex,
              borderColor: currentHex.toLowerCase() === hex.toLowerCase() ? hex : 'transparent',
              boxShadow: currentHex.toLowerCase() === hex.toLowerCase()
                ? `0 0 0 2px #0a0a0f, 0 0 0 4px ${hex}`
                : 'none',
            }}
          />
        ))}
      </div>

      {/* Custom picker row */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => pickerRef.current?.click()}
          className="w-11 h-11 rounded-xl border-2 border-white/10 transition-all hover:scale-105 hover:border-white/20 shadow-lg flex-shrink-0"
          style={{ backgroundColor: currentHex }}
          title="Click to open color picker"
        />
        <input
          ref={pickerRef}
          type="color"
          value={currentHex}
          onChange={e => onSelect(e.target.value)}
          className="sr-only"
        />
        <div>
          <div className="text-xs text-muted-foreground mb-1">Custom hex</div>
          <input
            type="text"
            value={inputVal}
            onChange={handleInputChange}
            onBlur={handleInputBlur}
            onPaste={handlePaste}
            maxLength={7}
            placeholder="#000000"
            className="w-28 h-8 rounded-lg border border-border bg-secondary/50 px-3 text-sm font-mono text-foreground outline-none focus:border-primary/50"
          />
        </div>
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const { user, accentColor, bgColor, setAccentColor, setBgColor } = useAuth()

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Preferences and configuration</p>
      </div>

      {/* Account */}
      {user && (
        <div className="bg-card border border-border rounded-2xl p-6">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Account</h2>
          <div className="flex items-center gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-2"
              style={{ backgroundColor: `${accentColor}22`, borderColor: `${accentColor}55`, color: accentColor }}
            >
              {user.initials}
            </div>
            <div>
              <div className="text-lg font-semibold">{user.name}</div>
              <div className="text-sm text-muted-foreground">{user.role}</div>
            </div>
          </div>
        </div>
      )}

      {/* Theme Colors */}
      <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
        <div>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Theme Colors</h2>
          <p className="text-xs text-muted-foreground">
            Customize both your background and accent color. Saved to your profile per-user.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <ColorSection
            title="Accent Color"
            description="Applied to buttons, highlights, active states, and badges."
            presets={ACCENT_PRESETS}
            currentHex={accentColor}
            onSelect={setAccentColor}
          />

          <div className="border-t border-border/40" />

          <ColorSection
            title="Background Color"
            description="The base background of the entire app. Darker = more dramatic."
            presets={BG_PRESETS}
            currentHex={bgColor}
            onSelect={setBgColor}
          />
        </div>

        {/* Live preview */}
        <div className="mt-2 p-4 rounded-xl border border-border/50 space-y-3" style={{ backgroundColor: bgColor }}>
          <div className="text-xs text-muted-foreground uppercase tracking-wider mb-2">Preview</div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              className="px-4 py-2 rounded-lg text-sm font-medium"
              style={{ backgroundColor: accentColor, color: accentColor < '#888888' ? '#fff' : '#0a0a0a' }}
            >
              Log Call
            </button>
            <button
              className="px-4 py-2 rounded-lg text-sm border"
              style={{ borderColor: `${accentColor}55`, color: accentColor }}
            >
              Add Client
            </button>
            <span className="text-sm font-medium" style={{ color: accentColor }}>Active nav item</span>
            <span
              className="text-xs px-2 py-1 rounded-full border font-medium"
              style={{ color: accentColor, borderColor: `${accentColor}44`, backgroundColor: `${accentColor}15` }}
            >
              Badge
            </span>
          </div>
        </div>
      </div>

      {/* Phase 2 */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Phase 2 Integrations</h2>
        <ul className="text-sm text-muted-foreground space-y-2">
          <li className="flex items-center gap-2"><span className="text-muted-foreground/40">—</span> GoHighLevel — auto-sync contacts, pipelines, conversations</li>
          <li className="flex items-center gap-2"><span className="text-muted-foreground/40">—</span> Meta Ads API — pull CPL, spend, leads daily</li>
          <li className="flex items-center gap-2"><span className="text-muted-foreground/40">—</span> Slack Webhooks — post VA tasks to channels</li>
          <li className="flex items-center gap-2"><span className="text-muted-foreground/40">—</span> Twilio — incoming call popup with instant client card</li>
        </ul>
      </div>
    </div>
  )
}
