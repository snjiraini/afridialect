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
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/admin"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm mb-2 inline-block"
            >
              ← Back to Admin Dashboard
            </Link>
            <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
              User Management
            </h1>
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Total Users</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {users?.length || 0}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">With Hedera</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {users?.filter((u) => u.hedera_account_id).length || 0}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">Admins</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {users?.filter((u) => u.user_roles?.some((r: any) => r.role === 'admin')).length || 0}
            </p>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">This Week</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">
              {users?.filter((u) => {
                const weekAgo = new Date()
                weekAgo.setDate(weekAgo.getDate() - 7)
                return new Date(u.created_at) > weekAgo
              }).length || 0}
            </p>
          </div>
        </div>

        {/* Create Test User Form */}
        <div className="mb-8">
          <CreateTestUserForm />
        </div>

        {/* Users Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Roles
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Hedera Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {users && users.length > 0 ? (
                  users.map((user) => {
                    const roles = user.user_roles?.map((r: any) => r.role) || []
                    return (
                      <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                        <td className="px-6 py-4">
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {user.full_name || 'No name'}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {user.email}
                            </p>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          {roles.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {roles.map((role: string) => (
                                <span
                                  key={role}
                                  className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400"
                                >
                                  {role}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              No roles
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          {user.hedera_account_id ? (
                            <div>
                              <p className="text-xs font-mono text-green-600 dark:text-green-400">
                                {user.hedera_account_id}
                              </p>
                              <a
                                href={`https://hashscan.io/testnet/account/${user.hedera_account_id}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                              >
                                View on HashScan ↗
                              </a>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              Not created
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                          {new Date(user.created_at).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                          })}
                        </td>
                        <td className="px-6 py-4">
                          <Link
                            href={`/admin/users/${user.id}`}
                            className="text-blue-600 dark:text-blue-400 hover:underline text-sm font-medium"
                          >
                            Manage
                          </Link>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-6 py-12 text-center text-gray-600 dark:text-gray-400"
                    >
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-500 rounded-lg p-4">
          <h3 className="text-blue-800 dark:text-blue-400 font-semibold mb-2">
            ℹ️ User Management
          </h3>
          <ul className="text-blue-700 dark:text-blue-300 text-sm space-y-1">
            <li>• Click "Manage" to view user details and assign roles</li>
            <li>• Hedera accounts are created by users from their dashboard</li>
            <li>• Role assignments control access to different platform features</li>
          </ul>
        </div>
      </div>
    </div>
  )
}
