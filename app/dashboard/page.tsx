/**
 * Dashboard Page
 * Main dashboard for authenticated users
 */

import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CreateHederaAccountButton from './components/CreateHederaAccountButton'

export default async function DashboardPage() {
  const supabase = await createClient()
  
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  // Get user profile and roles
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', session.user.id)
    .single()

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)

  const userRoles = roles?.map((r) => r.role) || []

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-8">
          Dashboard
        </h1>

        {/* Welcome Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-2xl font-semibold text-gray-900 dark:text-white mb-4">
            Welcome, {profile?.full_name || session.user.email}!
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            You're successfully authenticated and ready to start contributing to African
            dialect datasets.
          </p>
        </div>

        {/* Profile Info Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Profile Information
          </h3>
          <div className="space-y-3">
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Email:
              </span>
              <p className="text-gray-900 dark:text-white">{profile?.email}</p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Roles:
              </span>
              <p className="text-gray-900 dark:text-white">
                {userRoles.length > 0 ? userRoles.join(', ') : 'No roles assigned yet'}
              </p>
            </div>
            <div>
              <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                Hedera Account:
              </span>
              <p className="text-gray-900 dark:text-white">
                {profile?.hedera_account_id || 'Not created yet'}
              </p>
            </div>
            {profile?.hedera_account_id && (
              <div>
                <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
                  KMS Key ID:
                </span>
                <p className="text-gray-900 dark:text-white font-mono text-sm">
                  {profile.kms_key_id}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {!profile?.hedera_account_id && (
              <CreateHederaAccountButton />
            )}
            <a
              href="/marketplace"
              className="px-4 py-3 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors text-center"
            >
              Browse Marketplace
            </a>
            <a
              href="/uploader"
              className="px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-center"
            >
              Upload Audio
            </a>
            {userRoles.includes('admin') && (
              <a
                href="/admin"
                className="px-4 py-3 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-center"
              >
                Admin Panel
              </a>
            )}
          </div>
        </div>

        {/* Next Steps */}
        {!profile?.hedera_account_id && (
          <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-yellow-800 dark:text-yellow-400 mb-2">
              Next Steps
            </h3>
            <p className="text-yellow-700 dark:text-yellow-300 text-sm">
              To start contributing and earning rewards, you need to create a Hedera account.
              This will give you a secure, blockchain-backed identity for all your
              contributions.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
