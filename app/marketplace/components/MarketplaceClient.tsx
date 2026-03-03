'use client'

/**
 * MarketplaceClient — interactive browse, filter, cart, and checkout
 *
 * Design: matches af-card / container-modern / btn-primary system
 */

import { useState, useCallback } from 'react'
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

  // ── Checkout handler ────────────────────────────────────────────────
  const handleCheckout = async () => {
    if (cart.length === 0) return
    if (!hasBuyerRole) {
      setCheckoutError('You need the buyer role to purchase datasets. Contact an admin.')
      return
    }

    setCheckoutLoading(true)
    setCheckoutError(null)
    try {
      // Use a placeholder HBAR rate of 0.15 USD/HBAR (in production, fetch live rate)
      const hbarRateUSD = 0.15

      const filters: DatasetFilter = {
        dialects:      selectedDialects.length > 0 ? selectedDialects : undefined,
        speakerGender: selectedGenders.length  > 0 ? selectedGenders  : undefined,
        speakerAge:    selectedAges.length      > 0 ? selectedAges     : undefined,
        minDuration:   minDuration  ? parseFloat(minDuration)  : undefined,
        maxDuration:   maxDuration  ? parseFloat(maxDuration)  : undefined,
        speakerCount:  speakerCount ? parseInt(speakerCount)   : undefined,
      }

      const res = await fetch('/api/marketplace/purchase', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipIds: cart.map((c) => c.id), filters, hbarRateUSD }),
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        setCheckoutError(data.error ?? 'Checkout failed')
      } else {
        setPurchaseResult({
          purchaseId:  data.purchaseId,
          sampleCount: data.sampleCount,
          priceUSD:    data.priceUSD,
          priceHBAR:   data.priceHBAR,
        })
        setCart([])
      }
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Network error')
    } finally {
      setCheckoutLoading(false)
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
                <strong style={{ color: 'var(--af-txt)' }}>{total}</strong> clips — each $5.00 USD
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
                        $5.00
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
        {/* Purchase success */}
        {purchaseResult && (
          <div
            className="af-card p-5"
            style={{ borderLeft: '4px solid var(--af-success)' }}
          >
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--af-txt)' }}>
              ✅ Purchase Complete
            </p>
            <p className="text-xs mb-3" style={{ color: 'var(--af-muted)' }}>
              {purchaseResult.sampleCount} samples · ${purchaseResult.priceUSD.toFixed(2)} USD
            </p>
            <a
              href={`/marketplace/purchase/${purchaseResult.purchaseId}`}
              className="btn-primary text-xs block text-center"
            >
              View & Download
            </a>
          </div>
        )}

        <div className="af-card p-5">
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
                      <span style={{ color: 'var(--af-primary)' }}>$5.00</span>
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
                <p className="text-[11px] mt-1" style={{ color: 'var(--af-muted)' }}>
                  {cart.length} sample{cart.length !== 1 ? 's' : ''} × $5.00 each
                </p>
              </div>

              {!hasBuyerRole && (
                <div
                  className="text-xs p-2 rounded mb-3"
                  style={{ background: 'var(--af-surface)', color: 'var(--af-warning)', borderLeft: '3px solid var(--af-warning)' }}
                >
                  Buyer role required. Contact an admin to enable purchases.
                </div>
              )}

              {checkoutError && (
                <div className="text-xs p-2 rounded mb-3" style={{ color: 'var(--af-danger)', background: 'var(--af-surface)' }}>
                  {checkoutError}
                </div>
              )}

              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCheckout() }}
                disabled={checkoutLoading || !hasBuyerRole}
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
              <span style={{ color: 'var(--af-primary)' }}>$5.00</span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
