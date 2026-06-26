'use client'

import { useState, useRef, useCallback } from 'react'
import { toast } from 'sonner'
import { Upload, FileText, X, Check, AlertTriangle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { cn } from '@/lib/utils'

// Map of our DB field → friendly label
const DB_FIELDS: { value: string; label: string }[] = [
  { value: 'skip', label: '— Skip —' },
  { value: 'name', label: 'Client Name *' },
  { value: 'business_name', label: 'Business Name' },
  { value: 'owner_name', label: 'Owner Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'email', label: 'Email' },
  { value: 'market_location', label: 'Market / Location' },
  { value: 'timezone', label: 'Timezone' },
  { value: 'stage', label: 'Stage' },
  { value: 'monthly_retainer', label: 'Monthly Retainer ($)' },
  { value: 'payment_frequency', label: 'Payment Frequency' },
  { value: 'trial_start', label: 'Trial Start Date' },
  { value: 'trial_end', label: 'Trial End Date' },
  { value: 'deal_notes', label: 'Deal Notes' },
  { value: 'last_call_summary', label: 'Last Call Summary' },
  { value: 'next_followup_date', label: 'Next Follow-Up Date' },
  { value: 'followup_reason', label: 'Follow-Up Reason' },
  { value: 'last_client_sentiment', label: 'Sentiment' },
  { value: 'urgency_level', label: 'Urgency Level' },
  { value: 'churn_risk_score', label: 'Churn Risk Score' },
  { value: 'google_drive_folder', label: 'Google Drive Link' },
]

// Auto-map Notion column headers to DB fields
const AUTO_MAP: Record<string, string> = {
  'name': 'name', 'client name': 'name', 'client': 'name', 'full name': 'name',
  'business': 'business_name', 'business name': 'business_name', 'company': 'business_name',
  'owner': 'owner_name', 'owner name': 'owner_name', 'contact': 'owner_name',
  'phone': 'phone', 'phone number': 'phone', 'mobile': 'phone',
  'email': 'email', 'email address': 'email',
  'location': 'market_location', 'market': 'market_location', 'city': 'market_location',
  'market / location': 'market_location', 'market/location': 'market_location',
  'timezone': 'timezone', 'tz': 'timezone',
  'stage': 'stage', 'status': 'stage',
  'retainer': 'monthly_retainer', 'monthly retainer': 'monthly_retainer', 'mrr': 'monthly_retainer', 'amount': 'monthly_retainer',
  'payment frequency': 'payment_frequency', 'billing': 'payment_frequency',
  'trial start': 'trial_start', 'trial start date': 'trial_start', 'start date': 'trial_start',
  'trial end': 'trial_end', 'trial end date': 'trial_end', 'end date': 'trial_end',
  'notes': 'deal_notes', 'deal notes': 'deal_notes', 'note': 'deal_notes',
  'summary': 'last_call_summary', 'call summary': 'last_call_summary',
  'follow up': 'next_followup_date', 'follow-up': 'next_followup_date', 'followup': 'next_followup_date',
  'sentiment': 'last_client_sentiment', 'mood': 'last_client_sentiment',
  'urgency': 'urgency_level',
  'churn risk': 'churn_risk_score', 'risk score': 'churn_risk_score',
  'drive': 'google_drive_folder', 'google drive': 'google_drive_folder',
}

function parseCSV(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }

  function parseLine(line: string): string[] {
    const cells: string[] = []
    let current = ''
    let inQuotes = false
    for (let i = 0; i < line.length; i++) {
      const ch = line[i]
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++ }
        else inQuotes = !inQuotes
      } else if (ch === ',' && !inQuotes) {
        cells.push(current.trim())
        current = ''
      } else {
        current += ch
      }
    }
    cells.push(current.trim())
    return cells
  }

  const headers = parseLine(lines[0])
  const rows = lines.slice(1).filter(l => l.trim()).map(parseLine)
  return { headers, rows }
}

function cleanValue(value: string, field: string): unknown {
  const v = value.trim()
  if (!v || v === '-' || v === 'N/A' || v === 'n/a') return null
  if (field === 'monthly_retainer' || field === 'churn_risk_score') {
    const n = parseFloat(v.replace(/[$,]/g, ''))
    return isNaN(n) ? null : n
  }
  return v
}

const STAGE_MAP: Record<string, string> = {
  'active': 'active_client', 'active client': 'active_client',
  'trial': 'free_trial', 'free trial': 'free_trial',
  'onboarding': 'onboarding',
  'churned': 'churned', 'churn': 'churned',
  'at risk': 'churn_risk', 'churn risk': 'churn_risk', 'at-risk': 'churn_risk',
  'payment issue': 'payment_issue',
  'paused': 'paused',
  'trial ending': 'trial_ending_soon', 'trial ending soon': 'trial_ending_soon',
  'trial concluded': 'trial_concluded', 'ready to close': 'trial_concluded',
  'won back': 'won_back',
}

export function ImportClientsDialog({ open, onClose, onImported }: {
  open: boolean; onClose: () => void; onImported: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<'upload' | 'map' | 'preview' | 'done'>('upload')
  const [headers, setHeaders] = useState<string[]>([])
  const [rows, setRows] = useState<string[][]>([])
  const [mapping, setMapping] = useState<Record<string, string>>({}) // csvHeader → dbField
  const [importing, setImporting] = useState(false)
  const [results, setResults] = useState({ ok: 0, failed: 0 })
  const [dragging, setDragging] = useState(false)

  function reset() {
    setStep('upload'); setHeaders([]); setRows([]); setMapping({}); setResults({ ok: 0, failed: 0 })
  }

  function handleFile(file: File) {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      toast.error('Please upload a CSV file')
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      const { headers: h, rows: r } = parseCSV(text)
      if (!h.length) return toast.error('Could not parse CSV — check the file format')
      setHeaders(h)
      setRows(r)
      // Auto-map
      const auto: Record<string, string> = {}
      h.forEach(header => {
        const key = header.toLowerCase().trim()
        auto[header] = AUTO_MAP[key] ?? 'skip'
      })
      setMapping(auto)
      setStep('map')
    }
    reader.readAsText(file)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }, [])

  async function runImport() {
    setImporting(true)
    let ok = 0, failed = 0

    for (const row of rows) {
      const payload: Record<string, unknown> = { stage: 'active_client' }
      headers.forEach((header, i) => {
        const field = mapping[header]
        if (!field || field === 'skip') return
        let val = cleanValue(row[i] ?? '', field)
        if (field === 'stage' && typeof val === 'string') {
          val = STAGE_MAP[val.toLowerCase()] ?? val
        }
        if (val !== null) payload[field] = val
      })
      if (!payload.name) { failed++; continue }

      try {
        const res = await fetch('/api/clients', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (res.ok) ok++; else failed++
      } catch { failed++ }
    }

    setResults({ ok, failed })
    setImporting(false)
    setStep('done')
    if (ok > 0) onImported()
  }

  const mappedToName = Object.values(mapping).includes('name')

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { reset(); onClose() } }}>
      <DialogContent className="w-[860px] max-w-[95vw] max-h-[90vh] overflow-y-auto bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-xl">Import Clients from CSV</DialogTitle>
        </DialogHeader>

        {/* STEP 1: Upload */}
        {step === 'upload' && (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">Export your Notion table as CSV, then upload it here. Columns are mapped automatically.</p>
            <div
              className={cn('border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors', dragging ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50')}
              onClick={() => inputRef.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
            >
              <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <div className="text-sm font-medium">Drop your CSV file here</div>
              <div className="text-xs text-muted-foreground mt-1">or click to browse</div>
              <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
            </div>
            <div className="text-xs text-muted-foreground bg-secondary/30 rounded-lg px-4 py-3">
              <strong>From Notion:</strong> Open your client table → ··· menu → Export → Export as CSV
            </div>
          </div>
        )}

        {/* STEP 2: Map columns */}
        {step === 'map' && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">{rows.length} rows found. Map your CSV columns to client fields below.</p>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setStep('upload')}>← Back</Button>
            </div>
            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
              {headers.map(header => (
                <div key={header} className="flex items-center gap-3 bg-secondary/20 rounded-lg px-3 py-2">
                  <div className="w-48 flex-shrink-0">
                    <div className="text-sm font-medium truncate">{header}</div>
                    <div className="text-xs text-muted-foreground truncate">{rows[0]?.[headers.indexOf(header)] ?? ''}</div>
                  </div>
                  <div className="text-muted-foreground text-xs">→</div>
                  <Select value={mapping[header] ?? 'skip'} onValueChange={v => setMapping(m => ({ ...m, [header]: v }) as Record<string, string>)}>
                    <SelectTrigger className="bg-secondary/50 h-8 text-xs flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DB_FIELDS.map(f => <SelectItem key={f.value} value={f.value} className="text-xs">{f.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {mapping[header] && mapping[header] !== 'skip' && <Check className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                </div>
              ))}
            </div>
            {!mappedToName && (
              <div className="flex items-center gap-2 text-xs text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 rounded-lg px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" /> Map at least one column to "Client Name" to import
              </div>
            )}
            <div className="flex justify-between items-center pt-1">
              <div className="text-xs text-muted-foreground">
                {Object.values(mapping).filter(v => v !== 'skip').length} columns mapped · {rows.length} clients to import
              </div>
              <Button disabled={!mappedToName} onClick={() => setStep('preview')}>Preview Import →</Button>
            </div>
          </div>
        )}

        {/* STEP 3: Preview */}
        {step === 'preview' && (
          <div className="mt-4 space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Preview of first 5 rows. Everything look right?</p>
              <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setStep('map')}>← Back</Button>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {headers.filter(h => mapping[h] && mapping[h] !== 'skip').map(h => (
                      <th key={h} className="text-left px-3 py-2 text-muted-foreground font-medium whitespace-nowrap">
                        {DB_FIELDS.find(f => f.value === mapping[h])?.label ?? mapping[h]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, ri) => (
                    <tr key={ri} className="border-b border-border/50 last:border-0">
                      {headers.filter(h => mapping[h] && mapping[h] !== 'skip').map(h => (
                        <td key={h} className="px-3 py-2 max-w-[180px] truncate">{row[headers.indexOf(h)] || '—'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {rows.length > 5 && <div className="text-xs text-muted-foreground text-center">+{rows.length - 5} more rows</div>}
            <div className="flex justify-between items-center pt-1">
              <div className="text-xs text-muted-foreground">{rows.length} clients will be imported</div>
              <Button onClick={runImport} disabled={importing}>
                {importing ? `Importing... (${rows.length} clients)` : `Import ${rows.length} Clients`}
              </Button>
            </div>
          </div>
        )}

        {/* STEP 4: Done */}
        {step === 'done' && (
          <div className="mt-8 text-center space-y-4 pb-4">
            <div className="text-4xl">{results.failed === 0 ? '🎉' : '⚠️'}</div>
            <div className="text-lg font-semibold">Import Complete</div>
            <div className="flex justify-center gap-6 text-sm">
              <div className="text-emerald-400"><span className="text-2xl font-bold block">{results.ok}</span>imported</div>
              {results.failed > 0 && <div className="text-red-400"><span className="text-2xl font-bold block">{results.failed}</span>failed (no name)</div>}
            </div>
            <div className="flex justify-center gap-2 pt-2">
              {results.failed > 0 && <Button variant="outline" onClick={reset}>Import Again</Button>}
              <Button onClick={() => { reset(); onClose() }}>Done</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
