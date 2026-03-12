/**
 * Admin — Analytics Dashboard
 * Comprehensive platform metrics: uploads, QC, throughput, purchases, payouts.
 */

export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/layouts/Topbar'

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtStatus(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function fmtReason(r: string) {
  return r.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
}

function RateBar({ rate }: { rate: number }) {
  const bg = rate >= 80 ? 'rgba(45,212,191,0.15)' : rate >= 60 ? 'rgba(245,181,93,0.15)' : 'rgba(248,81,73,0.15)'
  const fg = rate >= 80 ? '#2dd4bf' : rate >= 60 ? '#f5b55d' : '#f85149'
  return (
    <span
      style={{
        background: bg,
        color: fg,
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {rate.toFixed(1)}% approved
    </span>
  )
}

// ─── page ─────────────────────────────────────────────────────────────────────

export default async function AdminAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const admin = await createAdminClient()

  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single()

  if (!roleRow) redirect('/dashboard')

  // ── Fetch all data server-side ─────────────────────────────────────────────

  // Audio clips — join dialects to get the display name
  const { data: rawClips } = await admin
    .from('audio_clips')
    .select('id, status, dialect_id, duration_seconds, created_at, dialects(name)')
    .order('created_at', { ascending: false })
    .limit(10000)

  const clips = rawClips ?? []
  const totalUploads = clips.length

  const statusCounts: Record<string, number> = {}
  const dialectCounts: Record<string, number> = {}
  for (const c of clips) {
    statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1
    // dialects is a joined relation — Supabase returns it as an array or object
    const dialectName = Array.isArray(c.dialects)
      ? c.dialects[0]?.name
      : (c.dialects as { name: string } | null)?.name
    if (dialectName) dialectCounts[dialectName] = (dialectCounts[dialectName] ?? 0) + 1
  }

  const mintedCount   = statusCounts['minted'] ?? 0
  const sellableCount = statusCounts['sellable'] ?? 0
  const rejectedCount =
    (statusCounts['audio_rejected'] ?? 0) +
    (statusCounts['transcript_rejected'] ?? 0) +
    (statusCounts['translation_rejected'] ?? 0)

  const durationsWithValues = clips.filter((c) => c.duration_seconds > 0)
  const avgDuration =
    durationsWithValues.length > 0
      ? durationsWithValues.reduce((s, c) => s + Number(c.duration_seconds), 0) /
        durationsWithValues.length
      : 0

  // 14-day upload activity
  const now = new Date()
  const uploadDays: { date: string; count: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    uploadDays.push({ date: d.toISOString().slice(0, 10), count: 0 })
  }
  for (const c of clips) {
    const day = c.created_at?.slice(0, 10)
    const entry = uploadDays.find((x) => x.date === day)
    if (entry) entry.count++
  }

  // QC reviews
  const { data: rawReviews } = await admin
    .from('qc_reviews')
    .select('review_type, decision, reasons, created_at')
    .order('created_at', { ascending: false })
    .limit(10000)

  const reviews = rawReviews ?? []
  const qcByType: Record<
    string,
    { total: number; approved: number; rejected: number; approvalRate: number }
  > = {}
  for (const type of ['audio_qc', 'transcript_qc', 'translation_qc']) {
    const tr = reviews.filter((r) => r.review_type === type)
    const approved = tr.filter((r) => r.decision === 'approve').length
    const rejected = tr.filter((r) => r.decision === 'reject').length
    qcByType[type] = {
      total: tr.length,
      approved,
      rejected,
      approvalRate: tr.length > 0 ? (approved / tr.length) * 100 : 0,
    }
  }

  const reasonCounts: Record<string, number> = {}
  for (const r of reviews) {
    if (r.decision === 'reject' && Array.isArray(r.reasons)) {
      for (const reason of r.reasons as string[]) {
        reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1
      }
    }
  }
  const topReasons = Object.entries(reasonCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([reason, count]) => ({ reason, count }))

  // Tasks throughput
  const { data: rawTasks } = await admin
    .from('tasks')
    .select('task_type, status')
    .limit(10000)

  const tasks = rawTasks ?? []
  const taskThroughput: Record<string, { submitted: number; pending: number }> = {
    audio_qc:        { submitted: 0, pending: 0 },
    transcription:   { submitted: 0, pending: 0 },
    transcript_qc:   { submitted: 0, pending: 0 },
    translation:     { submitted: 0, pending: 0 },
    translation_qc:  { submitted: 0, pending: 0 },
  }
  for (const t of tasks) {
    const bucket = taskThroughput[t.task_type]
    if (!bucket) continue
    if (['submitted', 'approved', 'rejected'].includes(t.status)) bucket.submitted++
    else if (['available', 'claimed'].includes(t.status)) bucket.pending++
  }

  // Purchases
  const { data: rawPurchases } = await admin
    .from('dataset_purchases')
    .select('id, sample_count, price_usd, price_hbar, created_at, payment_status')
    .order('created_at', { ascending: false })
    .limit(10000)

  const purchases = rawPurchases ?? []
  const completed  = purchases.filter((p) => p.payment_status === 'completed')
  const totalRevUSD  = completed.reduce((s, p) => s + Number(p.price_usd ?? 0), 0)
  const totalRevHBAR = completed.reduce((s, p) => s + Number(p.price_hbar ?? 0), 0)
  const totalSamples = completed.reduce((s, p) => s + Number(p.sample_count ?? 0), 0)

  const purchaseDays: { date: string; count: number; revenueUsd: number }[] = []
  for (let i = 13; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    purchaseDays.push({ date: d.toISOString().slice(0, 10), count: 0, revenueUsd: 0 })
  }
  for (const p of completed) {
    const day = p.created_at?.slice(0, 10)
    const entry = purchaseDays.find((x) => x.date === day)
    if (entry) {
      entry.count++
      entry.revenueUsd += Number(p.price_usd ?? 0)
    }
  }

  // Payouts
  const { data: rawPayouts } = await admin
    .from('payouts')
    .select('payout_type, amount_hbar, transaction_status')
    .limit(10000)

  const payouts = rawPayouts ?? []
  const payoutByType: Record<string, { count: number; hbar: number }> = {}
  for (const p of payouts) {
    const t = p.payout_type ?? 'unknown'
    if (!payoutByType[t]) payoutByType[t] = { count: 0, hbar: 0 }
    payoutByType[t].count++
    payoutByType[t].hbar += Number(p.amount_hbar ?? 0)
  }
  const totalPayoutHBAR = payouts.reduce((s, p) => s + Number(p.amount_hbar ?? 0), 0)

  // Pipeline status breakdown (ordered by pipeline stage)
  const pipelineOrder = [
    'uploaded', 'audio_qc', 'audio_rejected',
    'transcription_ready', 'transcription_in_progress',
    'transcript_qc', 'transcript_rejected',
    'translation_ready', 'translation_in_progress',
    'translation_qc', 'translation_rejected',
    'mint_ready', 'ipfs_pinned', 'minted', 'sellable',
  ]
  const pipelineRows = pipelineOrder
    .filter((s) => statusCounts[s] !== undefined)
    .map((s) => ({ status: s, count: statusCounts[s] }))

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <Topbar title="Analytics" subtitle="Platform metrics and performance insights" />
      <div className="container-modern py-8 space-y-8">

        {/* Back link */}
        <Link
          href="/admin"
          className="text-sm flex items-center gap-1.5 w-fit"
          style={{ color: 'var(--af-primary)' }}
        >
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd" />
          </svg>
          Back to Admin
        </Link>

        {/* ── Top stat cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-5">
          {[
            { label: 'Total Uploads',    value: totalUploads,                      sub: `${avgDuration.toFixed(1)}s avg duration`, icon: '🎙️', color: 'var(--af-primary)' },
            { label: 'Minted NFT Sets', value: mintedCount,                        sub: `${sellableCount} sellable`,               icon: '🪙', color: '#10b981' },
            { label: 'Total Revenue',   value: `$${totalRevUSD.toFixed(2)}`,       sub: `${totalRevHBAR.toFixed(0)} HBAR`,         icon: '💰', color: '#f59e0b' },
            { label: 'QC Reviews',      value: reviews.length,                     sub: `${topReasons.length} rejection types`,    icon: '✅', color: '#8b5cf6' },
          ].map(({ label, value, sub, icon, color }) => (
            <div key={label} className="af-card p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium mb-1" style={{ color: 'var(--af-muted)' }}>{label}</p>
                  <p className="text-3xl font-bold" style={{ color }}>{value}</p>
                  <p className="text-xs mt-1" style={{ color: 'var(--af-muted)' }}>{sub}</p>
                </div>
                <span className="text-2xl">{icon}</span>
              </div>
            </div>
          ))}
        </div>

        {/* ── Upload activity (14 days) ── */}
        <div className="af-card p-6">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
            🎙️ Upload Activity — Last 14 Days
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--af-line)' }}>
                  {['Date', 'Uploads'].map((h) => (
                    <th key={h} className="text-left pb-3 pr-6 text-xs font-semibold" style={{ color: 'var(--af-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...uploadDays].reverse().map((d, i) => (
                  <tr key={d.date} style={{ borderBottom: i < 13 ? '1px solid var(--af-line)' : 'none' }}>
                    <td className="py-2.5 pr-6 font-mono text-xs" style={{ color: 'var(--af-muted)' }}>{d.date}</td>
                    <td className="py-2.5 font-semibold" style={{ color: d.count > 0 ? 'var(--af-primary)' : 'var(--af-muted)' }}>
                      {d.count > 0 ? d.count : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Upload by status + dialect ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          {/* Pipeline status */}
          <div className="af-card p-6">
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
              📊 Pipeline Status Breakdown
            </h2>
            {pipelineRows.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--af-muted)' }}>No clips in pipeline.</p>
            ) : (
              <div className="space-y-2">
                {pipelineRows.map(({ status, count }) => {
                  const isRejected = status.includes('rejected')
                  const isMinted   = status === 'minted' || status === 'sellable'
                  const barColor   = isRejected ? 'var(--af-danger)' : isMinted ? '#10b981' : 'var(--af-primary)'
                  const maxCount   = Math.max(...pipelineRows.map((r) => r.count), 1)
                  const pct        = (count / maxCount) * 100
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span style={{ color: 'var(--af-txt)' }}>{fmtStatus(status)}</span>
                        <span className="font-semibold" style={{ color: barColor }}>{count}</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: 'var(--af-line)', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 4, transition: 'width 0.4s ease' }} />
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* By dialect */}
          <div className="af-card p-6">
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
              🗣️ Uploads by Dialect
            </h2>
            {Object.keys(dialectCounts).length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--af-muted)' }}>No uploads yet.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(dialectCounts)
                  .sort((a, b) => b[1] - a[1])
                  .map(([dialect, count]) => {
                    const maxD = Math.max(...Object.values(dialectCounts), 1)
                    const pct  = (count / maxD) * 100
                    return (
                      <div key={dialect}>
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="capitalize" style={{ color: 'var(--af-txt)' }}>{dialect}</span>
                          <span className="font-semibold" style={{ color: 'var(--af-primary)' }}>{count}</span>
                        </div>
                        <div style={{ height: 6, borderRadius: 4, background: 'var(--af-line)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: 'var(--af-primary)', borderRadius: 4 }} />
                        </div>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        </div>

        {/* ── QC Performance ── */}
        <div className="af-card p-6">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>✅ QC Performance by Stage</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { key: 'audio_qc',       label: '🎵 Audio QC',      accent: 'rgba(245,181,93,0.15)', textAccent: '#f5b55d' },
              { key: 'transcript_qc',  label: '📝 Transcript QC', accent: 'rgba(38,198,218,0.15)', textAccent: '#26c6da' },
              { key: 'translation_qc', label: '🌍 Translation QC', accent: 'rgba(45,212,191,0.15)', textAccent: '#2dd4bf' },
            ].map(({ key, label, accent, textAccent }) => {
              const d = qcByType[key] ?? { total: 0, approved: 0, rejected: 0, approvalRate: 0 }
              return (
                <div key={key} className="af-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <span className="font-semibold text-sm" style={{ color: 'var(--af-txt)' }}>{label}</span>
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: accent, color: textAccent }}>
                      {d.total} reviews
                    </span>
                  </div>
                  <div className="flex gap-4 mb-3 text-sm">
                    <span style={{ color: '#10b981', fontWeight: 600 }}>✓ {d.approved}</span>
                    <span style={{ color: '#ef4444', fontWeight: 600 }}>✗ {d.rejected}</span>
                  </div>
                  <RateBar rate={d.approvalRate} />
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Top rejection reasons + Task throughput ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">

          <div className="af-card p-6">
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
              🚫 Top Rejection Reasons
            </h2>
            {topReasons.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--af-muted)' }}>No rejections recorded yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--af-line)' }}>
                      <th className="text-left pb-2 text-xs font-semibold" style={{ color: 'var(--af-muted)' }}>Reason</th>
                      <th className="text-right pb-2 text-xs font-semibold" style={{ color: 'var(--af-muted)' }}>Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topReasons.map(({ reason, count }, i) => (
                      <tr key={reason} style={{ borderBottom: i < topReasons.length - 1 ? '1px solid var(--af-line)' : 'none' }}>
                        <td className="py-2.5" style={{ color: 'var(--af-txt)' }}>{fmtReason(reason)}</td>
                        <td className="py-2.5 text-right font-semibold" style={{ color: '#ef4444' }}>{count}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="af-card p-6">
            <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
              ⚡ Task Throughput
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--af-line)' }}>
                    <th className="text-left pb-2 text-xs font-semibold" style={{ color: 'var(--af-muted)' }}>Task Type</th>
                    <th className="text-right pb-2 text-xs font-semibold" style={{ color: 'var(--af-muted)' }}>Submitted</th>
                    <th className="text-right pb-2 text-xs font-semibold" style={{ color: 'var(--af-muted)' }}>Pending</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(taskThroughput).map(([type, d], i) => (
                    <tr key={type} style={{ borderBottom: i < Object.keys(taskThroughput).length - 1 ? '1px solid var(--af-line)' : 'none' }}>
                      <td className="py-2.5" style={{ color: 'var(--af-txt)' }}>{fmtStatus(type)}</td>
                      <td className="py-2.5 text-right font-semibold" style={{ color: '#10b981' }}>{d.submitted}</td>
                      <td className="py-2.5 text-right font-semibold" style={{ color: 'var(--af-muted)' }}>{d.pending}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── Purchase & Revenue ── */}
        <div className="af-card p-6">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
            💰 Purchase & Revenue Metrics
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
            {[
              { label: 'Total Purchases',  value: purchases.length,              color: '#6366f1' },
              { label: 'Completed',        value: completed.length,              color: '#10b981' },
              { label: 'Revenue (USD)',    value: `$${totalRevUSD.toFixed(2)}`,  color: '#f59e0b' },
              { label: 'Total Samples',   value: totalSamples,                  color: 'var(--af-primary)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="af-card p-4 text-center">
                <div className="text-2xl font-bold mb-1" style={{ color }}>{value}</div>
                <div className="text-xs" style={{ color: 'var(--af-muted)' }}>{label}</div>
              </div>
            ))}
          </div>

          {/* 14-day purchase table */}
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--af-txt)' }}>Last 14 Days</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--af-line)' }}>
                  {['Date', 'Purchases', 'Revenue (USD)'].map((h) => (
                    <th key={h} className="text-left pb-2 text-xs font-semibold pr-6" style={{ color: 'var(--af-muted)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[...purchaseDays].reverse().map((d, i) => (
                  <tr key={d.date} style={{ borderBottom: i < 13 ? '1px solid var(--af-line)' : 'none' }}>
                    <td className="py-2.5 pr-6 font-mono text-xs" style={{ color: 'var(--af-muted)' }}>{d.date}</td>
                    <td className="py-2.5 pr-6 font-semibold" style={{ color: d.count > 0 ? '#6366f1' : 'var(--af-muted)' }}>
                      {d.count > 0 ? d.count : '—'}
                    </td>
                    <td className="py-2.5 font-semibold" style={{ color: d.revenueUsd > 0 ? '#f59e0b' : 'var(--af-muted)' }}>
                      {d.revenueUsd > 0 ? `$${d.revenueUsd.toFixed(2)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Payout Summary ── */}
        <div className="af-card p-6">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
            💸 Payout Summary
          </h2>
          <div className="mb-3 text-sm" style={{ color: 'var(--af-muted)' }}>
            Total paid out: <strong style={{ color: 'var(--af-txt)' }}>{totalPayoutHBAR.toFixed(2)} HBAR</strong>
          </div>
          {Object.keys(payoutByType).length === 0 ? (
            <p className="text-sm" style={{ color: 'var(--af-muted)' }}>No payouts recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--af-line)' }}>
                    {['Contributor Type', 'Payout Count', 'Total HBAR'].map((h) => (
                      <th key={h} className="text-left pb-2 text-xs font-semibold pr-6" style={{ color: 'var(--af-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(payoutByType).map(([type, d], i) => (
                    <tr key={type} style={{ borderBottom: i < Object.keys(payoutByType).length - 1 ? '1px solid var(--af-line)' : 'none' }}>
                      <td className="py-2.5 pr-6 capitalize" style={{ color: 'var(--af-txt)' }}>{type}</td>
                      <td className="py-2.5 pr-6 font-semibold" style={{ color: 'var(--af-primary)' }}>{d.count}</td>
                      <td className="py-2.5 font-semibold" style={{ color: '#10b981' }}>{d.hbar.toFixed(2)} HBAR</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Quick links ── */}
        <div className="af-card p-6">
          <h2 className="text-base font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>🔗 Related Admin Pages</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Admin Home',     href: '/admin',              icon: '🏠' },
              { label: 'Audit Logs',     href: '/admin/audit-logs',   icon: '📋' },
              { label: 'NFT Minting',    href: '/admin/mint',         icon: '⬡' },
              { label: 'QC Analytics',   href: '/reviewer/analytics', icon: '✅' },
            ].map(({ label, href, icon }) => (
              <Link key={label} href={href} className="af-card af-card-hover p-4 block text-center">
                <div className="text-xl mb-1">{icon}</div>
                <div className="text-xs font-medium" style={{ color: 'var(--af-txt)' }}>{label}</div>
              </Link>
            ))}
          </div>
        </div>

      </div>
    </>
  )
}
