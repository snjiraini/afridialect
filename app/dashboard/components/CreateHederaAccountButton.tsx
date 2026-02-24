/**
 * Create Hedera Account Button
 * Client component for creating a Hedera account with ThresholdKey custody
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useHederaAccount } from '@/hooks/useHederaAccount'

export default function CreateHederaAccountButton() {
  const router = useRouter()
  const { createAccount, creating, error } = useHederaAccount()
  const [success, setSuccess] = useState(false)

  const handleCreateAccount = async () => {
    const result = await createAccount()
    
    if (result) {
      setSuccess(true)
      // Refresh the page to show updated profile
      setTimeout(() => {
        router.refresh()
      }, 2000)
    }
  }

  if (success) {
    return (
      <div className="px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-md border border-green-500">
        <p className="text-green-800 dark:text-green-400 font-medium">
          ✅ Hedera account created successfully!
        </p>
        <p className="text-green-700 dark:text-green-300 text-sm mt-1">
          Refreshing dashboard...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleCreateAccount}
        disabled={creating}
        type="button"
        className="w-full px-4 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
      >
        {creating ? (
          <span className="flex items-center justify-center">
            <svg
              className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            Creating account...
          </span>
        ) : (
          '🔐 Create Hedera Account'
        )}
      </button>

      {error && (
        <div className="px-3 py-2 bg-red-50 dark:bg-red-900/20 rounded-md border border-red-500">
          <p className="text-red-800 dark:text-red-400 text-sm">{error}</p>
        </div>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        Creates a secure blockchain account with 2-of-2 key custody (your key + platform guardian key)
      </p>
    </div>
  )
}
