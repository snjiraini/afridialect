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
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/admin/users"
            className="text-blue-600 dark:text-blue-400 hover:underline text-sm mb-2 inline-block"
          >
            ← Back to Users
          </Link>
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Manage User
          </h1>
        </div>

        {/* User Info */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            User Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Full Name
              </label>
              <p className="text-lg text-gray-900 dark:text-white">
                {user.full_name || 'Not set'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Email
              </label>
              <p className="text-lg text-gray-900 dark:text-white">{user.email}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                User ID
              </label>
              <p className="text-sm font-mono text-gray-600 dark:text-gray-400">
                {user.id}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Member Since
              </label>
              <p className="text-gray-900 dark:text-white">
                {new Date(user.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Hedera Account */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Hedera Account
          </h2>
          {user.hedera_account_id ? (
            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Account ID
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-mono text-gray-900 dark:text-white">
                    {user.hedera_account_id}
                  </p>
                  <a
                    href={`https://hashscan.io/testnet/account/${user.hedera_account_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                  >
                    View on HashScan ↗
                  </a>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  KMS Key ID
                </label>
                <p className="text-sm font-mono text-gray-600 dark:text-gray-400">
                  {user.kms_key_id}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">
              User has not created a Hedera account yet.
            </p>
          )}
        </div>

        {/* Role Management */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Role Management
          </h2>
          
          {/* Current Roles */}
          <div className="mb-6">
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400 block mb-2">
              Current Roles
            </label>
            {currentRoles.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {userRoles?.map((roleData) => (
                  <div
                    key={roleData.id}
                    className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full"
                  >
                    <span className="font-medium capitalize">{roleData.role}</span>
                    <span className="text-xs text-blue-600 dark:text-blue-300">
                      ({new Date(roleData.assigned_at).toLocaleDateString()})
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 dark:text-gray-400">No roles assigned</p>
            )}
          </div>

          {/* Assign/Remove Roles */}
          <RoleAssignmentForm
            userId={id}
            currentRoles={currentRoles}
            availableRoles={availableRoles}
          />
        </div>

        {/* Recent Activity */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          {auditLogs && auditLogs.length > 0 ? (
            <div className="space-y-3">
              {auditLogs.map((log) => (
                <div
                  key={log.id}
                  className="border-l-4 border-blue-500 pl-4 py-2"
                >
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-gray-900 dark:text-white">
                      {log.action}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {new Date(log.created_at).toLocaleString()}
                    </p>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {log.resource_type}: {log.resource_id}
                  </p>
                  {log.details && (
                    <pre className="text-xs text-gray-500 dark:text-gray-400 mt-1 overflow-x-auto">
                      {JSON.stringify(log.details, null, 2)}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-600 dark:text-gray-400">No recent activity</p>
          )}
        </div>
      </div>
    </div>
  )
}
