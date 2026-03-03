/**
 * Purchase Detail Page — server component
 *
 * Shows purchase summary + download button for buyer.
 * Route: /marketplace/purchase/[id]
 */

import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import Topbar from '@/components/layouts/Topbar'
import PurchaseDownloadButton from './components/PurchaseDownloadButton'

export default async function PurchasePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: purchaseId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch purchase — user must own it
  const { data: purchase, error } = await supabase
    .from('dataset_purchases')
    .select('id, buyer_id, sample_count, price_usd, price_hbar, payment_status, export_url, export_expires_at, downloaded_at, created_at, completed_at, filters, audio_clip_ids')
    .eq('id', purchaseId)
    .eq('buyer_id', user.id)
    .single()

  if (error || !purchase) {
    notFound()
  }

  const isExpired = purchase.export_expires_at
    ? new Date(purchase.export_expires_at) < new Date()
    : false

  const expiresDate = purchase.export_expires_at
    ? new Date(purchase.export_expires_at).toLocaleString()
    : 'N/A'

  const purchasedDate = new Date(purchase.created_at).toLocaleString()

  const filters = purchase.filters as Record<string, unknown>

  return (
    <>
      <Topbar
        title="Purchase Details"
        subtitle={`Order ${purchaseId.slice(0, 8).toUpperCase()}…`}
      />
      <div className="container-modern py-8 max-w-2xl">
        {/* Back */}
        <Link
          href="/marketplace"
          className="inline-flex items-center gap-1 text-sm mb-6"
          style={{ color: 'var(--af-primary)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back to Marketplace
        </Link>

        {/* Status banner */}
        <div
          className="af-card p-5 mb-6 flex items-center gap-4"
          style={{
            borderLeft: `4px solid ${purchase.payment_status === 'completed' ? 'var(--af-success)' : 'var(--af-warning)'}`,
          }}
        >
          <div className="text-3xl">
            {purchase.payment_status === 'completed' ? '✅' : '⏳'}
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--af-txt)' }}>
              {purchase.payment_status === 'completed' ? 'Purchase Complete' : 'Purchase Pending'}
            </p>
            <p className="text-xs" style={{ color: 'var(--af-muted)' }}>
              Ordered {purchasedDate}
            </p>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {([
            { label: 'Samples',    value: String(purchase.sample_count),              icon: '🎙️' },
            { label: 'Price (USD)', value: `$${Number(purchase.price_usd).toFixed(2)}`, icon: '💵' },
            { label: 'Price (HBAR)', value: `ℏ${Number(purchase.price_hbar).toFixed(2)}`, icon: '🔷' },
          ] as { label: string; value: string; icon: string }[]).map((s) => (
            <div key={s.label} className="af-card p-4 text-center">
              <div className="text-2xl mb-1">{s.icon}</div>
              <div className="text-lg font-bold" style={{ color: 'var(--af-txt)' }}>{s.value}</div>
              <div className="text-[11px]" style={{ color: 'var(--af-muted)' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Download section */}
        <div className="af-card p-6 mb-6">
          <h2 className="font-semibold text-sm mb-4" style={{ color: 'var(--af-txt)' }}>
            📦 Dataset Download
          </h2>

          {purchase.payment_status !== 'completed' ? (
            <p className="text-sm" style={{ color: 'var(--af-muted)' }}>
              Your purchase is still being processed. Please refresh in a moment.
            </p>
          ) : isExpired ? (
            <div className="text-sm p-3 rounded" style={{ background: 'var(--af-surface)', color: 'var(--af-danger)' }}>
              ⚠️ This download link has expired. Please contact support to request a new link.
            </div>
          ) : (
            <>
              <div className="space-y-2 mb-5 text-xs" style={{ color: 'var(--af-muted)' }}>
                <div className="flex items-center gap-2">
                  <span>⏰</span>
                  <span>Download expires: <strong style={{ color: 'var(--af-txt)' }}>{expiresDate}</strong></span>
                </div>
                {purchase.downloaded_at && (
                  <div className="flex items-center gap-2">
                    <span>✅</span>
                    <span>First downloaded: <strong style={{ color: 'var(--af-txt)' }}>{new Date(purchase.downloaded_at).toLocaleString()}</strong></span>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span>📂</span>
                  <span>Format: HuggingFace-compatible JSON (manifest + metadata)</span>
                </div>
                <div className="flex items-center gap-2">
                  <span>🔊</span>
                  <span>Audio accessed via IPFS CIDs in manifest</span>
                </div>
              </div>

              <PurchaseDownloadButton purchaseId={purchaseId} />
            </>
          )}
        </div>

        {/* Filters used */}
        {filters && Object.keys(filters).length > 0 && (
          <div className="af-card p-5">
            <h2 className="font-semibold text-sm mb-3" style={{ color: 'var(--af-txt)' }}>
              🔍 Filters Applied
            </h2>
            <div className="space-y-1 text-xs" style={{ color: 'var(--af-muted)' }}>
              {Object.entries(filters).map(([key, val]) => (
                <div key={key} className="flex gap-2">
                  <span className="font-medium capitalize" style={{ color: 'var(--af-txt)', minWidth: 120 }}>
                    {key.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>
                  <span>{Array.isArray(val) ? val.join(', ') : String(val)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
