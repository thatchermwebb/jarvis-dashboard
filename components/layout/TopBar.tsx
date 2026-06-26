'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ClientForm } from '@/components/clients/ClientForm'
import { LogCallDialog } from '@/components/clients/LogCallDialog'

export function TopBar() {
  const [clientFormOpen, setClientFormOpen] = useState(false)
  const [logCallOpen, setLogCallOpen] = useState(false)
  const [search, setSearch] = useState('')
  const router = useRouter()

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    if (search.trim()) {
      router.push(`/clients?search=${encodeURIComponent(search.trim())}`)
    }
  }

  return (
    <>
      <header className="h-14 flex items-center gap-4 px-6 border-b border-border bg-sidebar/50 backdrop-blur-sm flex-shrink-0">
        {/* Search */}
        <form onSubmit={handleSearch} className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search clients..."
              className="pl-9 h-8 text-sm bg-secondary/50 border-border"
            />
          </div>
        </form>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            size="sm"
            className="h-8 text-xs bg-primary text-primary-foreground hover:bg-primary/90 font-medium"
            onClick={() => setLogCallOpen(true)}
          >
            Log Call
          </Button>

          <Button
            size="sm"
            variant="outline"
            className="h-8 text-xs border-primary/40 text-primary hover:bg-primary/10"
            onClick={() => setClientFormOpen(true)}
          >
            Add Client
          </Button>
        </div>
      </header>

      <ClientForm open={clientFormOpen} onClose={() => setClientFormOpen(false)} />
      <LogCallDialog open={logCallOpen} onClose={() => setLogCallOpen(false)} />
    </>
  )
}
