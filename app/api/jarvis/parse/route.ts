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
          trepp_needed: { type: 'boolean' },
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
  // The mid-wizard "brain": decides what an ambiguous utterance means in the
  // middle of the guided call-log flow.
  wizard: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['answer', 'edit', 'goto', 'cancel', 'save', 'skip', 'clarify'],
        description: 'answer = the utterance answers the CURRENT question; edit = user wants a specific field set to a specific value (possibly a different field than the current question); goto = user wants to change a field but gave no value; cancel = abandon the whole log; save = confirm/save it; skip = no value for this optional field; clarify = genuinely cannot tell',
      },
      field: { type: ['string', 'null'], enum: ['log_type', 'outcome', 'summary', 'followup_date', 'sentiment', 'next_step', 'promises_made', 'client_id', null], description: 'For edit/goto: which field' },
      value: { type: ['string', 'null'], description: 'For answer/edit: the value. Enum fields must use their exact allowed value. Dates as YYYY-MM-DD (or "none" for no follow-up).' },
      time: { type: ['string', 'null'], description: 'HH:MM 24h if a time was mentioned with a date' },
      clarify: { type: ['string', 'null'], description: 'ONE short spoken question, max 10 words' },
    },
    required: ['action'],
  },
}

const FIELD_INSTRUCTIONS: Record<string, string> = {
  log_type: 'Determine what type of client contact the user is describing.',
  outcome: 'Determine the outcome of the call/contact the user is describing.',
  sentiment: "Determine the client's sentiment from the user's description. Note: close_ready means ready to BUY/sign up (positive). Phrases like 'about to walk', 'about to leave', 'about to quit', 'done with us' mean frustrated or angry — never close_ready.",
  date: 'Convert the spoken follow-up timing into a concrete date (and time if mentioned). "In a couple weeks" = 14 days. If they clearly want no follow-up, use date "none".',
  yes_no: 'Determine whether the user is confirming (true) or declining (false).',
  client: 'Match the transcript to one client from the provided list (names may be misheard by speech recognition — match phonetically similar names). Return the id.',
  status_flags: 'The user was asked if any client statuses should be flagged. Extract which flags they want set. Speech recognition mishears "Thatcher" as "that sure", "that chair", or "hatcher" — all of those mean thatcher_needed. "Trepp" gets misheard as "trap", "prep", or "tread" — those mean trepp_needed.',
  field_name: 'The user wants to edit a field of a call log. Determine which field.',
  wizard: 'Decide what the operator means. Be decisive — prefer answer/edit/cancel over clarify. Any variant of stop/scrap/delete/cancel/never mind means cancel. Meta-comments about the UI or venting ("pull up the thing", "wheres the window", "come on", "hurry up") are NOT answers — never record them into a field; use clarify (or repeat the question) instead.',
}

// Every transcript here came out of browser speech recognition — treat it as
// noisy audio, not as typed text.
const SPEECH_NOISE_RULES = `The transcript is from live speech recognition and is often garbled: homophones, dropped small words, wrong word boundaries, run-on sentences, no punctuation. Interpret what the operator MEANT, phonetically and from context — never take a suspicious word literally. Examples: "log a coal" = "log a call"; "text it him" = "texted him"; "close red е" = "close ready"; "follow up next to stay" = "follow up next Tuesday". Names are mangled constantly — match phonetically (Shepherd=Shepard, Kelly=Kelley=Kaylee). If 90% of the utterance clearly means one thing, commit to it with confidence "high".`

export async function POST(req: NextRequest) {
  const { field, transcript, context } = await req.json()

  const schema = FIELD_SCHEMAS[field]
  if (!schema || !transcript) {
    return NextResponse.json({ error: 'Invalid field or transcript' }, { status: 400 })
  }

  const contextBits: string[] = [`Today's date: ${context?.today ?? localToday()}.`]
  if (field === 'client' && context?.clientNames?.length) {
    contextBits.push(`Clients: ${JSON.stringify(context.clientNames)}`)
    if (Array.isArray(context?.alternatives) && context.alternatives.length) {
      contextBits.push(`The recognizer also heard these alternative transcripts of the same audio (any may contain the correct name): ${JSON.stringify(context.alternatives)}`)
    }
  }
  if (field === 'wizard') {
    contextBits.push(
      `The operator is mid-way through logging a client call. Current question: "${context?.prompt ?? ''}" (field: ${context?.step ?? 'unknown'}).`,
      `Draft so far: ${JSON.stringify(context?.draft ?? {})}.`,
      'Allowed values — log_type: call|text|meeting|email|voicemail|note; outcome: answered|voicemail|texted|no_answer|meeting_booked; sentiment: happy|neutral|confused|concerned|frustrated|angry|ghosting|close_ready; followup_date: YYYY-MM-DD or "none".',
      'Examples: "switch it to text" → edit log_type=text. "actually make the follow-up next monday" → edit followup_date. "none, delete it" / "scrap the whole thing" → cancel. "yeah save" → save. A description of what happened on the call → answer when the current field is summary/next_step/promises_made — keep the operator\'s wording and specifics, but silently fix obvious transcription garble (homophones, word-boundary errors) and add punctuation/capitalization. Never paraphrase or shorten.',
    )
  }

  try {
    const response = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: `You parse a single voice-transcribed answer from a busy sales operator into structured data. ${FIELD_INSTRUCTIONS[field]} ${SPEECH_NOISE_RULES} Be decisive — pick the closest match with confidence "high" unless genuinely ambiguous. Only use confidence "low" with a "clarify" question when you truly cannot decide. A clarify question is SPOKEN OUT LOUD, so it must be ONE short sentence of at most 10 words (e.g. "Sorry sir, which status was that?"). Never write paragraphs or lists. ${contextBits.join(' ')}`,
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
