import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'
import type { Client } from '@/types'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)
  const clientId = searchParams.get('client_id')

  let query = supabase
    .from('close_briefs')
    .select('*')
    .order('created_at', { ascending: false })

  if (clientId) query = query.eq('client_id', clientId)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const body = await req.json()
  const { client_id, generate_ai } = body

  // Fetch client data for AI generation
  let client: Client | null = null
  if (generate_ai && client_id) {
    const { data } = await supabase.from('clients').select('*').eq('id', client_id).single()
    client = data
  }

  let generatedContent = null
  if (generate_ai && client) {
    const prompt = `Generate a Thatcher close brief for this client:

Client: ${client.name} (${client.business_name ?? 'N/A'})
Stage: ${client.stage}
Trial: ${client.trial_start ?? 'N/A'} to ${client.trial_end ?? 'N/A'}
Results: ${client.leads ?? 0} leads, $${client.cpl ?? 0} CPL, ${client.phone_numbers_collected ?? 0} phone numbers, ${client.bookings ?? 0} bookings
Sentiment: ${client.last_client_sentiment ?? 'unknown'}
Last call summary: ${client.last_call_summary ?? 'None'}
Promises made: ${client.promises_made ?? 'None'}
Objections: ${client.objections ?? 'None'}
Retainer: $${client.monthly_retainer ?? 'unknown'}/month (${client.payment_frequency ?? 'monthly'})
Diego notes: ${body.diego_notes ?? 'None'}

Return a JSON object with these exact keys:
{
  "brief": "2-3 paragraph summary for Thatcher covering results, client mood, situation, and what to say",
  "client_text": "A text Diego can send to the client to get them on a close call with Thatcher (conversational, not salesy)",
  "objection_notes": "For each likely objection: what to say, what data to reference",
  "call_script": "Opening line and key talking points for the close call"
}`

    try {
      const msg = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }],
      })
      const text = msg.content[0].type === 'text' ? msg.content[0].text : ''
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        generatedContent = JSON.parse(jsonMatch[0])
      }
    } catch {
      // Fall through without AI content
    }
  }

  const insertData = {
    client_id,
    trial_dates: body.trial_dates ?? `${client?.trial_start ?? ''} – ${client?.trial_end ?? ''}`,
    results_summary: body.results_summary,
    client_mood: body.client_mood ?? client?.last_client_sentiment,
    main_pain: body.main_pain,
    best_closing_angle: body.best_closing_angle,
    potential_objection: body.potential_objection,
    recommended_offer: body.recommended_offer,
    diego_notes: body.diego_notes,
    generated_content: generatedContent,
  }

  const { data, error } = await supabase
    .from('close_briefs')
    .insert(insertData)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
