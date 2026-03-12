/**
 * Admin - Individual User Management
 * View and edit a specific user's details and roles
 */

import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import RoleAssignmentForm from './RoleAssignmentForm'

export default async function AdminUserDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const supabase = await createClient()
  const { id } = await params

  const { data: { user: authUser } } = await supabase.auth.getUser()
  if (!authUser) redirect('/auth/login')

  // Check if user is admin
  const { data: adminRole } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', authUser.id)
    .eq('role', 'admin')
    .single()

  if (!adminRole) redirect('/dashboard')

  // Get user details
  const { data: user, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !user) {
    notFound()
  }

  // Get user roles
  const { data: userRoles } = await supabase
    .from('user_roles')
    .select('id, role, assigned_at')
    .eq('user_id', id)
    .order('assigned_at', { ascending: false })

  // Get recent audit logs for this user
  const { data: auditLogs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('user_id', id)
    .order('created_at', { ascending: false })
    .limit(10)

  const availableRoles = ['uploader', 'transcriber', 'translator', 'reviewer', 'admin', 'buyer']
  const currentRoles = userRoles?.map((r) => r.role) || []

  return (
    <div className="container-modern py-8 space-y-6">
      {/* Header */}
      <div>
        <Link href="/admin/users" className="text-sm font-medium hover:underline mb-2 inline-block" style={{ color: 'var(--af-primary)' }}>
          ← Back to Users
        </Link>
        <h1 className="text-2xl font-bold" style={{ fontFamily: "'Lexend', sans-serif", color: 'var(--af-txt)' }}>
          Manage User
        </h1>
      </div>

      {/* User Info */}
      <div className="af-card p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>User Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { label: 'Full Name', value: user.full_name || 'Not set' },
            { label: 'Email', value: user.email },
            { label: 'Member Since', value: new Date(user.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs mb-1" style={{ color: 'var(--af-muted)' }}>{label}</p>
              <p className="text-sm font-medium" style={{ color: 'var(--af-txt)' }}>{value}</p>
            </div>
          ))}
          <div>
            <p className="text-xs mb-1" style={{ color: 'var(--af-muted)' }}>User ID</p>
            <p className="text-xs font-mono" style={{ color: 'var(--af-muted)' }}>{user.id}</p>
          </div>
        </div>
      </div>

      {/* Hedera Account */}
      <div className="af-card p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>Hedera Account</h2>
        {user.hedera_account_id ? (
          <div className="space-y-3">
            <div>
              <p className="text-xs mb-1" style={{ color: 'var(--af-muted)' }}>Account ID</p>
              <div className="flex items-center gap-3">
                <p className="text-sm font-mono" style={{ color: '#34d399' }}>{user.hedera_account_id}</p>
                <a href={`https://hashscan.io/testnet/account/${user.hedera_account_id}`} target="_blank" rel="noopener noreferrer" className="text-xs hover:underline" style={{ color: 'var(--af-primary)' }}>
                  View on HashScan ↗
                </a>
              </div>
            </div>
            {user.kms_key_id && (
              <div>
                <p className="text-xs mb-1" style={{ color: 'var(--af-muted)' }}>KMS Key ID</p>
                <p className="text-xs font-mono" style={{ color: 'var(--af-muted)' }}>{user.kms_key_id}</p>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--af-muted)' }}>User has not created a Hedera account yet.</p>
        )}
      </div>

      {/* Role Management */}
      <div className="af-card p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>Role Management</h2>

        {/* Current Roles */}
        <div className="mb-6">
          <p className="text-xs mb-2" style={{ color: 'var(--af-muted)' }}>Current Roles</p>
          {currentRoles.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {userRoles?.map((roleData) => (
                <div key={roleData.id} className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs" style={{ background: 'rgba(45,212,191,0.12)', color: 'var(--af-primary)', border: '1px solid rgba(45,212,191,0.2)' }}>
                  <span className="font-medium capitalize">{roleData.role}</span>
                  <span style={{ color: 'var(--af-muted)' }}>({new Date(roleData.assigned_at).toLocaleDateString()})</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--af-muted)' }}>No roles assigned</p>
          )}
        </div>

        <RoleAssignmentForm userId={id} currentRoles={currentRoles} availableRoles={availableRoles} />
      </div>

      {/* Recent Activity */}
      <div className="af-card p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>Recent Activity</h2>
        {auditLogs && auditLogs.length > 0 ? (
          <div className="space-y-3">
            {auditLogs.map((log) => (
              <div key={log.id} className="pl-4 py-2" style={{ borderLeft: '3px solid var(--af-primary)' }}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--af-txt)' }}>{log.action}</p>
                  <p className="text-xs" style={{ color: 'var(--af-muted)' }}>{new Date(log.created_at).toLocaleString()}</p>
                </div>
                <p className="text-xs" style={{ color: 'var(--af-muted)' }}>{log.resource_type}: {log.resource_id}</p>
                {log.details && (
                  <pre className="text-xs mt-1 overflow-x-auto" style={{ color: 'var(--af-muted)' }}>
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--af-muted)' }}>No recent activity</p>
        )}
      </div>
    </div>
  )
}
