import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/reviewer/analytics
 *
 * Returns aggregated QC metrics for the reviewer analytics dashboard.
 * Admin or reviewer role required.
 *
 * Response:
 * {
 *   totals: { total, approved, rejected, approvalRate }
 *   byType: { audio_qc: {...}, transcript_qc: {...}, translation_qc: {...} }
 *   topRejectionReasons: { reason: string; count: number }[]
 *   recentActivity: { date: string; approved: number; rejected: number }[]  // last 14 days
 *   pipelineSummary: { status: string; count: number }[]
 * }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Require reviewer or admin role
    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['reviewer', 'admin'])

    if (!roles || roles.length === 0) {
      return NextResponse.json({ error: 'Reviewer or admin role required' }, { status: 403 })
    }

    // Fetch all qc_reviews (capped at 5000 — enough for analytics)
    const { data: reviews, error: reviewsError } = await admin
      .from('qc_reviews')
      .select('review_type, decision, reasons, created_at')
      .order('created_at', { ascending: false })
      .limit(5000)

    if (reviewsError) {
      console.error('[reviewer/analytics] qc_reviews fetch error:', reviewsError)
      return NextResponse.json({ error: 'Failed to fetch review data' }, { status: 500 })
    }

    const allReviews = reviews ?? []

    // ── Totals ──────────────────────────────────────────────────────────
    const total    = allReviews.length
    const approved = allReviews.filter((r) => r.decision === 'approve').length
    const rejected = allReviews.filter((r) => r.decision === 'reject').length
    const approvalRate = total > 0 ? Math.round((approved / total) * 100) : 0

    // ── By review type ───────────────────────────────────────────────────
    const reviewTypes = ['audio_qc', 'transcript_qc', 'translation_qc'] as const
    const byType: Record<string, { total: number; approved: number; rejected: number; approvalRate: number }> = {}

    for (const rt of reviewTypes) {
      const subset   = allReviews.filter((r) => r.review_type === rt)
      const subTotal = subset.length
      const subApproved = subset.filter((r) => r.decision === 'approve').length
      const subRejected = subset.filter((r) => r.decision === 'reject').length
      byType[rt] = {
        total:       subTotal,
        approved:    subApproved,
        rejected:    subRejected,
        approvalRate: subTotal > 0 ? Math.round((subApproved / subTotal) * 100) : 0,
      }
    }

    // ── Top rejection reasons ────────────────────────────────────────────
    const reasonCounts: Record<string, number> = {}
    for (const review of allReviews) {
      if (review.decision === 'reject' && Array.isArray(review.reasons)) {
        for (const reason of review.reasons) {
          reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1
        }
      }
    }
    const topRejectionReasons = Object.entries(reasonCounts)
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // ── Last 14 days activity ────────────────────────────────────────────
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const activityMap: Record<string, { approved: number; rejected: number }> = {}

    for (let i = 13; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      const key = d.toISOString().slice(0, 10)
      activityMap[key] = { approved: 0, rejected: 0 }
    }

    for (const review of allReviews) {
      const key = review.created_at.slice(0, 10)
      if (activityMap[key]) {
        if (review.decision === 'approve') activityMap[key].approved++
        else activityMap[key].rejected++
      }
    }

    const recentActivity = Object.entries(activityMap).map(([date, counts]) => ({
      date,
      ...counts,
    }))

    // ── Pipeline summary (clip status counts) ───────────────────────────
    const { data: clipStatusRows } = await admin
      .from('audio_clips')
      .select('status')
      .limit(10000)

    const statusCounts: Record<string, number> = {}
    for (const row of clipStatusRows ?? []) {
      statusCounts[row.status] = (statusCounts[row.status] ?? 0) + 1
    }
    const pipelineSummary = Object.entries(statusCounts)
      .map(([status, count]) => ({ status, count }))
      .sort((a, b) => b.count - a.count)

    return NextResponse.json({
      totals: { total, approved, rejected, approvalRate },
      byType,
      topRejectionReasons,
      recentActivity,
      pipelineSummary,
    })
  } catch (err) {
    console.error('[reviewer/analytics] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
