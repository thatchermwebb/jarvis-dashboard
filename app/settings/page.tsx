'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { useAuth } from '@/contexts/AuthContext'

const PRESET_COLORS = [
  { name: 'Gold',    hex: '#c9a84c' },
  { name: 'Violet',  hex: '#7c3aed' },
  { name: 'Ocean',   hex: '#2563eb' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Crimson', hex: '#dc2626' },
  { name: 'Rose',    hex: '#e11d48' },
  { name: 'Cyan',    hex: '#0891b2' },
  { name: 'Slate',   hex: '#64748b' },
]

export default function SettingsPage() {
  const { user, accentColor, setAccentColor } = useAuth()
  const pickerRef = useRef<HTMLInputElement>(null)

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

      {/* Accent color */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Accent Color</h2>
        <p className="text-xs text-muted-foreground mb-5">
          Pick any color — it applies to buttons, highlights, and active states. Saved to your profile.
        </p>

        {/* Presets row */}
        <div className="flex flex-wrap gap-2 mb-5">
          {PRESET_COLORS.map(({ name, hex }) => (
            <button
              key={hex}
              title={name}
              onClick={() => setAccentColor(hex)}
              className="relative w-8 h-8 rounded-full border-2 transition-all hover:scale-110"
              style={{
                backgroundColor: hex,
                borderColor: accentColor === hex ? hex : 'transparent',
                boxShadow: accentColor === hex ? `0 0 0 2px #0a0a0f, 0 0 0 4px ${hex}` : 'none',
              }}
            />
          ))}
        </div>

        {/* Custom picker */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {/* Color swatch — click to open native picker */}
            <button
              onClick={() => pickerRef.current?.click()}
              className="w-12 h-12 rounded-xl border-2 border-white/10 transition-all hover:scale-105 hover:border-white/20 shadow-lg"
              style={{ backgroundColor: accentColor }}
              title="Click to open color picker"
            />
            <input
              ref={pickerRef}
              type="color"
              value={accentColor}
              onChange={e => setAccentColor(e.target.value)}
              className="sr-only"
            />
          </div>
          <div className="flex-1">
            <div className="text-sm font-medium text-foreground mb-0.5">Custom color</div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={accentColor.toUpperCase()}
                onChange={e => {
                  const val = e.target.value
                  if (/^#[0-9a-fA-F]{6}$/.test(val)) setAccentColor(val)
                }}
                maxLength={7}
                className="w-28 h-8 rounded-lg border border-border bg-secondary/50 px-3 text-sm font-mono text-foreground outline-none focus:border-primary/50"
              />
              <span className="text-xs text-muted-foreground">Click the swatch or type a hex code</span>
            </div>
          </div>
        </div>

        {/* Live preview */}
        <div className="mt-5 p-4 rounded-xl border border-border/50 bg-secondary/20 space-y-3">
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
