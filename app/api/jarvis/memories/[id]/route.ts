import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// "Delete" a memory — soft-deactivate so the agent's forget/audit trail works.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const { error } = await supabase.from('jarvis_memories').update({ active: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
