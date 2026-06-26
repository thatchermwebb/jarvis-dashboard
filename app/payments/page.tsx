import { createClient } from '@/lib/supabase/server'
import { CallQueueCard } from '@/components/call-queue/CallQueueCard'
import { sortClientsByPriority } from '@/lib/scoring'
import { formatCurrency } from '@/lib/utils'
import type { Client } from '@/types'

export const dynamic = 'force-dynamic'

export default async function PaymentsPage() {
  const supabase = await createClient()
  const { data: allClients } = await supabase
    .from('clients')
    .select('*')
    .not('stage', 'eq', 'churned')

  const clients = (allClients ?? []) as Client[]

  const paymentIssues = sortClientsByPriority(clients.filter((c) => c.payment_issue || c.stage === 'payment_issue'))
  const activeClients = clients.filter((c) => c.stage === 'active_client')
  const weeklyClients = activeClients.filter((c) => c.payment_frequency === 'weekly')
  const monthlyClients = activeClients.filter((c) => c.payment_frequency !== 'weekly')

  const totalMRR = activeClients.reduce((sum, c) => sum + (c.monthly_retainer ?? 0), 0)
  const weeklyRevenue = weeklyClients.reduce((sum, c) => sum + ((c.monthly_retainer ?? 0) / 4), 0)
  const discountedClients = clients.filter((c) => c.payment_status === 'discounted')

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Payments</h1>
        <p className="text-xs text-muted-foreground">Revenue tracking, payment issues, and billing</p>
      </div>

      {/* Revenue summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
          <div className="text-xl font-bold text-emerald-400">{formatCurrency(totalMRR)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Monthly MRR</div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
          <div className="text-xl font-bold text-blue-400">{formatCurrency(weeklyRevenue)}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Weekly Revenue</div>
        </div>
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-center">
          <div className="text-xl font-bold text-red-400">{paymentIssues.length}</div>
          <div className="text-xs text-muted-foreground mt-0.5">Payment Issues</div>
        </div>
      </div>

      {/* Payment issues */}
      {paymentIssues.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-red-400">💳 Payment Issues</h2>
          {paymentIssues.map((c) => <CallQueueCard key={c.id} client={c} />)}
        </div>
      )}

      {/* Discounted clients */}
      {discountedClients.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-medium text-orange-400">🏷️ Discounted / Custom Deals</h2>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground">Retainer</th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground">Frequency</th>
                  <th className="text-left px-4 py-2 text-xs text-muted-foreground">Deal Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {discountedClients.map((c) => (
                  <tr key={c.id} className="hover:bg-secondary/20">
                    <td className="px-4 py-2 font-medium">{c.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">{formatCurrency(c.monthly_retainer)}</td>
                    <td className="px-4 py-2 text-muted-foreground">{c.payment_frequency}</td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{c.deal_notes ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All active billing */}
      <div className="space-y-2">
        <h2 className="text-sm font-medium text-muted-foreground">All Active Billing</h2>
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left px-4 py-2 text-xs text-muted-foreground">Client</th>
                <th className="text-left px-4 py-2 text-xs text-muted-foreground">Amount</th>
                <th className="text-left px-4 py-2 text-xs text-muted-foreground">Frequency</th>
                <th className="text-left px-4 py-2 text-xs text-muted-foreground">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {activeClients.map((c) => (
                <tr key={c.id} className="hover:bg-secondary/20">
                  <td className="px-4 py-2 font-medium">{c.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{formatCurrency(c.monthly_retainer)}</td>
                  <td className="px-4 py-2 text-muted-foreground">{c.payment_frequency ?? 'monthly'}</td>
                  <td className="px-4 py-2">
                    <span className={c.payment_status === 'current' ? 'text-emerald-400' : c.payment_status === 'failed' ? 'text-red-400' : 'text-muted-foreground'}>
                      {c.payment_status ?? 'current'}
                    </span>
                  </td>
                </tr>
              ))}
              {activeClients.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground text-xs">No active clients</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
