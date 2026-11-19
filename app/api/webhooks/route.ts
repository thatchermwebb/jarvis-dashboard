import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callerIsAdmin } from '@/lib/auth-server'
import { isValidEvent } from '@/lib/webhooks'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const SELECT =
  'id, event, url, description, enabled, last_status, last_delivered_at, last_error, created_at, updated_at'

// List all configured webhook endpoints. Admin only. Note: `secret` is never
// returned — it's write-only, so it can't leak back to the browser.
export async function GET() {
  if (!(await callerIsAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('webhook_endpoints')
    .select(SELECT)
    .order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

// Create a new endpoint. Admin only.
export async function POST(req: NextRequest) {
  if (!(await callerIsAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const body = await req.json()

  const url = typeof body.url === 'string' ? body.url.trim() : ''
  if (!/^https?:\/\/.+/i.test(url)) {
    return NextResponse.json({ error: 'A valid http(s) URL is required' }, { status: 400 })
  }

  const event = isValidEvent(body.event) ? body.event : 'payment.ltv'

  const supabase = await createClient()
  const insert = {
    event,
    url,
    secret: typeof body.secret === 'string' && body.secret.trim() ? body.secret.trim() : null,
    description: typeof body.description === 'string' && body.description.trim() ? body.description.trim() : null,
    enabled: body.enabled === undefined ? true : !!body.enabled,
  }
  const { data, error } = await supabase.from('webhook_endpoints').insert(insert).select(SELECT).single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}
