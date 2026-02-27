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
      setTimeout(() => { router.refresh() }, 2000)
    }
  }

  if (success) {
    return (
      <div className="af-card p-4 border-l-4" style={{ borderColor: 'var(--af-success)' }}>
        <p className="font-semibold" style={{ color: 'var(--af-success)' }}>
          ✅ Hedera account created successfully!
        </p>
        <p className="text-sm mt-1" style={{ color: 'var(--af-muted)' }}>
          Refreshing dashboard...
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <button
        onClick={handleCreateAccount}
        disabled={creating}
        type="button"
        className="btn-primary w-full"
      >
        {creating ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
            Creating account...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            Create Hedera Account
          </span>
        )}
      </button>

      {error && (
        <div className="af-card p-3 border-l-4" style={{ borderColor: 'var(--af-danger)' }}>
          <p className="text-sm" style={{ color: 'var(--af-danger)' }}>{error}</p>
        </div>
      )}

      <p className="text-xs" style={{ color: 'var(--af-muted)' }}>
        Creates a secure blockchain account with 2-of-2 key custody (your key + platform guardian key)
      </p>
    </div>
  )
}
