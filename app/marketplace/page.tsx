/**
 * Marketplace Page — server component
 *
 * Auth: any authenticated user (buyers see the catalogue;
 *       buyer role is required only at checkout via the API)
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Topbar from '@/components/layouts/Topbar'
import MarketplaceClient from './components/MarketplaceClient'

export default async function MarketplacePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch enabled dialects for filter UI
  const { data: dialects } = await supabase
    .from('dialects')
    .select('id, code, name, country_code')
    .eq('enabled', true)
    .order('name')

  // Fetch buyer's previous purchases (for sidebar history)
  const { data: purchases } = await supabase
    .from('dataset_purchases')
    .select('id, sample_count, price_usd, payment_status, created_at, downloaded_at')
    .eq('buyer_id', user.id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Check if user has buyer role
  const { data: buyerRole } = await supabase
    .from('user_roles')
    .select('id')
    .eq('user_id', user.id)
    .in('role', ['buyer', 'admin'])
    .maybeSingle()

  return (
    <>
      <Topbar
        title="Marketplace"
        subtitle="Browse and purchase African dialect audio datasets"
      />
      <div className="container-modern py-8">
        <MarketplaceClient
          dialects={dialects ?? []}
          recentPurchases={purchases ?? []}
          hasBuyerRole={!!buyerRole}
          userId={user.id}
        />
      </div>
    </>
  )
}
