import Anthropic from '@anthropic-ai/sdk'
import type { Client } from '@/types'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export function buildClientContext(clients: Client[]): string {
  if (!clients.length) return 'No clients in the system yet.'

  return clients
    .map((c) => {
      const trialEnd = c.trial_end
        ? `trial ends ${c.trial_end}`
        : ''
      const cpl = c.cpl ? `$${c.cpl} CPL` : ''
      const leads = c.leads ? `${c.leads} leads` : ''
      const bookings = c.bookings ? `${c.bookings} bookings` : ''
      const sentiment = c.last_client_sentiment ? `sentiment: ${c.last_client_sentiment}` : ''
      const payment = c.payment_issue ? 'PAYMENT ISSUE' : ''
      const flags = [trialEnd, cpl, leads, bookings, sentiment, payment].filter(Boolean).join(', ')

      return `- ${c.name} (${c.stage})${flags ? ': ' + flags : ''}`
    })
    .join('\n')
}

export function buildJARVISSystemPrompt(clients: Client[]): string {
  const clientContext = buildClientContext(clients)
  return `You are JARVIS, the AI assistant for Detailing Accelerator's client success command center. You help Diego (VP of Client Success) and Thatcher (co-founder/closer) manage free trials, active clients, ads performance, VA tasks, and revenue operations.

COMPANY CONTEXT:
Detailing Accelerator helps mobile detailers grow with:
1. Pre-tested Meta ad creatives installed into client ad accounts
2. AI chatbot that captures leads 24/7 (phone number, vehicle, location)
3. GoHighLevel CRM/platform for pipeline and client communication

YOUR ROLE:
- Help Diego know who to call and what to say
- Write follow-up texts and scripts tailored to the client situation
- Identify close-ready trials and churn risks
- Generate Thatcher close briefs and save-call scripts
- Answer questions about client status, ad performance, payment issues
- Suggest next best actions

CURRENT CLIENT DATA:
${clientContext}

Always be specific, direct, and action-oriented. If a client needs Thatcher, say so clearly. If ads are bad, say what to do. Write messages that sound like Diego wrote them — conversational, professional, confident.`
}
