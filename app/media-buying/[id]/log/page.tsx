'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { AccountLogForm } from '@/components/media/AccountLogForm'
import type { Client, MediaAccount } from '@/types'

export default function LogReviewPage() {
  const params = useParams<{ id: string }>()
  const id = params.id
  const router = useRouter()
  const [account, setAccount] = useState<MediaAccount | null>(null)

  useEffect(() => {
    fetch(`/api/clients/${id}`)
      .then(r => (r.ok ? r.json() : null))
      .then((c: Client | null) => {
        if (c) setAccount({ id: c.id, name: c.name, business_name: c.business_name, market_location: c.market_location })
      })
      .catch(() => {})
  }, [id])

  const back = () => router.push(`/media-buying/${id}`)

  return (
    <div className="max-w-3xl mx-auto">
      <button onClick={back} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4">
        <ChevronLeft className="w-4 h-4" /> Back to account
      </button>

      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Log Review</h1>
        {account && (
          <p className="text-sm text-muted-foreground mt-0.5">
            {account.name}{account.business_name ? ` · ${account.business_name}` : ''}
          </p>
        )}
      </div>

      {account && <AccountLogForm account={account} onSaved={back} onCancel={back} />}
    </div>
  )
}
