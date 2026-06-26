'use client'

import { useRef, useState, useEffect } from 'react'
import { ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
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

const STAGE_OPTIONS = [
  { value: 'active_client',      label: 'Active Client' },
  { value: 'onboarding',         label: 'Onboarding' },
  { value: 'free_trial',         label: 'Free Trial (Active)' },
  { value: 'free_trial_pending', label: 'Free Trial (Pending)' },
  { value: 'trial_concluded',    label: 'Free Trial (Complete)' },
  { value: 'paused',             label: 'Paused' },
  { value: 'churned',            label: 'Churned' },
]

const FREQ_OPTIONS = [
  { value: 'monthly',   label: 'Monthly' },
  { value: 'bi_weekly', label: 'Bi-Weekly' },
  { value: 'weekly',    label: 'Weekly' },
  { value: 'one_time',  label: 'One-Time' },
]

function ImportExistingClients() {
  const [open, setOpen] = useState(false)
  const [saving, setSaving] = useState(false)
  const [imported, setImported] = useState(0)
  const blankForm = () => ({
    name: '', business_name: '', phone: '', email: '',
    market_location: '', timezone: '', stage: 'active_client',
    monthly_retainer: '', payment_frequency: 'monthly', client_since: '',
    deal_notes: '',
  })
  const [form, setForm] = useState(blankForm())

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Client name is required')
    if (!form.client_since) return toast.error('Client Since date is required — this prevents them appearing as a new deal')
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        import_mode: true,
        client_since: form.client_since,
        name: form.name.trim(),
        stage: form.stage,
      }
      if (form.business_name.trim()) payload.business_name = form.business_name.trim()
      if (form.phone.trim())         payload.phone = form.phone.trim()
      if (form.email.trim())         payload.email = form.email.trim()
      if (form.market_location.trim()) payload.market_location = form.market_location.trim()
      if (form.timezone.trim())      payload.timezone = form.timezone.trim()
      if (form.monthly_retainer)     payload.monthly_retainer = Number(form.monthly_retainer)
      if (form.payment_frequency)    payload.payment_frequency = form.payment_frequency
      if (form.deal_notes.trim())    payload.deal_notes = form.deal_notes.trim()

      const res = await fetch('/api/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed')
      }
      toast.success(`${form.name} imported`)
      setImported(n => n + 1)
      setForm(blankForm())
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl overflow-hidden">
      {/* Header — click to expand */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-white/3 transition-colors"
      >
        <div className="text-left">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Import Existing Clients</div>
          <div className="text-xs text-muted-foreground/60 mt-0.5">Add clients that were already active — won&apos;t count as new deals in reports</div>
        </div>
        <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="px-6 pb-6 border-t border-border/40">
          {imported > 0 && (
            <div className="mt-4 mb-5 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-400">
              {imported} client{imported !== 1 ? 's' : ''} imported this session
            </div>
          )}

          <p className="text-xs text-muted-foreground mt-4 mb-5 leading-relaxed">
            Set <span className="text-foreground font-medium">Client Since</span> to the actual date they became a client.
            This backdates the record so they don&apos;t show up in your &ldquo;Clients Signed&rdquo; chart for the current period.
          </p>

          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Client Name *</label>
                <input value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Smith"
                  className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Business Name</label>
                <input value={form.business_name} onChange={e => set('business_name', e.target.value)} placeholder="Pro Shine Detailing"
                  className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Phone</label>
                <input value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="(555) 123-4567"
                  className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email</label>
                <input value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com"
                  className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Stage</label>
                <select value={form.stage} onChange={e => set('stage', e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground outline-none focus:border-primary/50">
                  {STAGE_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monthly Retainer ($)</label>
                <input value={form.monthly_retainer} onChange={e => set('monthly_retainer', e.target.value)} placeholder="1000" type="number"
                  className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Frequency</label>
                <select value={form.payment_frequency} onChange={e => set('payment_frequency', e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground outline-none focus:border-primary/50">
                  {FREQ_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Market / Location</label>
                <input value={form.market_location} onChange={e => set('market_location', e.target.value)} placeholder="Houston, TX"
                  className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-primary uppercase tracking-wide">Client Since *</label>
                <input value={form.client_since} onChange={e => set('client_since', e.target.value)} type="date"
                  className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-primary/40 text-sm text-foreground outline-none focus:border-primary/70" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Deal Notes</label>
              <textarea value={form.deal_notes} onChange={e => set('deal_notes', e.target.value)}
                placeholder="Special pricing, context on the deal..."
                rows={2}
                className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 resize-none" />
            </div>

            <div className="flex items-center justify-between pt-1">
              <p className="text-[11px] text-muted-foreground/50">Submit another form to import more clients one by one.</p>
              <button type="submit" disabled={saving}
                className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50">
                {saving ? 'Importing...' : 'Import Client'}
              </button>
            </div>
          </form>
        </div>
      )}
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

      {/* Import Existing Clients */}
      <ImportExistingClients />

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
