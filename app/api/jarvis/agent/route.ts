import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic, buildJARVISSystemPrompt } from '@/lib/anthropic'
import { localToday } from '@/lib/utils'
import { matchClients } from '@/lib/voice/localParsers'
import type Anthropic from '@anthropic-ai/sdk'
import type { Client } from '@/types'

// JARVIS agent brain — tool-use loop over live CZA data. Voice-facing, so
// replies are short spoken sentences; performed actions are returned in
// `actions` for the UI to toast.

export const maxDuration = 60

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'search_clients',
    description: 'Search clients by name, business name, phone, or email. Use when you need a client id or to check a specific client.',
    input_schema: {
      type: 'object',
      properties: { term: { type: 'string' } },
      required: ['term'],
    },
  },
  {
    name: 'get_metrics',
    description: 'Get live operational metrics: active clients, follow-ups due today, overdue follow-ups, trials ending this week, open tasks per assignee, MRR.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'create_task',
    description: 'Create a task. assigned_to must be one of Diego, Thatcher, Trepp. If the task is about a specific client, pass client_name so it gets linked.',
    input_schema: {
      type: 'object',
      properties: {
        title: { type: 'string' },
        assigned_to: { type: 'string', enum: ['Diego', 'Thatcher', 'Trepp'] },
        client_name: { type: 'string' },
        due_date: { type: 'string', description: 'YYYY-MM-DD' },
        due_time: { type: 'string', description: 'HH:MM 24-hour' },
        priority: { type: 'string', enum: ['urgent', 'high', 'medium', 'low'] },
        notes: { type: 'string' },
      },
      required: ['title', 'assigned_to'],
    },
  },
  {
    name: 'update_client_flags',
    description: 'Set status flags on a client (get the client_id from search_clients first).',
    input_schema: {
      type: 'object',
      properties: {
        client_id: { type: 'string' },
        payment_issue: { type: 'boolean' },
        thatcher_needed: { type: 'boolean' },
        trepp_needed: { type: 'boolean' },
        urgency_level: { type: 'string', enum: ['high', 'low'] },
        va_needed: { type: 'boolean' },
        new_ads: { type: 'boolean' },
        stage: { type: 'string', enum: ['churn_risk'] },
        last_client_sentiment: { type: 'string', enum: ['close_ready', 'neutral'] },
      },
      required: ['client_id'],
    },
  },
  {
    name: 'get_client_details',
    description: 'Get the full record for one client (all fields: trial dates, ads metrics, sentiment, follow-up, payment, links).',
    input_schema: {
      type: 'object',
      properties: { client_id: { type: 'string' } },
      required: ['client_id'],
    },
  },
  {
    name: 'start_call_log',
    description: 'Open the guided call-log wizard on screen. Call this whenever the user wants to record/log/jot down a contact they had (a call, text, meeting, note, email, voicemail) — ANY phrasing counts: "log and text with X", "put in a note for X", "lock a call with X", "log my meeting". Do NOT compose a message or answer questions instead of logging.',
    input_schema: {
      type: 'object',
      properties: {
        log_type: { type: 'string', enum: ['call', 'text', 'meeting', 'email', 'voicemail', 'note'] },
        client_name: { type: 'string', description: 'The client name as the user said it (will be fuzzy-resolved)' },
      },
    },
  },
  {
    name: 'remember',
    description: 'Save a durable memory about the current user: preferences, standing instructions, stable facts. Use proactively when the user states something worth keeping — do not wait to be told "remember this".',
    input_schema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'The memory, written as a standalone fact' },
        category: { type: 'string', enum: ['preference', 'fact', 'client', 'instruction'] },
        client_name: { type: 'string', description: 'If the memory is about a specific client' },
      },
      required: ['content'],
    },
  },
  {
    name: 'forget',
    description: 'Deactivate a saved memory the user wants removed ("forget about X", "that\'s no longer true").',
    input_schema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Words identifying which memory to remove' } },
      required: ['query'],
    },
  },
]

type SupabaseClient = Awaited<ReturnType<typeof createClient>>
type AgentAction = { type: string; summary: string; data: unknown }

async function executeTool(
  supabase: SupabaseClient,
  name: string,
  input: Record<string, unknown>,
  user: string,
  actions: AgentAction[],
): Promise<unknown> {
  switch (name) {
    case 'search_clients': {
      const term = String(input.term ?? '')
      // Exact/substring hits first (also covers phone + email)
      const { data: exact } = await supabase
        .from('clients')
        .select('id, name, business_name, stage, next_followup_date, last_client_sentiment')
        .or(`name.ilike.%${term}%,business_name.ilike.%${term}%,phone.ilike.%${term}%,email.ilike.%${term}%`)
        .limit(8)
      if (exact && exact.length) return exact

      // Fuzzy fallback — voice input misspells names constantly
      // ("Shepherd" vs "Shepard"), so edit-distance match against the roster.
      const { data: all } = await supabase
        .from('clients')
        .select('id, name, business_name, stage, next_followup_date, last_client_sentiment')
        .neq('stage', 'churned')
      const fuzzy = matchClients(term, (all ?? []).map(c => ({ id: c.id, name: c.name, business_name: c.business_name })))
      const byId = new Map((all ?? []).map(c => [c.id, c]))
      return fuzzy.map(f => byId.get(f.id)).filter(Boolean)
    }

    case 'get_metrics': {
      const today = localToday()
      const [{ data: clients }, { data: tasks }] = await Promise.all([
        supabase.from('clients').select('stage, next_followup_date, trial_end, monthly_retainer, payment_issue, thatcher_needed'),
        supabase.from('tasks').select('assigned_to, status, due_date').neq('status', 'done'),
      ])
      const cs = (clients ?? []) as Pick<Client, 'stage' | 'next_followup_date' | 'trial_end' | 'monthly_retainer' | 'payment_issue' | 'thatcher_needed'>[]
      const notChurned = cs.filter(c => c.stage !== 'churned')
      const in7 = new Date(); in7.setDate(in7.getDate() + 7)
      const in7Str = `${in7.getFullYear()}-${String(in7.getMonth() + 1).padStart(2, '0')}-${String(in7.getDate()).padStart(2, '0')}`
      const openTasks = (tasks ?? []) as { assigned_to?: string; due_date?: string }[]
      const tasksByAssignee: Record<string, number> = {}
      for (const t of openTasks) {
        const a = t.assigned_to ?? 'Unassigned'
        tasksByAssignee[a] = (tasksByAssignee[a] ?? 0) + 1
      }
      return {
        active_clients: cs.filter(c => c.stage === 'active_client').length,
        free_trials: cs.filter(c => ['free_trial', 'free_trial_pending'].includes(c.stage)).length,
        followups_due_today: notChurned.filter(c => c.next_followup_date === today).length,
        overdue_followups: notChurned.filter(c => c.next_followup_date && c.next_followup_date < today).length,
        trials_ending_this_week: notChurned.filter(c => c.trial_end && c.trial_end >= today && c.trial_end <= in7Str).length,
        payment_issues: cs.filter(c => c.payment_issue).length,
        thatcher_needed: cs.filter(c => c.thatcher_needed).length,
        open_tasks_total: openTasks.length,
        open_tasks_by_assignee: tasksByAssignee,
        tasks_due_today: openTasks.filter(t => t.due_date === today).length,
        monthly_recurring_revenue: cs.filter(c => c.stage === 'active_client').reduce((s, c) => s + (c.monthly_retainer ?? 0), 0),
      }
    }

    case 'create_task': {
      let clientId: string | null = null
      let clientNote = ''
      if (input.client_name) {
        const term = String(input.client_name)
        let { data: matches } = await supabase
          .from('clients')
          .select('id, name, business_name')
          .or(`name.ilike.%${term}%,business_name.ilike.%${term}%`)
          .limit(3)
        if (!matches || matches.length === 0) {
          // Fuzzy fallback for misheard/misspelled names
          const { data: all } = await supabase
            .from('clients')
            .select('id, name, business_name')
            .neq('stage', 'churned')
          matches = matchClients(term, (all ?? [])).slice(0, 3) as typeof matches
        }
        if (matches && matches.length === 1) clientId = matches[0].id
        else if (matches && matches.length > 1) {
          return { error: 'multiple_client_matches', matches: matches.map(m => m.name), instruction: 'Ask the user which client they mean. Do not create the task yet.' }
        } else clientNote = ' (no matching client found — created unattached)'
      }

      const row: Record<string, unknown> = {
        title: input.title,
        client_id: clientId,
        assigned_to: input.assigned_to,
        due_date: input.due_date || null,
        due_time: input.due_time || null,
        priority: input.priority || null,
        notes: input.notes || null,
        status: 'open',
      }
      let { data, error } = await supabase.from('tasks').insert(row).select().single()
      if (error && /due_time/.test(error.message)) {
        // DB migration 006 not applied yet — fold the time into notes and retry
        delete row.due_time
        if (input.due_time) row.notes = [`Time: ${input.due_time}`, input.notes].filter(Boolean).join(' — ')
        ;({ data, error } = await supabase.from('tasks').insert(row).select().single())
      }
      if (error) return { error: error.message }

      if (clientId) {
        await supabase.from('timeline_events').insert({
          client_id: clientId,
          event_type: 'task_created',
          description: `Task created: ${input.title}`,
          created_by: user,
        })
      }
      actions.push({ type: 'task_created', summary: `Task for ${input.assigned_to}: ${input.title}`, data })
      return { success: true, task: data, note: clientNote || undefined }
    }

    case 'update_client_flags': {
      const { client_id, ...flags } = input
      const clean = Object.fromEntries(Object.entries(flags).filter(([, v]) => v !== undefined))
      if (!Object.keys(clean).length) return { error: 'No flags provided' }
      const { data, error } = await supabase
        .from('clients')
        .update(clean)
        .eq('id', client_id)
        .select('id, name')
        .single()
      if (error) return { error: error.message }
      actions.push({ type: 'flags_updated', summary: `Updated ${data.name}: ${Object.keys(clean).join(', ')}`, data: clean })
      return { success: true, client: data.name, updated: clean }
    }

    case 'get_client_details': {
      const { data, error } = await supabase
        .from('clients')
        .select('*')
        .eq('id', input.client_id)
        .single()
      if (error) return { error: error.message }
      return data
    }

    case 'start_call_log': {
      let clientId: string | null = null
      let clientName: string | null = null
      if (input.client_name) {
        const { data: all } = await supabase
          .from('clients')
          .select('id, name, business_name')
          .neq('stage', 'churned')
        const matches = matchClients(String(input.client_name), all ?? [])
        if (matches.length >= 1) {
          clientId = matches[0].id
          clientName = matches[0].name // canonical roster spelling
        }
      }
      actions.push({
        type: 'start_log_wizard',
        summary: `Opening the log${clientName ? ` for ${clientName}` : ''}`,
        data: { log_type: input.log_type ?? null, client_id: clientId, client_name: clientName },
      })
      return { success: true, client_name: clientName, note: 'The wizard is opening on screen. Reply with ONE short line acknowledging it.' }
    }

    case 'remember': {
      let clientId: string | null = null
      if (input.client_name) {
        const { data: all } = await supabase.from('clients').select('id, name, business_name').neq('stage', 'churned')
        const matches = matchClients(String(input.client_name), all ?? [])
        if (matches.length >= 1) clientId = matches[0].id
      }
      const { data, error } = await supabase
        .from('jarvis_memories')
        .insert({
          user_id: user,
          content: String(input.content),
          category: (input.category as string) || 'fact',
          client_id: clientId,
        })
        .select()
        .single()
      if (error) return { error: error.message.includes('jarvis_memories') ? 'Memory table not set up yet — run migration 008.' : error.message }
      actions.push({ type: 'memory_saved', summary: `Remembered: ${String(input.content).slice(0, 80)}`, data })
      return { success: true }
    }

    case 'forget': {
      const { data: memories, error } = await supabase
        .from('jarvis_memories')
        .select('id, content')
        .eq('user_id', user)
        .eq('active', true)
      if (error) return { error: error.message }
      const q = String(input.query).toLowerCase()
      const words = q.split(/\s+/).filter(w => w.length > 2)
      const scored = (memories ?? [])
        .map(m => ({ m, score: words.filter(w => m.content.toLowerCase().includes(w)).length }))
        .filter(s => s.score > 0)
        .sort((a, b) => b.score - a.score)
      if (!scored.length) return { error: 'No matching memory found', memories: (memories ?? []).map(m => m.content) }
      if (scored.length > 1 && scored[0].score === scored[1].score) {
        return { error: 'multiple_matches', matches: scored.slice(0, 3).map(s => s.m.content), instruction: 'Ask which one to forget.' }
      }
      await supabase.from('jarvis_memories').update({ active: false }).eq('id', scored[0].m.id)
      actions.push({ type: 'memory_forgotten', summary: `Forgot: ${scored[0].m.content.slice(0, 80)}`, data: scored[0].m })
      return { success: true, forgot: scored[0].m.content }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

export async function POST(req: NextRequest) {
  const { messages, user = 'sir', hint } = await req.json()
  if (!Array.isArray(messages) || !messages.length) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }

  const supabase = await createClient()
  // Trimmed columns + fewer rows keeps the prompt small so the model responds
  // faster; search_clients / get_client_details fetch full detail on demand.
  const [{ data: clients }, memoriesRes] = await Promise.all([
    supabase
      .from('clients')
      .select('id, name, business_name, stage, trial_end, cpl, leads, bookings, last_client_sentiment, payment_issue, next_followup_date, thatcher_needed')
      .neq('stage', 'churned')
      .order('updated_at', { ascending: false })
      .limit(30),
    supabase
      .from('jarvis_memories')
      .select('content, category, created_at')
      .eq('user_id', user)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(40),
  ])
  const memories = memoriesRes.data ?? [] // table may not exist yet — fine

  const memorySection = memories.length
    ? `\n\nSTANDING MEMORY (things you know about ${user} — apply them without being asked):\n${memories.map(m => `- [${m.category}] ${m.content}`).join('\n')}`
    : ''

  const system = `${buildJARVISSystemPrompt((clients ?? []) as Client[])}${memorySection}

VOICE MODE RULES:
- Today's date is ${localToday()}. The current user is ${user}.
- You are speaking out loud. Replies must be at most 2 short sentences — no lists, no markdown, no headers.
- USER MESSAGES ARE LIVE SPEECH TRANSCRIPTS and are often garbled: homophones, dropped words, wrong word boundaries, no punctuation. Interpret what they MEANT phonetically and from context, never literally — "log a coal for kelly" means "log a call for Kelly", "who's trial sending soon" means "whose trial's ending soon". If the intent is 90% clear, act on it without asking.
- PERSONALITY: You are JARVIS from Iron Man. Dry British wit, sharp, quietly amused, effortlessly competent. Address the user as "sir". Deadpan humor is encouraged — a well-placed quip beats a status report. Never obsequious, never corporate, never boring.
- Be CONVERSATIONAL. Small talk, banter, "how's it going" — play along with charm and wit, no tools needed. You are not a form; you are a personality. Never respond to casual chat by asking what they need.
- Never ask for clarification unless you were clearly asked to DO something and genuinely cannot determine what. When merely chatting or when a reasonable interpretation exists, just run with it.
- Use tools to act and to answer with real numbers — never guess figures.
- Voice transcription mangles names ("Shepherd" for "Shepard"). search_clients is fuzzy — trust its top match. If a search misses, retry ONCE with just the first 4-5 letters of the name before telling the user it's not found. If a fuzzy match is close (e.g. Shepherd→Shepard), assume it's them and proceed.
- CANONICAL NAMES: always write and speak client names using the exact spelling from the roster/tool results — never the transcript's spelling.
- LOGGING A CONTACT: if the user wants to record/log/note a contact they had — any phrasing — call start_call_log immediately. Do not draft messages, ask questions, or chat instead.
- AUTO-REMEMBER: when the user states durable info — a preference ("I like follow-ups in the afternoon"), a standing instruction ("always assign ad tasks to Trepp"), a stable fact — call remember proactively without being asked. Don't save one-off task details, things already in the CRM, or trivia. Acknowledge saves in four words or fewer inside your reply. Use forget when they retract something.
- When asked to create a task, resolve dates yourself (e.g. "tomorrow" = the day after today) and call create_task once with everything filled in. Convert times like "3pm" to 15:00.
- If a tool reports multiple_client_matches, ask which client they meant.
- If a tool returns an error, say so honestly (with wit, if it fits) — NEVER claim an action succeeded when the tool result contains an error.${hint === 'task' ? '\n- The user is asking to create a task. Extract title, assignee, date, time, priority and create it now.' : ''}`

  const conversation: Anthropic.MessageParam[] = messages.map((m: { role: string; content: string }) => ({
    role: m.role as 'user' | 'assistant',
    content: m.content,
  }))

  const actions: AgentAction[] = []

  try {
    for (let i = 0; i < 6; i++) {
      const response = await anthropic.messages.create({
        // Haiku: dramatically lower latency, still handles tool use + date math.
        // Replies are 1-2 sentences so the small model is plenty.
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        system,
        messages: conversation,
        tools: TOOLS,
      })

      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      if (!toolUses.length || response.stop_reason !== 'tool_use') {
        const text = response.content.filter(b => b.type === 'text').map(b => (b as Anthropic.TextBlock).text).join(' ').trim()
        return NextResponse.json({ reply: text || 'Done, sir.', actions })
      }

      conversation.push({ role: 'assistant', content: response.content })
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        const result = await executeTool(supabase, tu.name, tu.input as Record<string, unknown>, user, actions)
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) })
      }
      conversation.push({ role: 'user', content: results })
    }

    return NextResponse.json({ reply: "I'm afraid that took too many steps, sir. Could you rephrase?", actions })
  } catch (err) {
    console.error('[jarvis/agent]', err)
    const msg = String(err)
    const reply = /401|authentication|api[-_ ]?key|invalid x-api-key/i.test(msg)
      ? 'My Anthropic API key appears to be missing or invalid on this deployment, sir.'
      : /timeout|timed out|504|ETIMEDOUT/i.test(msg)
        ? 'That took too long, sir. Do try again.'
        : 'I hit a snag, sir. Do try again.'
    return NextResponse.json({ reply, actions, error: msg }, { status: 500 })
  }
}
