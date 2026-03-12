/**
 * Profile Page - redesigned with AF design system
 */
export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Topbar from '@/components/layouts/Topbar'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { redirect('/auth/login') }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id)
  const userRoles: string[] = roles?.map((r: { role: string }) => r.role) || []
  const displayName = profile?.full_name ?? session.user.email?.split('@')[0] ?? 'User'

  return (
    <>
      <Topbar title="My Profile" subtitle="Manage your account and Hedera identity" />
      <div className="container-modern py-8">
        <div className="grid lg:grid-cols-3 gap-6">

          {/* Avatar + summary */}
          <div className="af-card p-6 lg:col-span-1 flex flex-col items-center text-center gap-4">
            <div className="af-avatar w-20 h-20 text-2xl mt-2">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg font-semibold" style={{ fontFamily: 'Lexend, sans-serif', color: 'var(--af-txt)' }}>
                {displayName}
              </h2>
              <p className="text-xs mt-0.5" style={{ color: 'var(--af-muted)' }}>{profile?.email}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {userRoles.length > 0 ? userRoles.map((r) => (
                <span key={r} className="badge badge-primary capitalize">{r}</span>
              )) : (
                <span className="badge" style={{ background: 'var(--af-line)', color: 'var(--af-muted)' }}>No roles</span>
              )}
            </div>
            <Link href="/profile/edit" className="btn-primary w-full justify-center mt-2">Edit Profile</Link>
          </div>

          {/* Details */}
          <div className="lg:col-span-2 flex flex-col gap-6">

            {/* Basic info */}
            <div className="af-card p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--af-muted)' }}>
                Basic Information
              </h3>
              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { label: 'Full Name', value: profile?.full_name ?? 'Not set' },
                  { label: 'Email', value: profile?.email ?? session.user.email ?? '--' },
                  { label: 'Member Since', value: profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : '--' },
                  { label: 'Roles', value: userRoles.length > 0 ? userRoles.join(', ') : 'None assigned' },
                ].map((row) => (
                  <div key={row.label}>
                    <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--af-muted)' }}>{row.label}</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--af-txt)' }}>{row.value}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hedera account */}
            <div className="af-card p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide mb-4" style={{ color: 'var(--af-muted)' }}>
                Hedera Blockchain Identity
              </h3>
              {profile?.hedera_account_id ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--af-muted)' }}>Account ID</p>
                    <p className="text-sm font-mono font-medium" style={{ color: 'var(--af-txt)' }}>{profile.hedera_account_id}</p>
                  </div>
                  {profile.kms_key_id && (
                    <div>
                      <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--af-muted)' }}>KMS Key ID</p>
                      <p className="text-sm font-mono break-all" style={{ color: 'var(--af-txt)' }}>{profile.kms_key_id}</p>
                    </div>
                  )}
                  <div className="sm:col-span-2">
                    <span className="badge badge-success">Active — ThresholdKey (2-of-2)</span>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-4 p-4 rounded-xl" style={{ background: 'var(--af-primary-light)' }}>
                  <div className="text-2xl flex-shrink-0">⚡</div>
                  <div>
                    <p className="text-sm font-semibold mb-1" style={{ color: 'var(--af-txt)' }}>
                      No Hedera account yet
                    </p>
                    <p className="text-xs mb-3" style={{ color: 'var(--af-muted)' }}>
                      Create your Hedera account to start earning from your contributions.
                    </p>
                    <Link href="/dashboard" className="btn-primary text-sm">Go to Dashboard</Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
