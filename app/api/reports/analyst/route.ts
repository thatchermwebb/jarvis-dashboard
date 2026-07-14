import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { anthropic } from '@/lib/anthropic'
import { localToday } from '@/lib/utils'
import { paymentAudit, clientAnalyticsRows, monthlyBusinessSeries } from '@/lib/analytics'
import { matchClients } from '@/lib/voice/localParsers'
import type Anthropic from '@anthropic-ai/sdk'
import type { Client, Payment, PaymentSchedule } from '@/types'

// Reports AI Analyst — read-only data analysis over the business ledger.
// Trends, cohorts, projections, and formula work; analysis over advice.

export const maxDuration = 60

const TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_business_data',
    description: 'The full analytics pack: per-client rows (stage, retainer, signing date, tenure, LTV, cash collected in first 30 days, next due, affiliate), a 12-month series (new clients, churned, cash collected, end-of-month MRR), and a bookkeeping audit. Call this first for almost any question.',
    input_schema: { type: 'object', properties: {} },
  },
  {
    name: 'get_client_payments',
    description: 'Raw payment rows for one client (amount, type, status, due/paid dates) when you need transaction-level drill-down.',
    input_schema: {
      type: 'object',
      properties: { client_name: { type: 'string' } },
      required: ['client_name'],
    },
  },
]

async function fetchLedger(supabase: Awaited<ReturnType<typeof createClient>>) {
  const [c, p, s] = await Promise.all([
    supabase.from('clients').select('*, affiliate:affiliates(id, name, initials)'),
    supabase.from('payments').select('*'),
    supabase.from('payment_schedules').select('*'),
  ])
  return {
    clients: (c.data ?? []) as Client[],
    payments: (p.data ?? []) as Payment[],
    schedules: (s.data ?? []) as PaymentSchedule[],
  }
}

export async function POST(req: NextRequest) {
  const { question, history = [] } = await req.json()
  if (!question || typeof question !== 'string') {
    return NextResponse.json({ error: 'question required' }, { status: 400 })
  }

  const supabase = await createClient()

  const system = `You are the revenue analyst for Detailing Accelerator's client-success operation (mobile-detailing clients on monthly/biweekly retainers, free-trial pipeline, affiliate-referred deals).

Today's date: ${localToday()}.

YOUR JOB: rigorous data analysis — trends, cohort comparisons, averages, distributions, projections. You are NOT an advice engine; surface what the numbers say and let the operators decide. Flag data-quality caveats (e.g. clients signed <30 days ago are excluded from 30-day-window averages; sparse months make trends noisy).

MRR DEFINITION (authoritative — use exactly this, never redefine it):
- MRR = sum of monthly_retainer for clients in an active/paying stage: active_client, won_back, overdue, payment_issue, churn_risk. Trials, onboarding, paused, and churned are NOT in MRR.
- monthly_retainer is ALREADY a monthly figure. Do NOT normalize or halve it by billing frequency (bi-weekly clients are not "half MRR" — that reasoning is wrong). The monthly series' mrr_end_of_month already uses this definition, and its latest value equals today's MRR.

RULES:
- Always pull data with tools before answering. Never invent numbers.
- For any MRR question, use mrr_end_of_month from the monthly series (latest = current). Never re-derive MRR from retainers with your own stage/frequency assumptions.
- Show your work in one line when you compute or project something: the formula and the inputs (e.g. "Projection: current MRR $20.3k + trailing-3-month net adds ($1.1k/mo) × 3 = $23.6k").
- When projecting, state assumptions explicitly and give a range where honesty demands it.
- Cite concrete figures with $ and counts. Round dollars to whole numbers.
- Format: short markdown — a direct answer first, then supporting breakdown. Use **bold** for key figures and simple "- " bullets. NEVER use markdown tables or pipes (the display cannot render them) — rankings/lists go as bullet lines like "- 1. Darail Mcbay — **$1,000**". No headers deeper than "##".
- Keep it under ~250 words unless the question genuinely needs more.`

  const conversation: Anthropic.MessageParam[] = [
    ...history.slice(-6).map((m: { role: string; content: string }) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: question },
  ]

  try {
    for (let i = 0; i < 6; i++) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1500,
        system,
        messages: conversation,
        tools: TOOLS,
      })

      const toolUses = response.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
      if (!toolUses.length || response.stop_reason !== 'tool_use') {
        const text = response.content
          .filter(b => b.type === 'text')
          .map(b => (b as Anthropic.TextBlock).text)
          .join('\n')
          .trim()
        return NextResponse.json({ reply: text || 'No analysis produced.' })
      }

      conversation.push({ role: 'assistant', content: response.content })
      const results: Anthropic.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        let result: unknown
        if (tu.name === 'get_business_data') {
          const { clients, payments, schedules } = await fetchLedger(supabase)
          result = {
            today: localToday(),
            clients: clientAnalyticsRows(clients, payments),
            monthly: monthlyBusinessSeries(clients, payments),
            audit: paymentAudit(clients, payments, schedules),
          }
        } else if (tu.name === 'get_client_payments') {
          const { clients, payments } = await fetchLedger(supabase)
          const term = String((tu.input as { client_name?: string }).client_name ?? '')
          const matches = matchClients(term, clients)
          if (!matches.length) {
            result = { error: `No client matching "${term}"` }
          } else {
            const target = matches[0]
            result = {
              client: target.name,
              payments: payments
                .filter(p => p.client_id === target.id)
                .sort((a, b) => a.due_date.localeCompare(b.due_date))
                .map(p => ({ amount: p.amount, type: p.payment_type, status: p.status, due_date: p.due_date, paid_date: p.paid_date ?? null, notes: p.notes ?? null })),
            }
          }
        } else {
          result = { error: `Unknown tool: ${tu.name}` }
        }
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) })
      }
      conversation.push({ role: 'user', content: results })
    }

    return NextResponse.json({ reply: 'The analysis took too many steps — try a more specific question.' })
  } catch (err) {
    console.error('[reports/analyst]', err)
    return NextResponse.json({ error: 'Analyst request failed' }, { status: 500 })
  }
}
