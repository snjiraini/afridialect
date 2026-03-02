/**
 * Admin Dashboard Page
 * Manage users, roles, and view system analytics
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Topbar from '@/components/layouts/Topbar'

export default async function AdminPage() {
  const supabase = await createClient()

  const { data: { session } } = await supabase.auth.getSession()
  if (!session) redirect('/auth/login')

  const { data: adminRole } = await supabase
    .from('user_roles').select('role')
    .eq('user_id', session.user.id).eq('role', 'admin').single()

  if (!adminRole) redirect('/dashboard')

  const { count: totalUsers }       = await supabase.from('profiles').select('*', { count: 'exact', head: true })
  const { count: usersWithHedera }  = await supabase.from('profiles').select('*', { count: 'exact', head: true }).not('hedera_account_id', 'is', null)
  const { count: verifiedUsers }    = await supabase.from('profiles').select('*', { count: 'exact', head: true }).not('email_verified', 'is', null)

  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('id, email, full_name, hedera_account_id, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  const { data: roleStats } = await supabase.from('user_roles').select('role')
  const roleCounts = roleStats?.reduce((acc, { role }) => {
    acc[role] = (acc[role] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  const hederaPct = totalUsers ? Math.round(((usersWithHedera || 0) / totalUsers) * 100) : 0
  const verifiedPct = totalUsers ? Math.round(((verifiedUsers || 0) / totalUsers) * 100) : 0

  const statCards = [
    { label: 'Total Users',     value: totalUsers || 0,     sub: 'registered accounts',    icon: '👥' },
    { label: 'Hedera Accounts', value: usersWithHedera || 0, sub: `${hederaPct}% of users`, icon: '⛓️' },
    { label: 'Verified Emails', value: verifiedUsers || 0,  sub: `${verifiedPct}% verified`, icon: '✅' },
  ]

  const quickActions = [
    { label: 'Manage Users',    desc: 'View and edit user profiles, assign roles', href: '/admin/users',      icon: '👤' },
    { label: 'NFT Minting',     desc: 'Mint NFTs for translation-QC approved clips', href: '/admin/mint',    icon: '⬡' },
    { label: 'Audit Logs',      desc: 'View system activity and security events',  href: '/admin/audit-logs', icon: '📋' },
    { label: 'System Settings', desc: 'Configure dialects, pricing, and more',     href: '/admin/settings',   icon: '⚙️' },
  ]

  return (
    <>
      <Topbar title="Admin Dashboard" subtitle="System management and analytics" />
      <div className="container-modern py-8 space-y-6">

        {/* Stat cards */}
        <div className="grid grid-cols-3 gap-5">
          {statCards.map(({ label, value, sub, icon }) => (
            <div key={label} className="af-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--af-muted)' }}>{label}</p>
                  <p className="text-3xl font-bold" style={{ color: 'var(--af-txt)' }}>{value}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--af-muted)' }}>{sub}</p>
                </div>
                <span className="text-2xl">{icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Role distribution */}
        <div className="af-card p-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>Role Distribution</h2>
          {Object.keys(roleCounts).length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--af-muted)' }}>No roles assigned yet.</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {Object.entries(roleCounts).map(([role, count]) => (
                <div key={role} className="af-card p-4 flex flex-col items-center min-w-[80px]">
                  <p className="text-2xl font-bold" style={{ color: 'var(--af-primary)' }}>{count}</p>
                  <p className="text-xs mt-1 capitalize" style={{ color: 'var(--af-muted)' }}>{role}s</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="af-card p-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>Quick Actions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {quickActions.map(({ label, desc, href, icon }) => (
              <Link key={label} href={href} className="af-card af-card-hover p-5 block">
                <div className="text-2xl mb-2">{icon}</div>
                <h3 className="font-semibold mb-1" style={{ color: 'var(--af-txt)' }}>{label}</h3>
                <p className="text-sm" style={{ color: 'var(--af-muted)' }}>{desc}</p>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent users table */}
        <div className="af-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold" style={{ color: 'var(--af-txt)' }}>Recent Users</h2>
            <Link href="/admin/users" className="text-sm font-medium" style={{ color: 'var(--af-primary)' }}>
              View all →
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--af-line)' }}>
                  {['User', 'Email', 'Hedera Account', 'Joined', ''].map(h => (
                    <th key={h} className="text-left pb-3 pr-4 font-medium" style={{ color: 'var(--af-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recentUsers && recentUsers.length > 0 ? recentUsers.map(u => (
                  <tr key={u.id} style={{ borderBottom: '1px solid var(--af-line)' }}>
                    <td className="py-3 pr-4 font-medium" style={{ color: 'var(--af-txt)' }}>{u.full_name || '—'}</td>
                    <td className="py-3 pr-4" style={{ color: 'var(--af-muted)' }}>{u.email}</td>
                    <td className="py-3 pr-4">
                      {u.hedera_account_id ? (
                        <span className="font-mono text-xs badge badge-primary">{u.hedera_account_id}</span>
                      ) : (
                        <span className="badge" style={{ background: 'var(--af-line)', color: 'var(--af-muted)' }}>None</span>
                      )}
                    </td>
                    <td className="py-3 pr-4" style={{ color: 'var(--af-muted)' }}>{new Date(u.created_at).toLocaleDateString()}</td>
                    <td className="py-3">
                      <Link href={`/admin/users/${u.id}`} className="text-sm font-medium" style={{ color: 'var(--af-primary)' }}>View</Link>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="py-10 text-center" style={{ color: 'var(--af-muted)' }}>No users found</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </>
  )
}
