import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getServerUser } from '@/lib/auth-server'
import type { SupabaseClient } from '@supabase/supabase-js'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Public bucket for inline media pasted/dropped into note editors. Public so the
// <img> URLs render anywhere in-app and in exports; paths are random UUIDs so
// nothing is enumerable. Create it on first use (service role) — no manual step.
const BUCKET = 'log-media'
const MAX_BYTES = 15 * 1024 * 1024 // 15 MB
const ALLOWED = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/avif'])
const EXT: Record<string, string> = {
  'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif',
  'image/webp': 'webp', 'image/avif': 'avif',
}

let bucketReady = false
async function ensureBucket(supabase: SupabaseClient) {
  if (bucketReady) return
  const { data } = await supabase.storage.getBucket(BUCKET)
  if (!data) {
    await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_BYTES,
      allowedMimeTypes: [...ALLOWED],
    })
  }
  bucketReady = true
}

export async function POST(req: NextRequest) {
  const user = await getServerUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const form = await req.formData().catch(() => null)
  const file = form?.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }
  if (!ALLOWED.has(file.type)) {
    return NextResponse.json({ error: 'Unsupported image type' }, { status: 400 })
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: 'Image too large (max 15 MB)' }, { status: 400 })
  }

  const supabase = await createClient()
  try {
    await ensureBucket(supabase)
  } catch {
    // If it already exists a concurrent create can throw — safe to ignore and
    // let the upload below surface any real problem.
    bucketReady = true
  }

  const ext = EXT[file.type] ?? 'bin'
  const path = `${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())

  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    cacheControl: '31536000', // 1 year — content is immutable per path
    upsert: false,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path)
  return NextResponse.json({ url: data.publicUrl }, { status: 201 })
}
