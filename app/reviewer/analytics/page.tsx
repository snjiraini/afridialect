import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/layouts/Topbar'

interface AnalyticsData {
  totals: {
    total: number
    approved: number
    rejected: number
    approvalRate: number
  }
  byType: Record<string, {
    total: number
    approved: number
    rejected: number
    approvalRate: number
  }>
  topRejectionReasons: { reason: string; count: number }[]
  recentActivity: { date: string; approved: number; rejected: number }[]
  pipelineSummary: { status: string; count: number }[]
}

function formatReason(reason: string): string {
  return reason
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function formatStatus(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function ApprovalBadge({ rate }: { rate: number }) {
  const color =
    rate >= 80 ? '#dcfce7' : rate >= 60 ? '#fef3c7' : '#fee2e2'
  const textColor =
    rate >= 80 ? '#166534' : rate >= 60 ? '#92400e' : '#991b1b'
  return (
    <span
      style={{
        background: color,
        color: textColor,
        padding: '2px 10px',
        borderRadius: 999,
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      {rate.toFixed(1)}% approved
    </span>
  )
}

export default async function ReviewerAnalyticsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const admin = createAdminClient()

  // Require reviewer or admin role
  const { data: roles } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .in('role', ['reviewer', 'admin'])

  if (!roles || roles.length === 0) {
    redirect('/dashboard')
  }

  // Fetch analytics data from the API route
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'
  let analytics: AnalyticsData | null = null

  try {
    // Call the analytics API directly using admin client logic to avoid HTTP in server component
    const { data: reviews } = await admin
      .from('qc_reviews')
      .select('review_type, decision, rejection_reason, created_at')
      .order('created_at', { ascending: false })
      .limit(5000)

    const allReviews = reviews ?? []
    const total = allReviews.length
    const approved = allReviews.filter((r) => r.decision === 'approved').length
    const rejected = allReviews.filter((r) => r.decision === 'rejected').length

    const byType: AnalyticsData['byType'] = {}
    for (const type of ['audio_qc', 'transcript_qc', 'translation_qc']) {
      const typeReviews = allReviews.filter((r) => r.review_type === type)
      const typeApproved = typeReviews.filter((r) => r.decision === 'approved').length
      const typeRejected = typeReviews.filter((r) => r.decision === 'rejected').length
      byType[type] = {
        total: typeReviews.length,
        approved: typeApproved,
        rejected: typeRejected,
        approvalRate: typeReviews.length > 0 ? (typeApproved / typeReviews.length) * 100 : 0,
      }
    }

    const reasonCounts: Record<string, number> = {}
    for (const r of allReviews.filter((r) => r.rejection_reason)) {
      const key = r.rejection_reason as string
      reasonCounts[key] = (reasonCounts[key] ?? 0) + 1
    }
    const topRejectionReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count }))

    // 14-day activity
    const activityMap: Record<string, { approved: number; rejected: number }> = {}
    const now = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      activityMap[key] = { approved: 0, rejected: 0 }
    }
    for (const r of allReviews) {
      const day = r.created_at?.slice(0, 10)
      if (day && activityMap[day]) {
        if (r.decision === 'approved') activityMap[day].approved++
        else if (r.decision === 'rejected') activityMap[day].rejected++
      }
    }
    const recentActivity = Object.entries(activityMap).map(([date, v]) => ({
      date,
      ...v,
    }))

    const { data: clipStatuses } = await admin
      .from('audio_clips')
      .select('status')
    const statusCounts: Record<string, number> = {}
    for (const c of clipStatuses ?? []) {
      statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1
    }
    const pipelineSummary = Object.entries(statusCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([status, count]) => ({ status, count }))

    analytics = {
      totals: {
        total,
        approved,
        rejected,
        approvalRate: total > 0 ? (approved / total) * 100 : 0,
      },
      byType,
      topRejectionReasons,
      recentActivity,
      pipelineSummary,
    }
  } catch (err) {
    console.error('[analytics page] Error fetching analytics:', err)
  }

  const t = analytics?.totals

  return (
    <>
      <Topbar title="QC Analytics" subtitle="Review performance and pipeline health" />
      <div className="container-modern py-8" style={{ maxWidth: 1100 }}>

        {/* Back link */}
        <div style={{ marginBottom: 24 }}>
          <Link
            href="/reviewer"
            style={{ color: '#6366f1', fontSize: 14, fontWeight: 500, textDecoration: 'none' }}
          >
            ← Back to Review Queue
          </Link>
        </div>

        {!analytics && (
          <div className="af-card" style={{ padding: 32, textAlign: 'center', color: '#6b7280' }}>
            Unable to load analytics. Please try again later.
          </div>
        )}

        {analytics && (
          <>
            {/* Overall totals */}
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--af-text-primary)' }}>
                Overall Performance
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
                {[
                  { label: 'Total Reviews', value: t!.total, color: '#6366f1' },
                  { label: 'Approved', value: t!.approved, color: '#10b981' },
                  { label: 'Rejected', value: t!.rejected, color: '#ef4444' },
                  { label: 'Approval Rate', value: `${t!.approvalRate.toFixed(1)}%`, color: t!.approvalRate >= 80 ? '#10b981' : t!.approvalRate >= 60 ? '#f59e0b' : '#ef4444' },
                ].map((stat) => (
                  <div key={stat.label} className="af-card" style={{ padding: '20px 24px' }}>
                    <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>{stat.label}</div>
                    <div style={{ fontSize: 28, fontWeight: 700, color: stat.color }}>{stat.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-type breakdown */}
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--af-text-primary)' }}>
                By Review Type
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
                {[
                  { key: 'audio_qc', label: '🎵 Audio QC', accent: '#fef3c7', textAccent: '#92400e' },
                  { key: 'transcript_qc', label: '📝 Transcript QC', accent: '#ede9fe', textAccent: '#6d28d9' },
                  { key: 'translation_qc', label: '🌍 Translation QC', accent: '#d1fae5', textAccent: '#065f46' },
                ].map(({ key, label, accent, textAccent }) => {
                  const d = analytics!.byType[key]
                  return (
                    <div key={key} className="af-card" style={{ padding: '20px 24px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <span style={{ fontWeight: 600, fontSize: 15, color: 'var(--af-text-primary)' }}>{label}</span>
                        <span style={{ background: accent, color: textAccent, padding: '2px 8px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>
                          {d.total} reviews
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: 12, marginBottom: 8 }}>
                        <span style={{ color: '#10b981', fontWeight: 600 }}>✓ {d.approved}</span>
                        <span style={{ color: '#ef4444', fontWeight: 600 }}>✗ {d.rejected}</span>
                      </div>
                      <ApprovalBadge rate={d.approvalRate} />
                    </div>
                  )
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 32 }}>
              {/* Top rejection reasons */}
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--af-text-primary)' }}>
                  Top Rejection Reasons
                </h2>
                <div className="af-card" style={{ padding: 0, overflow: 'hidden' }}>
                  {analytics.topRejectionReasons.length === 0 ? (
                    <div style={{ padding: '24px', color: '#6b7280', fontSize: 14, textAlign: 'center' }}>
                      No rejections recorded yet
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--af-bg-secondary)' }}>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Reason</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.topRejectionReasons.map((r, i) => (
                          <tr key={r.reason} style={{ borderTop: i > 0 ? '1px solid var(--af-border)' : 'none' }}>
                            <td style={{ padding: '10px 16px', fontSize: 14, color: 'var(--af-text-primary)' }}>
                              {formatReason(r.reason)}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 14, fontWeight: 600, color: '#ef4444' }}>
                              {r.count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* Pipeline status */}
              <div>
                <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--af-text-primary)' }}>
                  Pipeline Status
                </h2>
                <div className="af-card" style={{ padding: 0, overflow: 'hidden' }}>
                  {analytics.pipelineSummary.length === 0 ? (
                    <div style={{ padding: '24px', color: '#6b7280', fontSize: 14, textAlign: 'center' }}>
                      No clips in pipeline yet
                    </div>
                  ) : (
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ background: 'var(--af-bg-secondary)' }}>
                          <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                          <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Clips</th>
                        </tr>
                      </thead>
                      <tbody>
                        {analytics.pipelineSummary.map((s, i) => (
                          <tr key={s.status} style={{ borderTop: i > 0 ? '1px solid var(--af-border)' : 'none' }}>
                            <td style={{ padding: '10px 16px', fontSize: 14, color: 'var(--af-text-primary)' }}>
                              {formatStatus(s.status)}
                            </td>
                            <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 14, fontWeight: 600, color: 'var(--af-text-primary)' }}>
                              {s.count}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>

            {/* 14-day activity */}
            <div>
              <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: 'var(--af-text-primary)' }}>
                14-Day Activity
              </h2>
              <div className="af-card" style={{ padding: 0, overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: 'var(--af-bg-secondary)' }}>
                      <th style={{ padding: '10px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Date</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Approved</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rejected</th>
                      <th style={{ padding: '10px 16px', textAlign: 'right', fontSize: 12, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...analytics.recentActivity].reverse().map((day, i) => (
                      <tr key={day.date} style={{ borderTop: i > 0 ? '1px solid var(--af-border)' : 'none' }}>
                        <td style={{ padding: '10px 16px', fontSize: 14, color: 'var(--af-text-primary)', fontFamily: 'monospace' }}>
                          {day.date}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 14, fontWeight: day.approved > 0 ? 600 : 400, color: day.approved > 0 ? '#10b981' : '#9ca3af' }}>
                          {day.approved || '—'}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 14, fontWeight: day.rejected > 0 ? 600 : 400, color: day.rejected > 0 ? '#ef4444' : '#9ca3af' }}>
                          {day.rejected || '—'}
                        </td>
                        <td style={{ padding: '10px 16px', textAlign: 'right', fontSize: 14, color: 'var(--af-text-secondary)' }}>
                          {day.approved + day.rejected || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  )
}
