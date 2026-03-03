'use client'

/**
 * PurchaseDownloadButton — client component
 *
 * Fetches a fresh signed download URL from the API and opens it.
 */

import { useState } from 'react'

interface Props {
  purchaseId: string
}

export default function PurchaseDownloadButton({ purchaseId }: Props) {
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState<string | null>(null)

  const handleDownload = async () => {
    setLoading(true)
    setError(null)
    try {
      const res  = await fetch(`/api/marketplace/download/${purchaseId}`)
      const data = await res.json()

      if (!res.ok || !data.downloadUrl) {
        setError(data.error ?? 'Failed to generate download link')
        return
      }

      // Open the signed URL in a new tab / trigger browser download
      window.open(data.downloadUrl, '_blank', 'noopener,noreferrer')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {error && (
        <div
          className="text-xs p-2 rounded mb-3"
          style={{ background: 'var(--af-surface)', color: 'var(--af-danger)' }}
        >
          {error}
        </div>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          handleDownload()
        }}
        disabled={loading}
        className="btn-primary text-sm"
        onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
        onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
      >
        {loading ? '⏳ Generating link…' : '⬇️ Download Dataset'}
      </button>
    </div>
  )
}
