/**
 * Create Test User Form Component
 * Allows admins to create users with any email format for testing
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateTestUserForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName: fullName || 'Test User',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      setSuccess(`User created: ${data.user.email} (ID: ${data.user.id})`)
      setEmail('')
      setPassword('')
      setFullName('')
      
      // Refresh the page to show new user
      setTimeout(() => {
        router.refresh()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const generateTestEmail = () => {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000)
    // Use gmail.com as it has valid MX records
    setEmail(`test${timestamp}${random}@gmail.com`)
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
        Create Test User
      </h3>
      
      <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-500 rounded-lg">
        <p className="text-sm text-yellow-800 dark:text-yellow-400 mb-2">
          ⚠️ <strong>Email Domain Validation:</strong>
        </p>
        <ul className="text-xs text-yellow-700 dark:text-yellow-300 space-y-1 ml-4">
          <li>• Supabase validates email domains (checks DNS/MX records)</li>
          <li>• Use real domains: gmail.com, yahoo.com, outlook.com, etc.</li>
          <li>• Or use test services: mailinator.com, guerrillamail.com</li>
          <li>• Custom domains like @afridialect.ai need valid MX records</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email *
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test123@gmail.com"
              className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
              required
            />
            <button
              type="button"
              onClick={generateTestEmail}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 text-sm"
            >
              Generate
            </button>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Use domains with valid MX records (gmail.com, yahoo.com, etc.)
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Password *
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            required
            minLength={8}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Test User (optional)"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-500 rounded-lg">
            <p className="text-sm text-red-800 dark:text-red-400">❌ {error}</p>
          </div>
        )}

        {success && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-500 rounded-lg">
            <p className="text-sm text-green-800 dark:text-green-400">✅ {success}</p>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-lg font-medium transition-colors"
        >
          {loading ? 'Creating...' : 'Create User'}
        </button>
      </form>
    </div>
  )
}
