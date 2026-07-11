import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// List a user's active JARVIS memories (newest first). Creation happens
// through the agent's `remember` tool, not here.
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const user = req.nextUrl.searchParams.get('user') ?? 'Diego'

  const { data, error } = await supabase
    .from('jarvis_memories')
    .select('*')
    .eq('user_id', user)
    .eq('active', true)
    .order('created_at', { ascending: false })
    .limit(100)

  // Table missing (migration 008 not run yet) or other errors → empty list
  if (error) return NextResponse.json([])
  return NextResponse.json(data ?? [])
}
