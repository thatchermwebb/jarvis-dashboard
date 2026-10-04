import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Lightweight list of active Creative Library codes for dropdowns (client
// profile "Creative" picker, etc.). Unlike /api/media/creatives it computes no
// stats and isn't admin-only — middleware already limits /api/media to admins
// and VAs.
export async function GET() {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('media_creatives')
    .select('code, name')
    .eq('status', 'active')
    .order('code', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}
