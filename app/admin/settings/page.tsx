/**
 * Admin — System Settings
 * View and manage dialect configuration and platform settings.
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/layouts/Topbar'

export default async function AdminSettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

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
      <Topbar title="System Settings" subtitle="Platform configuration and dialect management" />
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

        {/* Dialect management */}
        <div className="af-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--af-txt)' }}>
              🗣️ Supported Dialects ({dialects?.length ?? 0})
            </h2>
          </div>

          {!dialects || dialects.length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--af-muted)' }}>
              No dialects configured. Run the seed SQL to add dialects.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--af-line)' }}>
                    {['Name', 'Code', 'Status'].map((h) => (
                      <th
                        key={h}
                        className="text-left pb-3 pr-6 text-xs font-semibold"
                        style={{ color: 'var(--af-muted)' }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dialects.map((d) => (
                    <tr key={d.id} style={{ borderBottom: '1px solid var(--af-line)' }}>
                      <td className="py-3 pr-6 font-medium" style={{ color: 'var(--af-txt)' }}>
                        {d.name}
                      </td>
                      <td className="py-3 pr-6 font-mono text-xs" style={{ color: 'var(--af-muted)' }}>
                        {d.code}
                      </td>
                      <td className="py-3">
                        <span
                          className="text-xs font-semibold px-2 py-0.5 rounded-full"
                          style={{
                            background: d.enabled ? 'var(--af-primary-light)' : 'var(--af-line)',
                            color: d.enabled ? 'var(--af-primary)' : 'var(--af-muted)',
                          }}
                        >
                          {d.enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p
            className="text-xs mt-4 p-3 rounded-xl"
            style={{ background: 'var(--af-search-bg)', color: 'var(--af-muted)' }}
          >
            ℹ️ To add or disable dialects, run SQL directly in the Supabase Dashboard.
            Full dialect management UI is planned for Phase 10.
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
              { label: 'Supabase Dashboard', href: 'https://supabase.com/dashboard', icon: '🗄️', external: true },
            ].map(({ label, href, icon, external }) => (
              <Link
                key={label}
                href={href}
                target={external ? '_blank' : undefined}
                rel={external ? 'noopener noreferrer' : undefined}
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
