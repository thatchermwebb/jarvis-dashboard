'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2, Copy, CheckCircle } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { Client, CloseBrief } from '@/types'

interface Props {
  open: boolean
  onClose: () => void
  client: Client
}

export function BriefGenerator({ open, onClose, client }: Props) {
  const [loading, setLoading] = useState(false)
  const [brief, setBrief] = useState<CloseBrief | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [form, setForm] = useState({
    main_pain: '',
    best_closing_angle: '',
    potential_objection: '',
    recommended_offer: client.monthly_retainer ? `$${client.monthly_retainer}/${client.payment_frequency ?? 'month'}` : '',
    diego_notes: '',
    results_summary: [
      client.leads ? `${client.leads} leads` : '',
      client.cpl ? `$${client.cpl} CPL` : '',
      client.phone_numbers_collected ? `${client.phone_numbers_collected} phone numbers` : '',
      client.bookings ? `${client.bookings} bookings` : '',
    ].filter(Boolean).join(', '),
    client_mood: client.last_client_sentiment ?? '',
  })

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/api/close-briefs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: client.id,
          generate_ai: true,
          ...form,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setBrief(data)
      toast.success('Brief generated')
    } catch (err) {
      toast.error('Failed to generate brief. Check your API key.')
    } finally {
      setLoading(false)
    }
  }

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text)
    setCopied(key)
    setTimeout(() => setCopied(null), 2000)
  }

  function CopyButton({ text, id }: { text: string; id: string }) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => copy(text, id)}
      >
        {copied === id ? <CheckCircle className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
      </Button>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle>
            ⭐ Thatcher Close Brief — {client.name}
          </DialogTitle>
        </DialogHeader>

        {!brief ? (
          <div className="space-y-4 mt-2">
            <div className="text-xs text-muted-foreground bg-secondary/30 rounded-md px-3 py-2">
              {[
                client.trial_start && `Trial: ${client.trial_start} – ${client.trial_end ?? 'TBD'}`,
                form.results_summary && `Results: ${form.results_summary}`,
                client.last_client_sentiment && `Mood: ${client.last_client_sentiment}`,
              ].filter(Boolean).join(' · ')}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Results Summary</Label>
                <Input value={form.results_summary} onChange={(e) => setForm((f) => ({ ...f, results_summary: e.target.value }))} placeholder="14 leads, $6 CPL, 6 phone numbers..." className="bg-secondary/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Client Mood</Label>
                <Input value={form.client_mood} onChange={(e) => setForm((f) => ({ ...f, client_mood: e.target.value }))} placeholder="positive, concerned, excited..." className="bg-secondary/50" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Main Pain / What They Want</Label>
              <Input value={form.main_pain} onChange={(e) => setForm((f) => ({ ...f, main_pain: e.target.value }))} placeholder="Wants consistent jobs without managing leads manually" className="bg-secondary/50" />
            </div>

            <div className="space-y-1.5">
              <Label>Best Closing Angle</Label>
              <Input value={form.best_closing_angle} onChange={(e) => setForm((f) => ({ ...f, best_closing_angle: e.target.value }))} placeholder="Already getting leads, just needs to continue to optimize" className="bg-secondary/50" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Likely Objection</Label>
                <Input value={form.potential_objection} onChange={(e) => setForm((f) => ({ ...f, potential_objection: e.target.value }))} placeholder="Price / family situation" className="bg-secondary/50" />
              </div>
              <div className="space-y-1.5">
                <Label>Recommended Offer</Label>
                <Input value={form.recommended_offer} onChange={(e) => setForm((f) => ({ ...f, recommended_offer: e.target.value }))} placeholder="$1k/month or $500/week" className="bg-secondary/50" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Diego Notes for Thatcher</Label>
              <Textarea value={form.diego_notes} onChange={(e) => setForm((f) => ({ ...f, diego_notes: e.target.value }))} placeholder="Anything else Thatcher needs to know..." className="bg-secondary/50 h-20" />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>Cancel</Button>
              <Button onClick={generate} disabled={loading} className="gap-1.5">
                {loading ? (
                  <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating...</>
                ) : (
                  '⭐ Generate with JARVIS'
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-2">
            <Tabs defaultValue="brief">
              <TabsList className="bg-secondary/50">
                <TabsTrigger value="brief" className="text-xs">Close Brief</TabsTrigger>
                <TabsTrigger value="client_text" className="text-xs">Client Text</TabsTrigger>
                <TabsTrigger value="script" className="text-xs">Call Script</TabsTrigger>
                <TabsTrigger value="objections" className="text-xs">Objections</TabsTrigger>
              </TabsList>

              {(['brief', 'client_text', 'script', 'objection_notes'] as const).map((key, i) => {
                const labels = ['Close Brief', 'Client Text', 'Call Script', 'Objection Notes']
                const contentKeys = ['brief', 'client_text', 'call_script', 'objection_notes'] as const
                const tabValues = ['brief', 'client_text', 'script', 'objections']
                const content = brief.generated_content?.[contentKeys[i]] ?? ''

                return (
                  <TabsContent key={tabValues[i]} value={tabValues[i]} className="mt-3">
                    <div className="relative">
                      <div className="absolute top-2 right-2">
                        <CopyButton text={content} id={tabValues[i]} />
                      </div>
                      <Textarea
                        value={content}
                        readOnly
                        className="bg-secondary/30 border-border h-64 text-sm leading-relaxed pr-8"
                      />
                    </div>
                  </TabsContent>
                )
              })}
            </Tabs>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setBrief(null)}>Edit & Regenerate</Button>
              <Button onClick={onClose}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
