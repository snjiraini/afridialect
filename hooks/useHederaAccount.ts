/**
 * Hedera Account Hook
 * Client-side hook for managing Hedera account creation and info
 */

'use client'

import { useState } from 'react'

interface CreateAccountResult {
  accountId: string
  evmAddress: string
  transactionId: string
}

export function useHederaAccount() {
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Create a new Hedera account with ThresholdKey (2-of-2) custody
   */
  const createAccount = async (): Promise<CreateAccountResult | null> => {
    setCreating(true)
    setError(null)

    try {
      const response = await fetch('/api/hedera/create-account', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create account')
      }

      return {
        accountId: data.accountId,
        evmAddress: data.evmAddress,
        transactionId: data.transactionId,
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      return null
    } finally {
      setCreating(false)
    }
  }

  return {
    createAccount,
    creating,
    error,
  }
}
