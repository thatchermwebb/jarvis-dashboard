import { NextRequest, NextResponse } from 'next/server'
import { anthropic } from '@/lib/anthropic'
import { localToday } from '@/lib/utils'

// Fallback field parser for the JARVIS voice wizard — hit only when local
// keyword parsing misses. Fast haiku call with a forced tool so the output is
// always structured.

const FIELD_SCHEMAS: Record<string, object> = {
  log_type: {
    type: 'object',
    properties: {
      value: { type: ['string', 'null'], enum: ['call', 'text', 'meeting', 'email', 'voicemail', 'note', null] },
      confidence: { type: 'string', enum: ['high', 'low'] },
      clarify: { type: 'string', description: 'A short clarifying question to speak if the transcript is too ambiguous' },
    },
    required: ['value', 'confidence'],
  },
  outcome: {
    type: 'object',
    properties: {
      value: { type: ['string', 'null'], enum: ['answered', 'voicemail', 'texted', 'no_answer', 'meeting_booked', null] },
      confidence: { type: 'string', enum: ['high', 'low'] },
      clarify: { type: 'string' },
    },
    required: ['value', 'confidence'],
  },
  sentiment: {
    type: 'object',
    properties: {
      value: { type: ['string', 'null'], enum: ['happy', 'neutral', 'confused', 'concerned', 'frustrated', 'angry', 'ghosting', 'close_ready', null] },
      confidence: { type: 'string', enum: ['high', 'low'] },
      clarify: { type: 'string' },
    },
    required: ['value', 'confidence'],
  },
  date: {
    type: 'object',
    properties: {
      value: {
        type: ['object', 'null'],
        properties: {
          date: { type: 'string', description: 'YYYY-MM-DD, or the literal string "none" if the user wants no follow-up' },
          time: { type: ['string', 'null'], description: 'HH:MM 24-hour, if a time was mentioned' },
        },
        required: ['date'],
      },
      confidence: { type: 'string', enum: ['high', 'low'] },
      clarify: { type: 'string' },
    },
    required: ['value', 'confidence'],
  },
  yes_no: {
    type: 'object',
    properties: {
      value: { type: ['boolean', 'null'] },
      confidence: { type: 'string', enum: ['high', 'low'] },
      clarify: { type: 'string' },
    },
    required: ['value', 'confidence'],
  },
  client: {
    type: 'object',
    properties: {
      value: { type: ['string', 'null'], description: 'The id of the matching client from the provided list, or null' },
      confidence: { type: 'string', enum: ['high', 'low'] },
      clarify: { type: 'string' },
    },
    required: ['value', 'confidence'],
  },
  status_flags: {
    type: 'object',
    properties: {
      value: {
        type: ['object', 'null'],
        description: 'Flags the user wants set; omit keys they did not mention. null if they said nothing actionable.',
        properties: {
          stage: { type: 'string', enum: ['churn_risk'] },
          thatcher_needed: { type: 'boolean' },
          payment_issue: { type: 'boolean' },
          urgency_level: { type: 'string', enum: ['high'] },
          va_needed: { type: 'boolean' },
          new_ads: { type: 'boolean' },
          last_client_sentiment: { type: 'string', enum: ['close_ready'] },
        },
      },
      confidence: { type: 'string', enum: ['high', 'low'] },
      clarify: { type: 'string' },
    },
    required: ['value', 'confidence'],
  },
  field_name: {
    type: 'object',
    properties: {
      value: { type: ['string', 'null'], enum: ['client_id', 'log_type', 'outcome', 'summary', 'followup_date', 'sentiment', 'next_step', 'promises_made', null] },
      confidence: { type: 'string', enum: ['high', 'low'] },
      clarify: { type: 'string' },
    },
    required: ['value', 'confidence'],
  },
}

const FIELD_INSTRUCTIONS: Record<string, string> = {
  log_type: 'Determine what type of client contact the user is describing.',
  outcome: 'Determine the outcome of the call/contact the user is describing.',
  sentiment: "Determine the client's sentiment from the user's description. Note: close_ready means ready to BUY/sign up (positive). Phrases like 'about to walk', 'about to leave', 'about to quit', 'done with us' mean frustrated or angry — never close_ready.",
  date: 'Convert the spoken follow-up timing into a concrete date (and time if mentioned). "In a couple weeks" = 14 days. If they clearly want no follow-up, use date "none".',
  yes_no: 'Determine whether the user is confirming (true) or declining (false).',
  client: 'Match the transcript to one client from the provided list (names may be misheard by speech recognition — match phonetically similar names). Return the id.',
  status_flags: 'The user was asked if any client statuses should be flagged. Extract which flags they want set.',
  field_name: 'The user wants to edit a field of a call log. Determine which field.',
}

export async function POST(req: NextRequest) {
  const { field, transcript, context } = await req.json()

  const schema = FIELD_SCHEMAS[field]
  if (!schema || !transcript) {
    return NextResponse.json({ error: 'Invalid field or transcript' }, { status: 400 })
  }

  const contextBits: string[] = [`Today's date: ${context?.today ?? localToday()}.`]
  if (field === 'client' && context?.clientNames?.length) {
    contextBits.push(`Clients: ${JSON.stringify(context.clientNames)}`)
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: `You parse a single voice-transcribed answer from a busy sales operator into structured data. ${FIELD_INSTRUCTIONS[field]} Be decisive — pick the closest match with confidence "high" unless genuinely ambiguous. Only use confidence "low" with a "clarify" question when you truly cannot decide. ${contextBits.join(' ')}`,
      messages: [{ role: 'user', content: `Transcript: "${transcript}"` }],
      tools: [{ name: 'submit_parse', description: 'Submit the parsed value', input_schema: schema as never }],
      tool_choice: { type: 'tool', name: 'submit_parse' },
    })

    const toolUse = response.content.find(b => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') {
      return NextResponse.json({ value: null, confidence: 'low' })
    }
    return NextResponse.json(toolUse.input)
  } catch (err) {
    console.error('[jarvis/parse]', err)
    return NextResponse.json({ value: null, confidence: 'low' }, { status: 500 })
  }
}
