/**
 * Profile Page
 * View user profile and Hedera account details
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ProfilePage() {
  const supabase = await createClient()
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  // Get user roles
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)

  const userRoles = roles?.map((r) => r.role) || []

  // Get Hedera account balance if account exists
  let accountBalance = null
  if (profile?.hedera_account_id) {
    // TODO: Implement getAccountBalance in a server action
    // For now, we'll just show the account ID
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            My Profile
          </h1>
          <Link
            href="/profile/edit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
          >
            Edit Profile
          </Link>
        </div>

        {/* Basic Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Basic Information
          </h2>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Full Name
              </label>
              <p className="text-lg text-gray-900 dark:text-white">
                {profile?.full_name || 'Not set'}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Email Address
              </label>
              <p className="text-lg text-gray-900 dark:text-white">
                {profile?.email}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                User ID
              </label>
              <p className="text-sm font-mono text-gray-600 dark:text-gray-400">
                {session.user.id}
              </p>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Member Since
              </label>
              <p className="text-gray-900 dark:text-white">
                {new Date(profile?.created_at || '').toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
            </div>
          </div>
        </div>

        {/* Roles & Permissions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Roles & Permissions
          </h2>
          <div className="space-y-3">
            {userRoles.length === 0 ? (
              <p className="text-gray-600 dark:text-gray-400">
                No roles assigned yet. Contact an administrator to request roles.
              </p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {userRoles.map((role) => (
                  <span
                    key={role}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 rounded-full text-sm font-medium"
                  >
                    {role.charAt(0).toUpperCase() + role.slice(1)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Hedera Account */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Hedera Account
          </h2>
          {profile?.hedera_account_id ? (
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Account ID
                </label>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-mono text-gray-900 dark:text-white">
                    {profile.hedera_account_id}
                  </p>
                  <a
                    href={`https://hashscan.io/${process.env.HEDERA_NETWORK || 'testnet'}/account/${profile.hedera_account_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-700 text-sm"
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
                  {profile.kms_key_id}
                </p>
              </div>
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Account Type
                </label>
                <p className="text-gray-900 dark:text-white">
                  ThresholdKey (2-of-2) - Secure custody with platform guardian
                </p>
              </div>
              {/* Balance placeholder */}
              <div>
                <label className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  Balance
                </label>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Balance information coming soon
                </p>
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                You haven't created a Hedera account yet.
              </p>
              <Link
                href="/dashboard"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Go to Dashboard to Create Account
              </Link>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/dashboard"
            className="block p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Dashboard
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View your activity and contributions
            </p>
          </Link>
          <Link
            href="/auth/update-password"
            className="block p-4 bg-white dark:bg-gray-800 rounded-lg shadow-md hover:shadow-lg transition-shadow"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
              Change Password
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Update your account password
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}
