'use client'

/**
 * PayoutStructureClient
 *
 * Admin UI to view and modify the per-role payout amounts.
 * Reads from / writes to the `payout_structure` table via the API.
 */

import { useState } from 'react'

interface PayoutRow {
  role: string
  amount_usd: number
  description: string
  updated_at: string
}

interface Props {
  initialStructure: PayoutRow[]
}

const ROLE_LABELS: Record<string, string> = {
  audio_uploader:           '🎙️ Audio Uploader',
  audio_qc_reviewer:        '🔍 Audio QC Reviewer',
  transcriber:              '📝 Transcriber',
  translator:               '🌐 Translator',
  transcript_qc_reviewer:   '✅ Transcript QC Reviewer',
  translation_qc_reviewer:  '✅ Translation QC Reviewer',
  platform_markup:          '🏛️ Platform Fee (retained)',
}

export default function PayoutStructureClient({ initialStructure }: Props) {
  const [rows, setRows]       = useState<PayoutRow[]>(initialStructure)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState<Record<string, string>>(
    Object.fromEntries(initialStructure.map((r) => [r.role, String(r.amount_usd)]))
  )
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const totalUSD = rows.reduce((s, r) => s + Number(r.amount_usd), 0)
  const draftTotal = Object.values(draft).reduce((s, v) => s + (parseFloat(v) || 0), 0)

  async function handleSave() {
    setError(null)
    setSuccess(false)
    setLoading(true)
    try {
      const updates = Object.entries(draft).map(([role, val]) => ({
        role,
        amount_usd: parseFloat(val) || 0,
      }))
      const res  = await fetch('/api/admin/payout-structure', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ updates }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to save payout structure')
      } else {
        setRows(json.structure ?? rows)
        setEditing(false)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
      }
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  function handleCancel() {
    setDraft(Object.fromEntries(rows.map((r) => [r.role, String(r.amount_usd)])))
    setEditing(false)
    setError(null)
  }

  return (
    <div className="space-y-4">
      {/* Summary header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-xs" style={{ color: 'var(--af-muted)' }}>
          Total per sample bundle:{' '}
          <strong style={{ color: 'var(--af-txt)' }}>
            ${editing ? draftTotal.toFixed(2) : totalUSD.toFixed(2)} USD
          </strong>
        </div>
        {!editing && (
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setEditing(true) }}
            className="rounded-xl px-4 py-1.5 text-xs font-semibold"
            style={{ background: 'var(--af-primary)', color: '#fff' }}
            onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
          >
            ✏️ Edit Payouts
          </button>
        )}
      </div>

      {/* Rows */}
      <div className="divide-y" style={{ borderColor: 'var(--af-line)' }}>
        {rows.map((row) => (
          <div key={row.role} className="flex items-center justify-between py-3 gap-4">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--af-txt)' }}>
                {ROLE_LABELS[row.role] ?? row.role}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--af-muted)' }}>
                {row.description}
              </p>
            </div>
            {editing ? (
              <div className="flex items-center gap-1">
                <span className="text-xs" style={{ color: 'var(--af-muted)' }}>$</span>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={draft[row.role] ?? '0'}
                  onChange={(e) => setDraft((prev) => ({ ...prev, [row.role]: e.target.value }))}
                  className="w-20 rounded-lg px-2 py-1 text-sm font-mono border text-right"
                  style={{
                    background: 'var(--af-search-bg)',
                    borderColor: 'var(--af-line)',
                    color: 'var(--af-txt)',
                    outline: 'none',
                  }}
                />
                <span className="text-xs" style={{ color: 'var(--af-muted)' }}>USD</span>
              </div>
            ) : (
              <span className="text-sm font-mono font-semibold" style={{ color: 'var(--af-primary)' }}>
                ${Number(row.amount_usd).toFixed(2)}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Draft total warning */}
      {editing && (
        <div
          className="text-xs p-3 rounded-xl"
          style={{
            background: 'var(--af-search-bg)',
            color: draftTotal > 0 ? 'var(--af-muted)' : 'var(--af-danger)',
          }}
        >
          Draft total: <strong>${draftTotal.toFixed(2)} USD</strong> per sample.
          {draftTotal !== totalUSD && draftTotal > 0 && (
            <span> (was ${totalUSD.toFixed(2)})</span>
          )}
          {draftTotal <= 0 && ' Total must be greater than zero.'}
        </div>
      )}

      {/* Error / Success */}
      {error && (
        <p className="text-xs p-2 rounded" style={{ color: 'var(--af-danger)', background: 'var(--af-surface)' }}>
          {error}
        </p>
      )}
      {success && (
        <p className="text-xs p-2 rounded" style={{ color: 'var(--af-success)', background: 'var(--af-surface)' }}>
          ✅ Payout structure saved successfully.
        </p>
      )}

      {/* Action buttons */}
      {editing && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSave() }}
            disabled={loading || draftTotal <= 0}
            className="rounded-xl px-5 py-2 text-sm font-semibold"
            style={{
              background: 'var(--af-primary)',
              color: '#fff',
              opacity: (loading || draftTotal <= 0) ? 0.5 : 1,
              cursor: (loading || draftTotal <= 0) ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.opacity = '0.85' }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.opacity = '1' }}
          >
            {loading ? 'Saving…' : 'Save Changes'}
          </button>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleCancel() }}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-sm"
            style={{ color: 'var(--af-muted)', border: '1px solid var(--af-line)' }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}
