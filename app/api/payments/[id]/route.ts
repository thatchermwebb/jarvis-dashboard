import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { callerIsReadOnly } from '@/lib/auth-server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await callerIsReadOnly()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = await createClient()
  const { id } = await params
  const body = await req.json()

  // Marking a payment paid: "late" is authoritatively decided by paid_date vs
  // due_date, NOT by which bucket the row was displayed in. paid_date must come
  // from the client (browser local); never auto-generate server-side (UTC mismatch).
  if (body.status === 'paid' || body.status === 'paid_late') {
    if (!body.paid_date) {
      // Fallback only: shouldn't reach here; client should always send paid_date
      body.paid_date = new Date().toISOString().slice(0, 10)
    }
    // Only auto-decide for the neutral "paid" action; an explicit 'paid_late'
    // (e.g. chosen in the edit dialog) is respected as a manual override.
    if (body.status === 'paid') {
      // due_date may not be in the body — fetch the row's value to compare.
      let dueDate: string | undefined = body.due_date
      if (!dueDate) {
        const { data: existing } = await supabase.from('payments').select('due_date').eq('id', id).single()
        dueDate = existing?.due_date ?? undefined
      }
      // ISO YYYY-MM-DD strings compare chronologically. Paid on/before due = on time.
      if (dueDate) body.status = body.paid_date > dueDate ? 'paid_late' : 'paid'
    }
  }

  const { data, error } = await supabase
    .from('payments')
    .update(body)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (await callerIsReadOnly()) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  const supabase = await createClient()
  const { id } = await params
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
