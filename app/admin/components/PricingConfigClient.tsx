'use client'

/**
 * PricingConfigClient
 * Allows admin to update the HBAR/USD rate stored in system_config.
 */

import { useState } from 'react'

interface Props {
  initialRate: string
}

export default function PricingConfigClient({ initialRate }: Props) {
  const [rate, setRate] = useState(initialRate)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      const res = await fetch('/api/admin/pricing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hbar_price_usd: rate }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to save pricing')
      } else {
        setRate(String(json.hbar_price_usd))
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  // Derived: price per sample in HBAR
  const rateNum = parseFloat(rate)
  const pricePerSampleHBAR =
    !isNaN(rateNum) && rateNum > 0
      ? (5.0 / rateNum).toFixed(2)
      : '—'

  return (
    <form onSubmit={handleSave} className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--af-muted)' }}>
            HBAR Price (USD per HBAR)
          </label>
          <input
            type="number"
            step="0.0001"
            min="0.0001"
            max="100"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            required
            className="w-full rounded-xl px-3 py-2 text-sm border font-mono"
            style={{
              background: 'var(--af-search-bg)',
              borderColor: 'var(--af-line)',
              color: 'var(--af-txt)',
              outline: 'none',
            }}
          />
          <p className="text-xs mt-1" style={{ color: 'var(--af-muted)' }}>
            1 HBAR = ${!isNaN(rateNum) ? rateNum.toFixed(4) : '—'} USD
          </p>
        </div>

        <div className="af-card p-4 flex flex-col justify-center" style={{ background: 'var(--af-search-bg)' }}>
          <p className="text-xs font-medium mb-1" style={{ color: 'var(--af-muted)' }}>
            Price per sample bundle ($6.00 USD)
          </p>
          <p className="text-2xl font-bold" style={{ color: 'var(--af-primary)' }}>
            {pricePerSampleHBAR} HBAR
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--af-muted)' }}>at current rate</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading}
          className="rounded-xl px-5 py-2 text-sm font-semibold transition-opacity"
          style={{
            background: 'var(--af-primary)',
            color: '#fff',
            opacity: loading ? 0.5 : 1,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? 'Saving…' : 'Save Rate'}
        </button>
        {error && <p className="text-xs" style={{ color: 'var(--af-danger)' }}>{error}</p>}
        {success && <p className="text-xs" style={{ color: '#10b981' }}>✅ Rate updated!</p>}
      </div>

      <p
        className="text-xs p-3 rounded-xl"
        style={{ background: 'var(--af-search-bg)', color: 'var(--af-muted)' }}
      >
        ℹ️ This rate is used at checkout to convert the $6.00 USD per-sample price into HBAR.
        Update it when the market rate changes significantly.
        The PRD specifies $6.00 per sample bundle (audio QC reviewer added at $1.00).
      </p>
    </form>
  )
}
