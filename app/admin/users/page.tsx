/**
 * Admin - User Management Page
 * View and manage all users
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import CreateTestUserForm from '../components/CreateTestUserForm'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  // Check if user is admin
  const { data: adminRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .eq('role', 'admin')
    .single()

  if (!adminRole) {
    redirect('/dashboard')
  }

  // Get all users with their roles
  const { data: users } = await supabase
    .from('profiles')
    .select(`
      id,
      email,
      full_name,
      hedera_account_id,
      kms_key_id,
      created_at,
      user_roles (role)
    `)
    .order('created_at', { ascending: false })

  return (
    <>
      <div className="container-modern py-8 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <Link href="/admin" className="text-sm font-medium hover:underline mb-2 inline-block" style={{ color: 'var(--af-primary)' }}>
              ← Back to Admin Dashboard
            </Link>
            <h1 className="text-2xl font-bold" style={{ fontFamily: "'Lexend', sans-serif", color: 'var(--af-txt)' }}>
              User Management
            </h1>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Users', value: users?.length || 0, color: 'var(--af-txt)' },
            { label: 'With Hedera', value: users?.filter((u) => u.hedera_account_id).length || 0, color: 'var(--af-primary)' },
            { label: 'Admins', value: users?.filter((u) => u.user_roles?.some((r: any) => r.role === 'admin')).length || 0, color: '#a78bfa' },
            { label: 'This Week', value: users?.filter((u) => {
              const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate() - 7)
              return new Date(u.created_at) > weekAgo
            }).length || 0, color: 'var(--af-success)' },
          ].map(({ label, value, color }) => (
            <div key={label} className="af-card p-5">
              <p className="text-xs mb-1" style={{ color: 'var(--af-muted)' }}>{label}</p>
              <p className="text-2xl font-bold" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>

        {/* Create Test User Form */}
        <CreateTestUserForm />

        {/* Users Table */}
        <div className="af-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="af-table">
              <thead>
                <tr>
                  {['User', 'Roles', 'Hedera Account', 'Joined', 'Actions'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users && users.length > 0 ? (
                  users.map((user) => {
                    const roles = user.user_roles?.map((r: any) => r.role) || []
                    return (
                      <tr key={user.id}>
                        <td>
                          <div>
                            <p className="text-sm font-medium" style={{ color: 'var(--af-txt)' }}>{user.full_name || 'No name'}</p>
                            <p className="text-xs" style={{ color: 'var(--af-muted)' }}>{user.email}</p>
                          </div>
                        </td>
                        <td>
                          {roles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {roles.map((role: string) => (
                                <span key={role} className="badge badge-primary capitalize">{role}</span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--af-muted)' }}>No roles</span>
                          )}
                        </td>
                        <td>
                          {user.hedera_account_id ? (
                            <div>
                              <p className="text-xs font-mono" style={{ color: '#34d399' }}>{user.hedera_account_id}</p>
                              <a
                                href={`https://hashscan.io/testnet/account/${user.hedera_account_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs hover:underline"
                                style={{ color: 'var(--af-primary)' }}
                              >
                                View on HashScan ↗
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs" style={{ color: 'var(--af-muted)' }}>Not created</span>
                          )}
                        </td>
                        <td className="text-sm" style={{ color: 'var(--af-muted)' }}>
                          {new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </td>
                        <td>
                          <Link href={`/admin/users/${user.id}`} className="text-sm font-medium hover:underline" style={{ color: 'var(--af-primary)' }}>
                            Manage
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center py-12" style={{ color: 'var(--af-muted)' }}>
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Box */}
        <div className="p-4 rounded-xl" style={{ background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.14)' }}>
          <h3 className="font-semibold mb-2 text-sm" style={{ color: 'var(--af-primary)' }}>ℹ️ User Management</h3>
          <ul className="text-sm space-y-1" style={{ color: 'var(--af-muted)' }}>
            <li>• Click "Manage" to view user details and assign roles</li>
            <li>• Hedera accounts are created by users from their dashboard</li>
            <li>• Role assignments control access to different platform features</li>
          </ul>
        </div>
      </div>
    </>
  )
}
