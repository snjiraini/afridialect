'use client'

/**
 * MarketplaceClient — interactive browse, filter, cart, and checkout
 *
 * Design: matches af-card / container-modern / btn-primary system
 */

import { useState, useCallback, useEffect } from 'react'
import type { MarketplaceClip, DatasetFilter } from '@/types'
import { PRICE_PER_SAMPLE_USD } from '@/types'

interface Dialect {
  id: string
  code: string
  name: string
  country_code: string
}

interface RecentPurchase {
  id: string
  sample_count: number
  price_usd: number
  payment_status: string
  created_at: string
  downloaded_at: string | null
}

interface Props {
  dialects: Dialect[]
  recentPurchases: RecentPurchase[]
  hasBuyerRole: boolean
  userId: string
}

const GENDER_OPTIONS  = ['male', 'female', 'mixed', 'unknown']
const AGE_OPTIONS     = ['child', 'teen', 'adult', 'senior', 'mixed']

export default function MarketplaceClient({
  dialects,
  recentPurchases,
  hasBuyerRole,
}: Props) {
  // ── Filter state ────────────────────────────────────────────────────
  const [selectedDialects, setSelectedDialects] = useState<string[]>([])
  const [selectedGenders,  setSelectedGenders]  = useState<string[]>([])
  const [selectedAges,     setSelectedAges]      = useState<string[]>([])
  const [minDuration, setMinDuration] = useState('')
  const [maxDuration, setMaxDuration] = useState('')
  const [speakerCount, setSpeakerCount] = useState('')

  // ── Browse state ────────────────────────────────────────────────────
  const [clips,   setClips]   = useState<MarketplaceClip[]>([])
  const [total,   setTotal]   = useState(0)
  const [loading, setLoading] = useState(false)
  const [browsed, setBrowsed] = useState(false)
  const [browseError, setBrowseError] = useState<string | null>(null)

  // ── Cart state ──────────────────────────────────────────────────────
  const [cart, setCart] = useState<MarketplaceClip[]>([])

  // ── Checkout state ──────────────────────────────────────────────────
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError,   setCheckoutError]   = useState<string | null>(null)
  const [purchaseResult,  setPurchaseResult]  = useState<{
    purchaseId: string
    sampleCount: number
    priceUSD: number
    priceHBAR: number
  } | null>(null)
  // SSE step tracking — shows real-time Hedera console progress
  const [checkoutStep,    setCheckoutStep]    = useState<string | null>(null)
  const [checkoutStepMsg, setCheckoutStepMsg] = useState<string>('')
  const [checkoutStepDtl, setCheckoutStepDtl] = useState<string>('')
  const [paymentLoading,    setPaymentLoading]    = useState(false)
  const [paymentError,      setPaymentError]      = useState<string | null>(null)
  const [paymentTxId,       setPaymentTxId]       = useState<string | null>(null)
  const [hashscanUrl,       setHashscanUrl]       = useState<string | null>(null)

  // ── HBAR rate & buyer balance ────────────────────────────────────────
  // Live rate from CoinGecko; falls back to 0.15 if unavailable
  const [hbarRateUSD,     setHbarRateUSD]     = useState(0.15)
  const [buyerBalanceHbar, setBuyerBalanceHbar] = useState<number | null>(null)
  const [balanceLoading,   setBalanceLoading]   = useState(false)

  // Fetch live HBAR rate + buyer balance once on mount
  useEffect(() => {
    // Live HBAR/USD rate
    fetch('https://api.coingecko.com/api/v3/simple/price?ids=hedera-hashgraph&vs_currencies=usd')
      .then(r => r.json())
      .then(d => {
        const rate = d?.['hedera-hashgraph']?.usd
        if (typeof rate === 'number' && rate > 0) setHbarRateUSD(rate)
      })
      .catch(() => { /* keep fallback 0.15 */ })

    // Buyer's Hedera account balance
    if (hasBuyerRole) {
      setBalanceLoading(true)
      fetch('/api/hedera/balance')
        .then(r => r.json())
        .then(d => {
          if (typeof d.hbar === 'number') setBuyerBalanceHbar(d.hbar)
        })
        .catch(() => { /* silent — balance display is best-effort */ })
        .finally(() => setBalanceLoading(false))
    }
  }, [hasBuyerRole])

  // ── Browse handler ──────────────────────────────────────────────────
  const handleBrowse = useCallback(async () => {
    setLoading(true)
    setBrowseError(null)
    try {
      const params = new URLSearchParams()
      if (selectedDialects.length > 0) params.set('dialects', selectedDialects.join(','))
      if (selectedGenders.length  > 0) params.set('gender',   selectedGenders.join(','))
      if (selectedAges.length     > 0) params.set('age',      selectedAges.join(','))
      if (minDuration) params.set('minDuration', minDuration)
      if (maxDuration) params.set('maxDuration', maxDuration)
      if (speakerCount) params.set('speakerCount', speakerCount)
      params.set('limit', '100')

      const res  = await fetch(`/api/marketplace/clips?${params.toString()}`)
      const data = await res.json()
      if (!res.ok) {
        setBrowseError(data.error ?? 'Failed to fetch clips')
      } else {
        setClips(data.clips ?? [])
        setTotal(data.total ?? 0)
        setBrowsed(true)
      }
    } catch (err) {
      setBrowseError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setLoading(false)
    }
  }, [selectedDialects, selectedGenders, selectedAges, minDuration, maxDuration, speakerCount])

  // ── Cart helpers ────────────────────────────────────────────────────
  const isInCart = (id: string) => cart.some((c) => c.id === id)

  const toggleCart = (clip: MarketplaceClip) => {
    if (isInCart(clip.id)) {
      setCart((prev) => prev.filter((c) => c.id !== clip.id))
    } else {
      setCart((prev) => [...prev, clip])
    }
  }

  const clearCart = () => setCart([])

  // ── Checkout handler (SSE streaming — blockchain first, DB on success) ─
  const handleCheckout = async () => {
    if (cart.length === 0) return
    if (!hasBuyerRole) {
      setCheckoutError('You need the buyer role to purchase datasets. Contact an admin.')
      return
    }

    // ── Pre-flight: balance check ────────────────────────────────────
    const cartTotalUSD  = cart.length * PRICE_PER_SAMPLE_USD
    const cartTotalHbar = hbarRateUSD > 0 ? cartTotalUSD / hbarRateUSD : 0
    if (buyerBalanceHbar !== null && buyerBalanceHbar < cartTotalHbar) {
      setCheckoutError(
        `Insufficient HBAR balance. You need ≈ℏ${cartTotalHbar.toFixed(2)} but your account only has ℏ${buyerBalanceHbar.toFixed(2)}. ` +
        `Please top up your Hedera account before purchasing.`
      )
      return
    }

    setCheckoutLoading(true)
    setPaymentLoading(true)
    setCheckoutError(null)
    setPaymentError(null)
    setPaymentTxId(null)
    setHashscanUrl(null)
    setCheckoutStep('validating')
    setCheckoutStepMsg('Starting checkout…')
    setCheckoutStepDtl('')

    try {
      const filters: DatasetFilter = {
        dialects:      selectedDialects.length > 0 ? selectedDialects : undefined,
        speakerGender: selectedGenders.length  > 0 ? selectedGenders  : undefined,
        speakerAge:    selectedAges.length      > 0 ? selectedAges     : undefined,
        minDuration:   minDuration  ? parseFloat(minDuration)  : undefined,
        maxDuration:   maxDuration  ? parseFloat(maxDuration)  : undefined,
        speakerCount:  speakerCount ? parseInt(speakerCount)   : undefined,
      }

      const response = await fetch('/api/marketplace/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipIds: cart.map((c) => c.id), filters, hbarRateUSD }),
      })

      if (!response.ok || !response.body) {
        const errText = await response.text().catch(() => 'Checkout failed')
        setCheckoutError(errText)
        setCheckoutLoading(false)
        setPaymentLoading(false)
        setCheckoutStep(null)
        return
      }

      // Read SSE stream
      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // Split on double-newline (SSE event boundary)
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? '' // keep any incomplete chunk

        for (const raw of events) {
          const line = raw.trim()
          if (!line.startsWith('data:')) continue

          try {
            const event = JSON.parse(line.slice(5).trim()) as {
              step:        string
              message:     string
              detail?:     string
              txId?:       string
              hashscanUrl?: string
              purchaseId?: string
              sampleCount?: number
              priceUSD?:   number
              priceHBAR?:  number
              error?:      string
            }

            setCheckoutStep(event.step)
            setCheckoutStepMsg(event.message)
            setCheckoutStepDtl(event.detail ?? '')

            if (event.step === 'done') {
              // Success — now clear cart and set results
              setCart([])
              setPaymentTxId(event.txId ?? null)
              setHashscanUrl(event.hashscanUrl ?? null)
              if (event.purchaseId) {
                setPurchaseResult({
                  purchaseId:  event.purchaseId,
                  sampleCount: event.sampleCount ?? cart.length,
                  priceUSD:    event.priceUSD    ?? cartTotalUSD,
                  priceHBAR:   event.priceHBAR   ?? cartTotalHbar,
                })
              }
              // Refresh balance to reflect the deduction
              fetch('/api/hedera/balance').then(r => r.json()).then(d => {
                if (typeof d.hbar === 'number') setBuyerBalanceHbar(d.hbar)
              }).catch(() => {})
            }

            if (event.step === 'error') {
              setPaymentError(friendlyPaymentError(event.error))
              // Refresh balance — nothing was charged but keep UI accurate
              fetch('/api/hedera/balance').then(r => r.json()).then(d => {
                if (typeof d.hbar === 'number') setBuyerBalanceHbar(d.hbar)
              }).catch(() => {})
            }
          } catch {
            // Malformed SSE line — ignore
          }
        }
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setCheckoutLoading(false)
      setPaymentLoading(false)
    }
  }

  // ── Toggle helpers for multi-select filters ─────────────────────────
  const toggleFilter = (
    value: string,
    state: string[],
    setState: (s: string[]) => void
  ) => {
    if (state.includes(value)) setState(state.filter((v) => v !== value))
    else setState([...state, value])
  }

  // ── Maps raw Hedera/server error strings to buyer-friendly messages ──
  const friendlyPaymentError = (raw: string | undefined): string => {
    if (!raw) return 'On-chain payment failed. No funds were deducted. Please try again or contact support.'
    const r = raw.toUpperCase()
    if (r.includes('INSUFFICIENT_ACCOUNT_BALANCE') || r.includes('INSUFFICIENT_PAYER_BALANCE')) {
      return `Your HBAR balance is too low to complete this payment. Please top up your Hedera account.`
    }
    if (r.includes('INVALID_SIGNATURE')) {
      return 'Payment authorisation failed. This is a technical issue — your account has NOT been charged. Please contact support.'
    }
    if (r.includes('ACCOUNT_NOT_FOUND') || r.includes('INVALID_ACCOUNT_ID')) {
      return 'Your Hedera account could not be found. Please contact support.'
    }
    if (r.includes('TRANSACTION_EXPIRED')) {
      return 'The payment timed out. Please try again.'
    }
    return 'On-chain payment could not be processed. Your account has not been charged. Contact support if this persists.'
  }

  const cartTotal = parseFloat((cart.length * PRICE_PER_SAMPLE_USD).toFixed(2))

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="grid lg:grid-cols-4 gap-6">
      {/* ── Left: Filters ─────────────────────────────────────────── */}
      <aside className="lg:col-span-1 space-y-4">
        <div className="af-card p-5">
          <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--af-txt)' }}>
            🔍 Filters
          </h2>

          {/* Dialect */}
          <div className="mb-4">
            <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--af-muted)' }}>
              Dialect
            </p>
            <div className="space-y-1 max-h-40 overflow-y-auto">
              {dialects.map((d) => (
                <label
                  key={d.id}
                  className="flex items-center gap-2 cursor-pointer"
                  style={{ color: 'var(--af-txt)' }}
                >
                  <input
                    type="checkbox"
                    checked={selectedDialects.includes(d.code)}
                    onChange={() => toggleFilter(d.code, selectedDialects, setSelectedDialects)}
                    className="rounded"
                  />
                  <span className="text-xs">{d.name}</span>
                  <span className="text-[10px] ml-auto" style={{ color: 'var(--af-muted)' }}>{d.country_code}</span>
                </label>
              ))}
              {dialects.length === 0 && (
                <p className="text-xs" style={{ color: 'var(--af-muted)' }}>No dialects available</p>
              )}
            </div>
          </div>

          {/* Gender */}
          <div className="mb-4">
            <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--af-muted)' }}>
              Speaker Gender
            </p>
            <div className="flex flex-wrap gap-1">
              {GENDER_OPTIONS.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleFilter(g, selectedGenders, setSelectedGenders) }}
                  className="text-[11px] px-2 py-0.5 rounded-full border transition-colors"
                  style={{
                    borderColor:     selectedGenders.includes(g) ? 'var(--af-primary)' : 'var(--af-line)',
                    backgroundColor: selectedGenders.includes(g) ? 'var(--af-primary)' : 'transparent',
                    color:           selectedGenders.includes(g) ? '#fff' : 'var(--af-muted)',
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
          </div>

          {/* Age */}
          <div className="mb-4">
            <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--af-muted)' }}>
              Speaker Age
            </p>
            <div className="flex flex-wrap gap-1">
              {AGE_OPTIONS.map((a) => (
                <button
                  key={a}
                  type="button"
                  onClick={(e) => { e.stopPropagation(); toggleFilter(a, selectedAges, setSelectedAges) }}
                  className="text-[11px] px-2 py-0.5 rounded-full border transition-colors"
                  style={{
                    borderColor:     selectedAges.includes(a) ? 'var(--af-primary)' : 'var(--af-line)',
                    backgroundColor: selectedAges.includes(a) ? 'var(--af-primary)' : 'transparent',
                    color:           selectedAges.includes(a) ? '#fff' : 'var(--af-muted)',
                  }}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>

          {/* Duration range */}
          <div className="mb-4">
            <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--af-muted)' }}>
              Duration (seconds)
            </p>
            <div className="flex gap-2">
              <input
                type="number"
                placeholder="Min"
                value={minDuration}
                onChange={(e) => setMinDuration(e.target.value)}
                className="w-full text-xs rounded border px-2 py-1"
                style={{ borderColor: 'var(--af-line)', background: 'var(--af-card)', color: 'var(--af-txt)' }}
              />
              <input
                type="number"
                placeholder="Max"
                value={maxDuration}
                onChange={(e) => setMaxDuration(e.target.value)}
                className="w-full text-xs rounded border px-2 py-1"
                style={{ borderColor: 'var(--af-line)', background: 'var(--af-card)', color: 'var(--af-txt)' }}
              />
            </div>
          </div>

          {/* Speaker count */}
          <div className="mb-5">
            <p className="text-[11px] font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--af-muted)' }}>
              Speaker Count
            </p>
            <input
              type="number"
              placeholder="Any"
              value={speakerCount}
              onChange={(e) => setSpeakerCount(e.target.value)}
              className="w-full text-xs rounded border px-2 py-1"
              style={{ borderColor: 'var(--af-line)', background: 'var(--af-card)', color: 'var(--af-txt)' }}
            />
          </div>

          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleBrowse() }}
            disabled={loading}
            className="btn-primary w-full text-sm"
          >
            {loading ? 'Searching…' : 'Search Clips'}
          </button>
        </div>

        {/* Recent purchases */}
        {recentPurchases.length > 0 && (
          <div className="af-card p-5">
            <h2 className="font-semibold text-sm mb-3" style={{ color: 'var(--af-txt)' }}>
              🧾 Recent Purchases
            </h2>
            <div className="space-y-2">
              {recentPurchases.map((p) => (
                <a
                  key={p.id}
                  href={`/marketplace/purchase/${p.id}`}
                  className="block text-xs rounded-lg p-2 transition-colors"
                  style={{
                    background: 'var(--af-surface)',
                    borderLeft: '3px solid var(--af-primary)',
                    color: 'var(--af-txt)',
                  }}
                >
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="font-medium">{p.sample_count} samples</span>
                    <span style={{ color: 'var(--af-primary)' }}>${p.price_usd.toFixed(2)}</span>
                  </div>
                  <div style={{ color: 'var(--af-muted)' }}>
                    {new Date(p.created_at).toLocaleDateString()}
                    {p.downloaded_at ? ' · downloaded' : ' · not yet downloaded'}
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}
      </aside>

      {/* ── Centre: Clip Grid ──────────────────────────────────────── */}
      <main className="lg:col-span-2 space-y-4">
        {browseError && (
          <div className="af-card p-4 text-sm" style={{ borderLeft: '4px solid var(--af-danger)', color: 'var(--af-danger)' }}>
            {browseError}
          </div>
        )}

        {!browsed && !loading && (
          <div className="af-card p-10 text-center">
            <div className="text-4xl mb-3">🎙️</div>
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--af-txt)' }}>
              Ready to explore African dialect datasets
            </p>
            <p className="text-xs" style={{ color: 'var(--af-muted)' }}>
              Apply filters on the left, then click <strong>Search Clips</strong> to browse available samples.
            </p>
          </div>
        )}

        {loading && (
          <div className="af-card p-10 text-center">
            <div className="text-2xl mb-2 animate-pulse">⏳</div>
            <p className="text-sm" style={{ color: 'var(--af-muted)' }}>Loading clips…</p>
          </div>
        )}

        {browsed && !loading && clips.length === 0 && (
          <div className="af-card p-10 text-center">
            <div className="text-3xl mb-3">🔍</div>
            <p className="text-sm" style={{ color: 'var(--af-muted)' }}>No clips match your filters. Try broadening your search.</p>
          </div>
        )}

        {!loading && clips.length > 0 && (
          <>
            <div className="flex items-center justify-between">
              <p className="text-xs" style={{ color: 'var(--af-muted)' }}>
                Showing <strong style={{ color: 'var(--af-txt)' }}>{clips.length}</strong> of{' '}
                <strong style={{ color: 'var(--af-txt)' }}>{total}</strong> clips — each $6.00 USD
              </p>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              {clips.map((clip) => {
                const inCart = isInCart(clip.id)
                return (
                  <div
                    key={clip.id}
                    className="af-card p-4 flex flex-col gap-3"
                    style={{ border: inCart ? '2px solid var(--af-primary)' : undefined }}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--af-txt)' }}>
                          {clip.dialectName}
                        </p>
                        <p className="text-[11px]" style={{ color: 'var(--af-muted)' }}>
                          {clip.dialectCode.toUpperCase()}
                        </p>
                      </div>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                        style={{ background: 'var(--af-surface)', color: 'var(--af-primary)', fontWeight: 600 }}
                      >
                        $6.00
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-1 text-[11px]" style={{ color: 'var(--af-muted)' }}>
                      <span>⏱ {clip.durationSeconds.toFixed(1)}s</span>
                      <span>👥 {clip.speakerCount} speaker{clip.speakerCount !== 1 ? 's' : ''}</span>
                      <span>⚧ {clip.speakerGender}</span>
                      <span>🎂 {clip.speakerAge}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); toggleCart(clip) }}
                      className="text-xs px-3 py-1.5 rounded-lg border transition-colors w-full font-medium"
                      style={{
                        borderColor:     inCart ? 'var(--af-danger)' : 'var(--af-primary)',
                        backgroundColor: inCart ? 'var(--af-danger)' : 'var(--af-primary)',
                        color:           '#fff',
                      }}
                    >
                      {inCart ? '✕ Remove from cart' : '+ Add to cart'}
                    </button>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </main>

      {/* ── Right: Cart ───────────────────────────────────────────── */}
      <aside className="lg:col-span-1 space-y-4">
        {/* SSE live checkout progress — shown while streaming or after completion/error */}
        {checkoutStep && (
          <div
            className="af-card p-5"
            style={{
              borderLeft: `4px solid ${
                checkoutStep === 'done'  ? 'var(--af-success)' :
                checkoutStep === 'error' ? 'var(--af-danger)'  :
                'var(--af-primary)'
              }`,
            }}
          >
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--af-txt)' }}>
              {checkoutStep === 'done'  ? '✅ Purchase Complete' :
               checkoutStep === 'error' ? '⚠️ Purchase Failed'  :
               '⏳ Processing…'}
            </p>

            {/* Real-time step list */}
            <div className="space-y-2 mb-3">
              {([
                { key: 'validating',    label: 'Validating clips & account' },
                { key: 'loading_payout', label: 'Loading payout configuration' },
                { key: 'loading_nfts',  label: 'Loading NFT records' },
                { key: 'building_tx',   label: 'Building Hedera transaction' },
                { key: 'signing_tx',    label: 'Signing with AWS KMS' },
                { key: 'submitting_tx', label: 'Submitting to Hedera network' },
                { key: 'confirming_tx', label: 'Confirming on-chain' },
                { key: 'saving_records', label: 'Saving purchase records' },
              ] as Array<{ key: string; label: string }>).map(({ key, label }) => {
                const stepOrder = [
                  'validating','loading_payout','loading_nfts','building_tx',
                  'signing_tx','submitting_tx','confirming_tx','saving_records','done',
                ]
                const currentIdx = stepOrder.indexOf(checkoutStep)
                const thisIdx    = stepOrder.indexOf(key)
                const done       = checkoutStep === 'done' || thisIdx < currentIdx
                const active     = key === checkoutStep && checkoutStep !== 'done' && checkoutStep !== 'error'
                const failed     = checkoutStep === 'error' && thisIdx === currentIdx

                return (
                  <div key={key} className="flex items-start gap-2">
                    <span className="text-sm mt-0.5 flex-shrink-0">
                      {done   ? '✅' :
                       active ? '🔄' :
                       failed ? '❌' :
                       '⬜'}
                    </span>
                    <div className="min-w-0">
                      <p
                        className={`text-xs font-medium ${active ? 'animate-pulse' : ''}`}
                        style={{ color: active ? 'var(--af-primary)' : done ? 'var(--af-txt)' : 'var(--af-muted)' }}
                      >
                        {label}
                      </p>
                      {active && checkoutStepMsg && (
                        <p className="text-[10px]" style={{ color: 'var(--af-muted)' }}>
                          {checkoutStepMsg}
                        </p>
                      )}
                      {active && checkoutStepDtl && (
                        <p className="text-[10px]" style={{ color: 'var(--af-muted)' }}>
                          {checkoutStepDtl}
                        </p>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Transaction ID — shown on success */}
            {paymentTxId && (
              <div
                className="rounded-xl p-3 mb-3"
                style={{ background: 'var(--af-search-bg)' }}
              >
                <p className="text-[10px] font-medium mb-1" style={{ color: 'var(--af-muted)' }}>
                  🔗 Hedera Transaction ID
                </p>
                <p className="text-[10px] font-mono break-all" style={{ color: 'var(--af-txt)' }}>
                  {paymentTxId}
                </p>
                <a
                  href={hashscanUrl ?? `https://hashscan.io/${process.env.NEXT_PUBLIC_HEDERA_NETWORK ?? 'testnet'}/transaction/${paymentTxId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] mt-1 inline-block"
                  style={{ color: 'var(--af-primary)' }}
                >
                  View on HashScan ↗
                </a>
              </div>
            )}

            {paymentError && (
              <p className="text-xs mb-2 p-2 rounded" style={{ color: 'var(--af-danger)', background: 'var(--af-surface)' }}>
                {paymentError}
              </p>
            )}

            {purchaseResult && paymentTxId && (
              <a
                href={`/marketplace/purchase/${purchaseResult.purchaseId}`}
                className="btn-primary text-xs block text-center"
              >
                ⬇️ Download Dataset
              </a>
            )}
          </div>
        )}

        <div className="af-card p-5">
          {/* ── Buyer balance ─────────────────────────────────────── */}
          {hasBuyerRole && (
            <div
              className="mb-4 pb-4"
              style={{ borderBottom: '1px solid var(--af-line)' }}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide mb-1" style={{ color: 'var(--af-muted)' }}>
                Your HBAR Balance
              </p>
              {balanceLoading ? (
                <p className="text-xs animate-pulse" style={{ color: 'var(--af-muted)' }}>Fetching balance…</p>
              ) : buyerBalanceHbar !== null ? (
                <p className="text-sm font-semibold" style={{ color: 'var(--af-txt)' }}>
                  ℏ{buyerBalanceHbar.toFixed(2)}
                  <span className="text-xs font-normal ml-2" style={{ color: 'var(--af-muted)' }}>
                    (≈${(buyerBalanceHbar * hbarRateUSD).toFixed(2)} USD)
                  </span>
                </p>
              ) : (
                <p className="text-xs" style={{ color: 'var(--af-muted)' }}>Balance unavailable</p>
              )}
            </div>
          )}

          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm" style={{ color: 'var(--af-txt)' }}>
              🛒 Cart ({cart.length})
            </h2>
            {cart.length > 0 && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); clearCart() }}
                className="text-[11px]"
                style={{ color: 'var(--af-muted)' }}
              >
                Clear
              </button>
            )}
          </div>

          {cart.length === 0 ? (
            <p className="text-xs text-center py-4" style={{ color: 'var(--af-muted)' }}>
              Add clips from the browse results.
            </p>
          ) : (
            <>
              <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
                {cart.map((clip) => (
                  <div
                    key={clip.id}
                    className="flex items-center justify-between gap-2 text-xs"
                    style={{ color: 'var(--af-txt)' }}
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{clip.dialectName}</p>
                      <p className="text-[10px]" style={{ color: 'var(--af-muted)' }}>
                        {clip.durationSeconds.toFixed(1)}s · {clip.speakerGender}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span style={{ color: 'var(--af-primary)' }}>$6.00</span>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleCart(clip) }}
                        className="text-[11px]"
                        style={{ color: 'var(--af-muted)' }}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t pt-3 mb-4" style={{ borderColor: 'var(--af-line)' }}>
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span style={{ color: 'var(--af-txt)' }}>Total</span>
                  <span style={{ color: 'var(--af-primary)' }}>
                    ${cartTotal.toFixed(2)} USD
                  </span>
                </div>
                <p className="text-[11px] mt-0.5" style={{ color: 'var(--af-muted)' }}>
                  {cart.length} sample{cart.length !== 1 ? 's' : ''} × $6.00 each
                </p>
                {hbarRateUSD > 0 && (
                  <p className="text-[11px] mt-0.5" style={{ color: 'var(--af-muted)' }}>
                    ≈ℏ{(cartTotal / hbarRateUSD).toFixed(2)} at ${hbarRateUSD.toFixed(4)}/HBAR
                  </p>
                )}
              </div>

              {!hasBuyerRole && (
                <div
                  className="text-xs p-2 rounded mb-3"
                  style={{ background: 'var(--af-surface)', color: 'var(--af-warning)', borderLeft: '3px solid var(--af-warning)' }}
                >
                  Buyer role required. Contact an admin to enable purchases.
                </div>
              )}

              {/* Inline low-balance warning (before checkout is attempted) */}
              {hasBuyerRole && buyerBalanceHbar !== null && hbarRateUSD > 0 &&
               buyerBalanceHbar < (cartTotal / hbarRateUSD) && !checkoutError && (
                <div
                  className="text-xs p-2 rounded mb-3"
                  style={{ background: 'var(--af-surface)', color: 'var(--af-warning)', borderLeft: '3px solid var(--af-warning)' }}
                >
                  ⚠️ Your balance (ℏ{buyerBalanceHbar.toFixed(2)}) may be too low for this purchase (≈ℏ{(cartTotal / hbarRateUSD).toFixed(2)} needed).
                </div>
              )}

              {checkoutError && (
                <div className="text-xs p-2 rounded mb-3" style={{ color: 'var(--af-danger)', background: 'var(--af-surface)', borderLeft: '3px solid var(--af-danger)' }}>
                  {checkoutError}
                </div>
              )}

              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCheckout() }}
                disabled={
                  checkoutLoading || !hasBuyerRole ||
                  (buyerBalanceHbar !== null && hbarRateUSD > 0 && buyerBalanceHbar < (cartTotal / hbarRateUSD))
                }
                className="btn-primary w-full text-sm"
              >
                {checkoutLoading ? 'Processing…' : `Checkout — $${cartTotal.toFixed(2)}`}
              </button>

              <p className="text-[10px] mt-2 text-center" style={{ color: 'var(--af-muted)' }}>
                Download link valid for 24 hours after purchase
              </p>
            </>
          )}
        </div>

        {/* Pricing breakdown */}
        <div className="af-card p-4">
          <p className="text-[11px] font-medium uppercase tracking-wide mb-3" style={{ color: 'var(--af-muted)' }}>
            Price per sample
          </p>
          <div className="space-y-1.5">
            {([
              ['Audio recording', '$0.50'],
              ['Audio QC',        '$1.00'],
              ['Transcription',   '$1.00'],
              ['Translation',     '$1.00'],
              ['Transcript QC',   '$1.00'],
              ['Translation QC',  '$1.00'],
              ['Platform',        '$0.50'],
            ] as [string, string][]).map(([label, amount]) => (
              <div key={label} className="flex items-center justify-between text-[11px]">
                <span style={{ color: 'var(--af-muted)' }}>{label}</span>
                <span style={{ color: 'var(--af-txt)' }}>{amount}</span>
              </div>
            ))}
            <div
              className="flex items-center justify-between text-xs font-semibold border-t pt-1.5 mt-1.5"
              style={{ borderColor: 'var(--af-line)', color: 'var(--af-txt)' }}
            >
              <span>Total</span>
              <span style={{ color: 'var(--af-primary)' }}>$6.00</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
