/**
 * Dashboard Page - redesigned with AF design system
 */
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import CreateHederaAccountButton from './components/CreateHederaAccountButton'
import Topbar from '@/components/layouts/Topbar'

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { redirect('/auth/login') }

  const { data: profile } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
  const { data: roles } = await supabase.from('user_roles').select('role').eq('user_id', session.user.id)
  const userRoles: string[] = roles?.map((r: { role: string }) => r.role) || []
  const displayName = profile?.full_name ?? session.user.email?.split('@')[0] ?? 'User'

  type Action = { label: string; href: string; icon: string; color: string }
  const quickActions: Action[] = [
    ...(userRoles.includes('uploader') || userRoles.includes('admin') ? [{ label: 'Upload Audio', href: '/uploader', icon: '\u{1F399}', color: 'var(--af-primary)' }] : []),
    ...(userRoles.includes('transcriber') || userRoles.includes('admin') ? [{ label: 'Transcribe', href: '/transcriber', icon: '\u{1F4DD}', color: '#6366f1' }] : []),
    ...(userRoles.includes('translator') || userRoles.includes('admin') ? [{ label: 'Translate', href: '/translator', icon: '\u{1F310}', color: '#8b5cf6' }] : []),
    ...(userRoles.includes('reviewer') || userRoles.includes('admin') ? [{ label: 'Review / QC', href: '/reviewer', icon: '\u2705', color: '#10b981' }] : []),
    { label: 'Marketplace', href: '/marketplace', icon: '\u{1F6CD}', color: '#f59e0b' },
    ...(userRoles.includes('admin') ? [{ label: 'Admin Panel', href: '/admin', icon: '\u2699', color: '#ef4444' }] : []),
  ]

  return (
    <>
      <Topbar title="Dashboard" subtitle={"Welcome back, " + displayName} />
      <div className="container-modern py-8">
        {!profile?.hedera_account_id && (
          <div className="af-card p-5 mb-8 flex items-start gap-4" style={{ borderLeft: '4px solid #f59e0b' }}>
            <div className="text-2xl flex-shrink-0">\u26A1</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm mb-1" style={{ color: 'var(--af-txt)' }}>Create Your Hedera Account</h3>
              <p className="text-xs leading-relaxed mb-3" style={{ color: 'var(--af-muted)' }}>
                To start contributing and earning rewards, you need a secure blockchain-backed identity.
              </p>
              <CreateHederaAccountButton />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {([
            { label: 'Roles', value: userRoles.length > 0 ? String(userRoles.length) : '0', icon: '\u{1F3AD}' },
            { label: 'Hedera Account', value: profile?.hedera_account_id ? 'Active' : 'Pending', icon: '\u{1F517}' },
            { label: 'Contributions', value: '--', icon: '\u{1F399}' },
            { label: 'Earnings', value: '--', icon: '\u{1F4B0}' },
          ] as { label: string; value: string; icon: string }[]).map((stat) => (
            <div key={stat.label} className="af-card p-5">
              <div className="text-2xl mb-2">{stat.icon}</div>
              <div className="text-xl font-bold mb-1" style={{ color: 'var(--af-txt)', fontFamily: 'Lexend, sans-serif' }}>{stat.value}</div>
              <div className="text-xs" style={{ color: 'var(--af-muted)' }}>{stat.label}</div>
            </div>
          ))}
        </div>
        <div className="grid lg:grid-cols-3 gap-6">
          <div className="af-card p-6 lg:col-span-1">
            <div className="flex items-center gap-3 mb-6">
              <div className="af-avatar w-14 h-14 text-lg" aria-label="User avatar">{displayName.slice(0, 2).toUpperCase()}</div>
              <div>
                <h3 className="font-semibold text-base" style={{ color: 'var(--af-txt)', fontFamily: 'Lexend, sans-serif' }}>{displayName}</h3>
                <p className="text-xs" style={{ color: 'var(--af-muted)' }}>{profile?.email}</p>
              </div>
            </div>
            <div className="space-y-3">
              {([
                { label: 'Email', value: profile?.email ?? '--', mono: false },
                { label: 'Roles', value: userRoles.length > 0 ? userRoles.join(', ') : 'No roles assigned', mono: false },
                { label: 'Hedera', value: profile?.hedera_account_id ?? 'Not created yet', mono: !!profile?.hedera_account_id },
              ] as { label: string; value: string; mono: boolean }[]).map((row) => (
                <div key={row.label}>
                  <p className="text-[11px] font-medium uppercase tracking-wide mb-0.5" style={{ color: 'var(--af-muted)' }}>{row.label}</p>
                  <p className={"text-sm break-all" + (row.mono ? ' font-mono' : '')} style={{ color: 'var(--af-txt)' }}>{row.value}</p>
                </div>
              ))}
            </div>
            <div className="mt-6 pt-4" style={{ borderTop: '1px solid var(--af-line)' }}>
              <Link href="/profile/edit" className="btn-secondary w-full justify-center text-sm">Edit Profile</Link>
            </div>
          </div>
          <div className="lg:col-span-2">
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--af-txt)', fontFamily: 'Lexend, sans-serif' }}>Quick Actions</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {quickActions.map((a) => (
                <Link key={a.href} href={a.href}
                  className="af-card p-4 flex flex-col gap-2 hover:-translate-y-1 hover:shadow-soft-lg transition-all duration-200 group">
                  <span className="w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 group-hover:scale-110 transition-transform duration-200"
                    style={{ background: a.color + '20' }}>{a.icon}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--af-txt)' }}>{a.label}</span>
                </Link>
              ))}
            </div>
            {userRoles.length === 0 && (
              <div className="af-card mt-4 p-5" style={{ borderLeft: '4px solid var(--af-primary)' }}>
                <h4 className="font-semibold text-sm mb-1" style={{ color: 'var(--af-txt)' }}>No Roles Assigned Yet</h4>
                <p className="text-xs" style={{ color: 'var(--af-muted)' }}>
                  Contact an admin to assign a role to unlock more actions.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
