/**
 * Admin Dashboard Page
 * Manage users, roles, and view system analytics
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function AdminPage() {
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

  // Get statistics
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const { count: usersWithHedera } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .not('hedera_account_id', 'is', null)

  const { count: verifiedUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .not('email_verified', 'is', null)

  // Get recent users
  const { data: recentUsers } = await supabase
    .from('profiles')
    .select('id, email, full_name, hedera_account_id, created_at')
    .order('created_at', { ascending: false })
    .limit(10)

  // Get role distribution
  const { data: roleStats } = await supabase
    .from('user_roles')
    .select('role')

  const roleCounts = roleStats?.reduce((acc, { role }) => {
    acc[role] = (acc[role] || 0) + 1
    return acc
  }, {} as Record<string, number>) || {}

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
          Admin Dashboard
        </h1>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Total Users
            </h3>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {totalUsers || 0}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Hedera Accounts
            </h3>
            <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
              {usersWithHedera || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {totalUsers ? Math.round(((usersWithHedera || 0) / totalUsers) * 100) : 0}% of users
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
            <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">
              Verified Emails
            </h3>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {verifiedUsers || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {totalUsers ? Math.round(((verifiedUsers || 0) / totalUsers) * 100) : 0}% verified
            </p>
          </div>
        </div>

        {/* Role Distribution */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Role Distribution
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {Object.entries(roleCounts).map(([role, count]) => (
              <div key={role} className="text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {count}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {role}s
                </p>
              </div>
            ))}
            {Object.keys(roleCounts).length === 0 && (
              <p className="col-span-full text-gray-600 dark:text-gray-400">
                No roles assigned yet
              </p>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              href="/admin/users"
              className="block p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-500 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
            >
              <h3 className="font-semibold text-blue-900 dark:text-blue-400 mb-2">
                Manage Users
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                View and edit user profiles, assign roles
              </p>
            </Link>

            <Link
              href="/admin/audit-logs"
              className="block p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-500 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
            >
              <h3 className="font-semibold text-purple-900 dark:text-purple-400 mb-2">
                Audit Logs
              </h3>
              <p className="text-sm text-purple-700 dark:text-purple-300">
                View system activity and security events
              </p>
            </Link>

            <Link
              href="/admin/settings"
              className="block p-4 bg-gray-50 dark:bg-gray-700/50 border border-gray-500 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <h3 className="font-semibold text-gray-900 dark:text-gray-400 mb-2">
                System Settings
              </h3>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Configure dialects, pricing, and more
              </p>
            </Link>
          </div>
        </div>

        {/* Recent Users */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Recent Users
          </h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Hedera Account
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                {recentUsers && recentUsers.length > 0 ? (
                  recentUsers.map((user) => (
                    <tr key={user.id}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {user.full_name || 'No name'}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {user.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {user.hedera_account_id ? (
                          <span className="text-xs font-mono text-green-600 dark:text-green-400">
                            {user.hedera_account_id}
                          </span>
                        ) : (
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            Not created
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 dark:text-gray-400">
                        {new Date(user.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          href={`/admin/users/${user.id}`}
                          className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
                        >
                          View
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-8 text-center text-gray-600 dark:text-gray-400"
                    >
                      No users found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
