import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'
import { callerIsReadOnly } from '@/lib/auth-server'

// AI "Current Situation" summary for one client. Summarizes the recent
// communication history WITHOUT paraphrasing away specifics — exact wording
// from the logs is preserved.

export const maxDuration = 30

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Regenerating the summary writes to the client row and burns model spend.
  if (await callerIsReadOnly()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = await createClient()
  const { id } = await params

  const [{ data: client }, { data: logs }] = await Promise.all([
    supabase.from('clients').select('*').eq('id', id).single(),
    supabase
      .from('communication_logs')
      .select('created_at, log_type, outcome, summary, sentiment, promises_made, objections, next_step, followup_date, created_by')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const now = Date.now()
  const relAge = (iso: string) => {
    const days = Math.floor((now - new Date(iso).getTime()) / 86400000)
    if (days <= 0) return 'TODAY'
    if (days === 1) return 'YESTERDAY'
    if (days < 7) return `${days} days ago`
    if (days < 30) return `${Math.round(days / 7)} weeks ago`
    return `${Math.round(days / 30)} months ago (OLD)`
  }

  const history = (logs ?? [])
    .map((l, i) => {
      const parts = [
        `${i === 0 ? '>>> MOST RECENT — ' : ''}[${relAge(l.created_at)}] ${l.log_type ?? 'note'}${l.outcome ? ` (${l.outcome})` : ''} by ${l.created_by ?? 'Diego'}`,
        l.summary ? `notes: "${l.summary}"` : '',
        l.sentiment ? `sentiment: ${l.sentiment}` : '',
        l.promises_made ? `action item: "${l.promises_made}"` : '',
        l.next_step ? `next step: "${l.next_step}"` : '',
        l.followup_date ? `follow-up set for ${l.followup_date}` : '',
      ].filter(Boolean)
      return parts.join(' · ')
    })
    .join('\n')

  if (!history) {
    return NextResponse.json({ summary: null, message: 'No communication history yet' })
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: `You write the "current situation" line for a client-success dashboard. This is a WHERE-THINGS-STAND-NOW readout, not a history recap.

RECENCY RULES (most important):
- The situation IS the most recent 1-2 contacts. Older entries exist only to explain how we got here — mention one only if it's load-bearing for what happens next.
- DROP RESOLVED ISSUES ENTIRELY. If a later entry shows something was fixed, done, or moved past (payment fixed, ads went live, call happened), it does not appear — not even as "was resolved".
- Entries marked OLD are stale context. Ignore them unless they describe something still open and unaddressed.
- This is NOT a catch-all. Pick the 1-3 most salient live points: what's blocking, what's promised, what happens next. Skip routine no-news entries.

STYLE:
- 1-3 short sentences. Current state first.
- PRESERVE EXACT PHRASING for what you do include: when a log says something a specific way, re-use those exact words in quotes rather than generalizing. Never blur specifics into vague language.
- Include concrete commitments, dates, and who owes what — for LIVE items only.
- No preamble, no headers — just the summary.`,
      messages: [{
        role: 'user',
        content: `Client: ${client.name}${client.business_name ? ` (${client.business_name})` : ''} — stage: ${client.stage}
Recent communication log (newest first):
${history}`,
      }],
    })

    const block = response.content[0]
    const summary = block?.type === 'text' ? block.text.trim() : null
    if (!summary) throw new Error('empty response')

    const updatedAt = new Date().toISOString()
    await supabase
      .from('clients')
      .update({ ai_situation_summary: summary, ai_summary_updated_at: updatedAt })
      .eq('id', id)

    return NextResponse.json({ summary, updated_at: updatedAt })
  } catch (err) {
    console.error('[situation]', err)
    return NextResponse.json({ error: 'Summary generation failed' }, { status: 502 })
  }
}
