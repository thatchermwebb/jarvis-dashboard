'use client'

import { useState, useEffect } from 'react'
import { X, ExternalLink, MapPin, Calendar, MessageSquare, Send } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { Client, AdProduction, CommunicationLog } from '@/types'

interface ClientWithAds extends Client {
  adProductions: AdProduction[]
}

interface Props {
  client: ClientWithAds
  onConfirm: (message: string) => Promise<void>
  onClose: () => void
}

export function StartFulfillmentModal({ client, onConfirm, onClose }: Props) {
  const name = client.business_name || client.name
  const defaultMessage = [
    `<!channel>`,
    `New Onboarding`,
    client.name,
    client.market_location || '',
  ].filter(Boolean).join('\n')

  const [message, setMessage] = useState(defaultMessage)
  const [sending, setSending] = useState(false)
  const [logs, setLogs] = useState<CommunicationLog[]>([])

  useEffect(() => {
    fetch(`/api/communication-logs?client_id=${client.id}`)
      .then(r => r.json())
      .then(d => setLogs(Array.isArray(d) ? d.slice(0, 6) : []))
      .catch(() => {})
  }, [client.id])

  async function handleSend() {
    setSending(true)
    try {
      await onConfirm(message)
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-card border border-border rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <div>
            <div className="text-xs text-muted-foreground uppercase tracking-wider mb-0.5">Start Fulfillment</div>
            <div className="text-base font-semibold text-foreground">{name}</div>
          </div>
          <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground transition-colors rounded-lg hover:bg-muted/30">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body — split panel */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">

          {/* Left — Slack message editor */}
          <div className="flex flex-col flex-1 p-5 border-b md:border-b-0 md:border-r border-border min-h-0">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2">
              <Send className="w-3.5 h-3.5" /> Slack Message
            </div>
            <div className="text-[10px] text-muted-foreground/60 mb-2">
              This will post to #operations. Edit before sending.
            </div>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="flex-1 min-h-[180px] bg-background/60 border border-border/60 rounded-xl px-4 py-3 text-sm text-foreground font-mono resize-none focus:outline-none focus:border-primary/50 transition-colors"
              placeholder="Slack message..."
            />
            <div className="mt-2 text-[10px] text-muted-foreground/40">
              Use &lt;!channel&gt; to notify the channel. Markdown supported (*bold*, _italic_).
            </div>
          </div>

          {/* Right — Client info */}
          <div className="w-full md:w-72 flex flex-col overflow-y-auto p-5 space-y-5 flex-shrink-0">
            <div>
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Client Info</div>
              <div className="space-y-2 text-sm">
                <div className="font-semibold text-foreground">{name}</div>
                {client.business_name && client.business_name !== client.name && (
                  <div className="text-muted-foreground text-xs">{client.name}</div>
                )}
                {client.market_location && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="w-3 h-3 flex-shrink-0" /> {client.market_location}
                  </div>
                )}
                {client.trial_start && client.trial_end && (
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    {formatDate(client.trial_start)} – {formatDate(client.trial_end)}
                  </div>
                )}
              </div>

              {/* Links */}
              {(client.ghl_location_link || client.campaign_link || client.ad_account_link) && (
                <div className="flex flex-wrap gap-1.5 mt-3">
                  {client.ghl_location_link && (
                    <a href={client.ghl_location_link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-violet-500/10 text-violet-400 border border-violet-500/20 hover:bg-violet-500/20 transition-colors">
                      <ExternalLink className="w-2.5 h-2.5" /> GHL
                    </a>
                  )}
                  {client.campaign_link && (
                    <a href={client.campaign_link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors">
                      <ExternalLink className="w-2.5 h-2.5" /> Campaign
                    </a>
                  )}
                  {client.ad_account_link && (
                    <a href={client.ad_account_link} target="_blank" rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[10px] px-2 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors">
                      <ExternalLink className="w-2.5 h-2.5" /> Ads
                    </a>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            {(client as any).notes && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Notes</div>
                <div className="text-xs text-foreground/80 bg-background/40 border border-border/40 rounded-xl px-3 py-2.5 leading-relaxed">
                  {(client as any).notes}
                </div>
              </div>
            )}

            {/* Recent call logs */}
            {logs.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <MessageSquare className="w-3 h-3" /> Recent Notes
                </div>
                <div className="space-y-2">
                  {logs.map(log => (
                    <div key={log.id} className="text-xs bg-background/40 border border-border/40 rounded-xl px-3 py-2.5">
                      <div className="text-[10px] text-muted-foreground/60 mb-1">
                        {(log.followup_date || log.created_at?.slice(0, 10))} · {log.log_type?.replace(/_/g, ' ')}
                      </div>
                      <div className="text-foreground/80 leading-relaxed line-clamp-3">
                        {log.summary || log.outcome || '—'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border flex-shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || !message.trim()}
            className="flex items-center gap-2 px-5 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 disabled:opacity-50 transition-all"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? 'Sending...' : 'Send & Start'}
          </button>
        </div>
      </div>
    </div>
  )
}
