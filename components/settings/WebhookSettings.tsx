'use client'

import { useState, useEffect, useCallback } from 'react'
import { Webhook, Plus, Trash2, Send, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

interface Endpoint {
  id: string
  event: string
  url: string
  description: string | null
  enabled: boolean
  last_status: number | null
  last_delivered_at: string | null
  last_error: string | null
}

function StatusBadge({ ep }: { ep: Endpoint }) {
  if (ep.last_delivered_at == null) {
    return <span className="text-[10px] text-muted-foreground/50">never delivered</span>
  }
  const ok = ep.last_status != null && ep.last_status >= 200 && ep.last_status < 300
  const when = new Date(ep.last_delivered_at).toLocaleString()
  return (
    <span
      title={ep.last_error ? `${ep.last_error} · ${when}` : when}
      className={cn(
        'text-[10px] px-1.5 py-0.5 rounded border font-medium',
        ok
          ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20'
          : 'text-red-300 bg-red-500/10 border-red-500/20',
      )}
    >
      {ok ? `last: ${ep.last_status} OK` : `last: ${ep.last_status ?? 'failed'}`}
    </span>
  )
}

export function WebhookSettings() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>([])
  const [loading, setLoading] = useState(true)
  const [adding, setAdding] = useState(false)
  const [saving, setSaving] = useState(false)
  const [testingId, setTestingId] = useState<string | null>(null)
  const [form, setForm] = useState({ url: '', description: '', secret: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/webhooks')
      const data = await res.json()
      setEndpoints(Array.isArray(data) ? data : [])
    } catch {
      setEndpoints([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function add(e: React.FormEvent) {
    e.preventDefault()
    const url = form.url.trim()
    if (!/^https?:\/\/.+/i.test(url)) return toast.error('Enter a valid https:// URL')
    setSaving(true)
    try {
      const res = await fetch('/api/webhooks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, description: form.description, secret: form.secret }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed')
      toast.success('Webhook added')
      setForm({ url: '', description: '', secret: '' })
      setAdding(false)
      load()
    } catch (err) {
      toast.error(String(err))
    } finally {
      setSaving(false)
    }
  }

  async function toggle(ep: Endpoint) {
    // Optimistic flip.
    setEndpoints(prev => prev.map(e => (e.id === ep.id ? { ...e, enabled: !e.enabled } : e)))
    const res = await fetch(`/api/webhooks/${ep.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled: !ep.enabled }),
    })
    if (!res.ok) {
      setEndpoints(prev => prev.map(e => (e.id === ep.id ? { ...e, enabled: ep.enabled } : e)))
      toast.error('Could not update')
    }
  }

  async function remove(ep: Endpoint) {
    if (!confirm(`Delete this webhook?\n\n${ep.url}`)) return
    const res = await fetch(`/api/webhooks/${ep.id}`, { method: 'DELETE' })
    if (res.ok) {
      setEndpoints(prev => prev.filter(e => e.id !== ep.id))
      toast.success('Webhook deleted')
    } else {
      toast.error('Could not delete')
    }
  }

  async function sendTest(ep: Endpoint) {
    setTestingId(ep.id)
    try {
      const res = await fetch(`/api/webhooks/${ep.id}/test`, { method: 'POST' })
      const data = await res.json()
      if (data.ok) toast.success(`Test delivered — ${data.status} OK`)
      else toast.error(`Test failed — ${data.error ?? data.status ?? 'no response'}`)
      load()
    } catch {
      toast.error('Test failed')
    } finally {
      setTestingId(null)
    }
  }

  return (
    <div className="bg-card border border-border rounded-2xl p-6">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <Webhook className="w-3.5 h-3.5" /> Outbound Webhooks
        </h2>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-primary hover:opacity-80 transition-opacity"
          >
            <Plus className="w-3.5 h-3.5" /> Add endpoint
          </button>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
        POST a structured JSON payload to an external URL whenever a client has a new successful payment
        (<code className="text-foreground/80">payment.succeeded</code>). Use it with Zapier, Make, or any
        custom endpoint. Add a signing secret to verify requests via the{' '}
        <code className="text-foreground/80">X-CZA-Signature</code> header (HMAC-SHA256).
      </p>

      {adding && (
        <form onSubmit={add} className="mb-5 p-4 rounded-xl border border-border/60 bg-secondary/20 space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Endpoint URL *</label>
            <input
              value={form.url}
              onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder="https://hooks.zapier.com/..."
              className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Label</label>
              <input
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Zapier – new payment"
                className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Signing secret</label>
              <input
                value={form.secret}
                onChange={e => setForm(f => ({ ...f, secret: e.target.value }))}
                placeholder="optional"
                className="w-full h-10 px-3 rounded-xl bg-secondary/50 border border-border/50 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 font-mono"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setAdding(false); setForm({ url: '', description: '', secret: '' }) }}
              className="px-4 py-2 rounded-xl text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? 'Adding...' : 'Add webhook'}
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => <div key={i} className="h-16 bg-secondary/40 rounded-xl animate-pulse" />)}
        </div>
      ) : endpoints.length === 0 ? (
        !adding && (
          <div className="text-sm text-muted-foreground/60 bg-secondary/30 rounded-xl px-4 py-6 text-center">
            No webhooks yet. Add one to notify an external system on every successful payment.
          </div>
        )
      ) : (
        <div className="space-y-2">
          {endpoints.map(ep => (
            <div key={ep.id} className="flex items-start gap-3 px-3 py-3 rounded-xl bg-secondary/30 border border-border/40">
              {/* Enable toggle */}
              <button
                onClick={() => toggle(ep)}
                title={ep.enabled ? 'Enabled — click to pause' : 'Paused — click to enable'}
                className={cn(
                  'mt-0.5 relative w-9 h-5 rounded-full transition-colors flex-shrink-0',
                  ep.enabled ? 'bg-primary' : 'bg-secondary border border-border',
                )}
              >
                <span
                  className={cn(
                    'absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all',
                    ep.enabled ? 'left-[18px]' : 'left-0.5',
                  )}
                />
              </button>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground truncate">
                    {ep.description || ep.url}
                  </span>
                  <StatusBadge ep={ep} />
                  {!ep.enabled && (
                    <span className="text-[10px] text-muted-foreground/60 flex items-center gap-0.5">
                      <X className="w-3 h-3" /> paused
                    </span>
                  )}
                </div>
                {ep.description && (
                  <div className="text-[11px] text-muted-foreground/70 font-mono truncate mt-0.5">{ep.url}</div>
                )}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => sendTest(ep)}
                  disabled={testingId === ep.id}
                  title="Send a sample test event"
                  className="p-1.5 rounded-lg text-muted-foreground/60 hover:text-primary hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  {testingId === ep.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </button>
                <button
                  onClick={() => remove(ep)}
                  title="Delete webhook"
                  className="p-1.5 rounded-lg text-muted-foreground/40 hover:text-red-400 hover:bg-secondary transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
