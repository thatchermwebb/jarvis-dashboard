import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const body = await req.json()

  // Auto-set paid_date; determine paid vs paid_late based on whether paid on or after due date
  if (body.status === 'paid' || body.status === 'paid_late') {
    if (!body.paid_date) body.paid_date = new Date().toISOString().split('T')[0]
    // If caller sent status='paid' but we need to check due_date
    if (body.status === 'paid' && body.due_date) {
      const due = new Date(body.due_date + 'T00:00:00')
      const paid = new Date(body.paid_date + 'T00:00:00')
      if (paid > due) body.status = 'paid_late'
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
  const supabase = await createClient()
  const { id } = await params
  const { error } = await supabase.from('payments').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
