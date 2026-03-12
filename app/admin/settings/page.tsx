/**
 * Admin — System Settings
 * View and manage dialect configuration, pricing, and platform settings.
 */

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/layouts/Topbar'
import DialectManagerClient from '../components/DialectManagerClient'
import PricingConfigClient from '../components/PricingConfigClient'
import TaskUnlockClient from '../components/TaskUnlockClient'
import PayoutStructureClient from '../components/PayoutStructureClient'

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const admin = await createAdminClient()

  // Require admin role
  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single()

  if (!roleRow) {
    return (
      <>
        <Topbar title="System Settings" subtitle="Platform configuration" />
        <div className="container-modern py-8">
          <div className="af-card p-6 border-l-4" style={{ borderColor: 'var(--af-danger)' }}>
            <h3 className="font-semibold mb-1" style={{ color: 'var(--af-txt)' }}>Access Denied</h3>
            <p className="text-sm" style={{ color: 'var(--af-muted)' }}>
              You need the <strong>admin</strong> role to view settings.
            </p>
          </div>
        </div>
      </>
    )
  }

  // Fetch dialects
  const { data: dialects } = await admin
    .from('dialects')
    .select('id, name, code, enabled')
    .order('name', { ascending: true })

  // Fetch HBAR price from system_config
  const { data: configRows } = await admin
    .from('system_config')
    .select('key, value')
  const hbarPriceRow = (configRows ?? []).find((r) => r.key === 'hbar_price_usd')
  const hbarPriceUSD = hbarPriceRow?.value ?? '0.08'

  // Fetch payout structure
  const { data: payoutStructure } = await admin
    .from('payout_structure')
    .select('role, amount_usd, description, updated_at')
    .order('role')

  // Fetch claimed tasks for admin override panel
  const { data: rawClaimedTasks } = await admin
    .from('tasks')
    .select('id, task_type, status, claimed_by, claimed_at, expires_at, audio_clip_id')
    .eq('status', 'claimed')
    .order('claimed_at', { ascending: true })
    .limit(100)

  // Resolve claimer names
  const claimerIds = [...new Set((rawClaimedTasks ?? []).map((t) => t.claimed_by).filter(Boolean))]
  const { data: claimerProfiles } = claimerIds.length
    ? await admin
        .from('profiles')
        .select('id, email, full_name')
        .in('id', claimerIds)
    : { data: [] }

  const claimerMap: Record<string, string> = {}
  for (const p of claimerProfiles ?? []) {
    claimerMap[p.id] = p.full_name ?? p.email ?? p.id
  }

  const claimedTasks = (rawClaimedTasks ?? []).map((t) => ({
    ...t,
    claimerName: t.claimed_by ? (claimerMap[t.claimed_by] ?? t.claimed_by) : '—',
  }))

  // Platform summary counts
  const { count: totalClips } = await admin
    .from('audio_clips')
    .select('*', { count: 'exact', head: true })

  const { count: mintedClips } = await admin
    .from('audio_clips')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'minted')

  const { count: totalNfts } = await admin
    .from('nft_records')
    .select('*', { count: 'exact', head: true })

  const envInfo = [
    { label: 'Next.js Version',   value: '16.1.6' },
    { label: 'Hedera Network',    value: process.env.HEDERA_NETWORK ?? 'testnet' },
    { label: 'AWS Region',        value: process.env.AWS_REGION ?? '—' },
    { label: 'Pinata Configured', value: process.env.PINATA_JWT ? '✅ Yes' : '❌ Missing' },
    { label: 'Supabase URL',      value: process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing' },
  ]

  return (
    <>
      <Topbar title="System Settings" subtitle="Platform configuration, dialect management, and admin overrides" />
      <div className="container-modern py-8 space-y-6">

        {/* Back link */}
        <div>
          <Link
            href="/admin"
            className="text-sm flex items-center gap-1.5 w-fit"
            style={{ color: 'var(--af-primary)' }}
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            Back to Admin
          </Link>
        </div>

        {/* Platform stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {[
            { label: 'Total Clips',    value: totalClips  ?? 0, icon: '🎙️' },
            { label: 'Minted Clips',   value: mintedClips ?? 0, icon: '🪙' },
            { label: 'NFT Records',    value: totalNfts   ?? 0, icon: '⬡' },
          ].map((s) => (
            <div key={s.label} className="af-card p-5">
              <div className="text-2xl mb-2">{s.icon}</div>
              <div className="text-xl font-bold mb-1" style={{ color: 'var(--af-txt)' }}>{s.value}</div>
              <div className="text-xs" style={{ color: 'var(--af-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Pricing configuration */}
        <div className="af-card p-6">
          <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--af-txt)' }}>
            💱 Pricing Configuration
          </h2>
          <PricingConfigClient initialRate={hbarPriceUSD} />
        </div>

        {/* Payout structure */}
        <div className="af-card p-6">
          <h2 className="font-semibold mb-1 text-sm" style={{ color: 'var(--af-txt)' }}>
            💸 Contributor Payout Structure
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--af-muted)' }}>
            Set the USD payout amount per sample for each contributor role and the platform fee.
            Changes apply to all future purchases immediately.
          </p>
          <PayoutStructureClient initialStructure={payoutStructure ?? []} />
        </div>

        {/* Dialect management (interactive) */}
        <div className="af-card p-6">
          <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--af-txt)' }}>
            🗣️ Dialect Management ({dialects?.length ?? 0} configured)
          </h2>
          <DialectManagerClient initialDialects={dialects ?? []} />
        </div>

        {/* Admin task overrides */}
        <div className="af-card p-6">
          <h2 className="font-semibold mb-1 text-sm" style={{ color: 'var(--af-txt)' }}>
            � Task Override — Unlock Claimed Tasks
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--af-muted)' }}>
            Unlock tasks that are stuck in &quot;claimed&quot; state. This returns them to the queue as available.
          </p>
          <TaskUnlockClient initialTasks={claimedTasks} />
        </div>

        {/* Environment / configuration */}
        <div className="af-card p-6">
          <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--af-txt)' }}>
            ⚙️ Environment Configuration
          </h2>
          <div className="divide-y" style={{ borderColor: 'var(--af-line)' }}>
            {envInfo.map(({ label, value }) => (
              <div key={label} className="flex items-center justify-between py-3">
                <span className="text-sm" style={{ color: 'var(--af-muted)' }}>{label}</span>
                <span className="text-sm font-medium font-mono" style={{ color: 'var(--af-txt)' }}>{value}</span>
              </div>
            ))}
          </div>
          <p
            className="text-xs mt-4 p-3 rounded-xl"
            style={{ background: 'var(--af-search-bg)', color: 'var(--af-muted)' }}
          >
            ℹ️ To change environment variables, update <code>.env.local</code> and restart the server. Secret values are not displayed here.
          </p>
        </div>

        {/* Quick links */}
        <div className="af-card p-6">
          <h2 className="font-semibold mb-4 text-sm" style={{ color: 'var(--af-txt)' }}>
            🔗 Quick Links
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Manage Users',  href: '/admin/users',      icon: '👤' },
              { label: 'NFT Minting',   href: '/admin/mint',       icon: '⬡' },
              { label: 'Audit Logs',    href: '/admin/audit-logs', icon: '📋' },
              { label: 'Analytics',     href: '/admin/analytics',  icon: '�' },
            ].map(({ label, href, icon }) => (
              <Link
                key={label}
                href={href}
                className="af-card af-card-hover p-4 block text-center"
              >
                <div className="text-xl mb-1">{icon}</div>
                <div className="text-xs font-medium" style={{ color: 'var(--af-txt)' }}>{label}</div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </>
  )
}
