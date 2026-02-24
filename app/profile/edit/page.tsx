/**
 * Edit Profile Page
 * Update user profile information
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'

export default function EditProfilePage() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()
  
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Load current profile
  useEffect(() => {
    async function loadProfile() {
      if (!user) return

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()

        if (error) throw error

        setFullName(data.full_name || '')
      } catch (err) {
        console.error('Error loading profile:', err)
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [user, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
        })
        .eq('id', user.id)

      if (error) throw error

      setSuccess(true)
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/profile')
      }, 2000)
    } catch (err) {
      console.error('Error updating profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-300 dark:bg-gray-700 rounded w-1/3 mb-8"></div>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
              <div className="space-y-4">
                <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-1/4"></div>
                <div className="h-10 bg-gray-300 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
            Edit Profile
          </h1>
          <button
            onClick={() => router.push('/profile')}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            Cancel
          </button>
        </div>

        {success && (
          <div className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-500 rounded-lg p-4">
            <p className="text-green-800 dark:text-green-400 font-medium">
              ✅ Profile updated successfully! Redirecting...
            </p>
          </div>
        )}

        {error && (
          <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-500 rounded-lg p-4">
            <p className="text-red-800 dark:text-red-400">{error}</p>
          </div>
        )}

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="full-name"
                className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
              >
                Full Name
              </label>
              <input
                id="full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter your full name"
              />
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-500 rounded-lg p-4">
              <h3 className="text-blue-800 dark:text-blue-400 font-semibold mb-2">
                ℹ️ Note
              </h3>
              <ul className="text-blue-700 dark:text-blue-300 text-sm space-y-1">
                <li>• Email address cannot be changed after registration</li>
                <li>• To change your password, use the "Change Password" link</li>
                <li>• Hedera account details are read-only for security</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                type="button"
                onClick={() => router.push('/profile')}
                className="px-4 py-2 border border-gray-300 dark:border-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
