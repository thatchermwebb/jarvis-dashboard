import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'

// AI "Current Situation" summary for one client. Summarizes the recent
// communication history WITHOUT paraphrasing away specifics — exact wording
// from the logs is preserved.

export const maxDuration = 30

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
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

  const history = (logs ?? [])
    .map((l) => {
      const parts = [
        `[${new Date(l.created_at).toLocaleDateString()}] ${l.log_type ?? 'note'}${l.outcome ? ` (${l.outcome})` : ''} by ${l.created_by ?? 'Diego'}`,
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
      system: `You summarize a client's current situation for a client-success dashboard. Rules:
- 2-4 short sentences. Most recent state first, then the thread that led here.
- PRESERVE EXACT PHRASING: when a log says something a specific way (e.g. "need to get his human hook ads live send a text when they are live"), re-use those exact words in quotes rather than generalizing them. Never blur specifics into vague language.
- Include concrete commitments, dates, and who owes what.
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
