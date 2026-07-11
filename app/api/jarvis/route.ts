import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { buildJARVISSystemPrompt } from '@/lib/anthropic'
import type { Client } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export async function POST(req: NextRequest) {
  const { message, history = [], user = 'Diego' } = await req.json()

  // Fetch clients + the user's standing memories for context
  const supabase = await createClient()
  const [{ data: clients }, memoriesRes] = await Promise.all([
    supabase
      .from('clients')
      .select('*')
      .not('stage', 'in', '("churned")')
      .order('updated_at', { ascending: false })
      .limit(50),
    supabase
      .from('jarvis_memories')
      .select('content, category')
      .eq('user_id', user)
      .eq('active', true)
      .order('created_at', { ascending: false })
      .limit(40),
  ])
  const memories = memoriesRes.data ?? [] // table may not exist yet — fine

  const memorySection = memories.length
    ? `\n\nSTANDING MEMORY (things you know about ${user} — apply them without being asked):\n${memories.map(m => `- [${m.category}] ${m.content}`).join('\n')}`
    : ''

  const systemPrompt = buildJARVISSystemPrompt((clients ?? []) as Client[]) + memorySection

  // Build message history
  const messages: Anthropic.MessageParam[] = [
    ...history,
    { role: 'user', content: message },
  ]

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
        stream: true,
      })

      for await (const event of response) {
        if (
          event.type === 'content_block_delta' &&
          event.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(event.delta.text))
        }
      }
      controller.close()
    },
  })

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
    },
  })
}
