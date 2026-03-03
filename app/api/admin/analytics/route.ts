/**
 * GET /api/admin/analytics
 * Returns comprehensive platform analytics for admin dashboard.
 * Admin role required.
 */

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Require admin role
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (!roleRow) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // ── Upload metrics ────────────────────────────────────────────────
    const { data: allClips } = await admin
      .from('audio_clips')
      .select('id, status, dialect_id, duration_seconds, created_at, dialects(name)')
      .order('created_at', { ascending: false })
      .limit(10000)

    const clips = allClips ?? []
    const totalUploads = clips.length

    const statusCounts: Record<string, number> = {}
    const dialectCounts: Record<string, number> = {}
    for (const c of clips) {
      statusCounts[c.status] = (statusCounts[c.status] ?? 0) + 1
      const dialectName = Array.isArray(c.dialects)
        ? c.dialects[0]?.name
        : (c.dialects as { name: string } | null)?.name
      if (dialectName) dialectCounts[dialectName] = (dialectCounts[dialectName] ?? 0) + 1
    }

    const mintedCount = statusCounts['minted'] ?? 0
    const sellableCount = statusCounts['sellable'] ?? 0
    const rejectedCount =
      (statusCounts['audio_rejected'] ?? 0) +
      (statusCounts['transcript_rejected'] ?? 0) +
      (statusCounts['translation_rejected'] ?? 0)

    // 14-day upload activity
    const uploadActivity: Record<string, number> = {}
    const now = new Date()
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      uploadActivity[d.toISOString().slice(0, 10)] = 0
    }
    for (const c of clips) {
      const day = c.created_at?.slice(0, 10)
      if (day && uploadActivity[day] !== undefined) {
        uploadActivity[day]++
      }
    }

    // Average duration
    const durationsWithValues = clips.filter((c) => c.duration_seconds > 0)
    const avgDuration =
      durationsWithValues.length > 0
        ? durationsWithValues.reduce((s, c) => s + Number(c.duration_seconds), 0) /
          durationsWithValues.length
        : 0

    // ── QC metrics ────────────────────────────────────────────────────
    const { data: allReviews } = await admin
      .from('qc_reviews')
      .select('review_type, decision, reasons, created_at')
      .order('created_at', { ascending: false })
      .limit(10000)

    const reviews = allReviews ?? []

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
    const topRejectionReasons = Object.entries(reasonCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([reason, count]) => ({ reason, count }))

    // ── Task throughput ───────────────────────────────────────────────
    const { data: allTasks } = await admin
      .from('tasks')
      .select('task_type, status, created_at, submitted_at')
      .limit(10000)

    const tasks = allTasks ?? []
    const taskThroughput: Record<string, { submitted: number; pending: number }> = {}
    for (const t of tasks) {
      if (!taskThroughput[t.task_type]) {
        taskThroughput[t.task_type] = { submitted: 0, pending: 0 }
      }
      if (t.status === 'submitted' || t.status === 'approved' || t.status === 'rejected') {
        taskThroughput[t.task_type].submitted++
      } else if (t.status === 'available' || t.status === 'claimed') {
        taskThroughput[t.task_type].pending++
      }
    }

    // ── Purchase / revenue metrics ────────────────────────────────────
    const { data: allPurchases } = await admin
      .from('dataset_purchases')
      .select('id, sample_count, price_usd, price_hbar, created_at, payment_status')
      .order('created_at', { ascending: false })
      .limit(10000)

    const purchases = allPurchases ?? []
    const completedPurchases = purchases.filter((p) => p.payment_status === 'completed')
    const totalRevenue = completedPurchases.reduce((s, p) => s + Number(p.price_usd ?? 0), 0)
    const totalSamples = completedPurchases.reduce((s, p) => s + Number(p.sample_count ?? 0), 0)
    const totalRevenueHBAR = completedPurchases.reduce((s, p) => s + Number(p.price_hbar ?? 0), 0)

    // 14-day purchase activity
    const purchaseActivity: Record<string, { count: number; revenueUsd: number }> = {}
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      purchaseActivity[d.toISOString().slice(0, 10)] = { count: 0, revenueUsd: 0 }
    }
    for (const p of completedPurchases) {
      const day = p.created_at?.slice(0, 10)
      if (day && purchaseActivity[day] !== undefined) {
        purchaseActivity[day].count++
        purchaseActivity[day].revenueUsd += Number(p.price_usd ?? 0)
      }
    }

    // ── Payout summary ────────────────────────────────────────────────
    const { data: allPayouts } = await admin
      .from('payouts')
      .select('payout_type, amount_hbar, transaction_status')
      .limit(10000)

    const payouts = allPayouts ?? []
    const payoutByType: Record<string, { total: number; totalHBAR: number }> = {}
    for (const p of payouts) {
      const type = p.payout_type ?? 'unknown'
      if (!payoutByType[type]) payoutByType[type] = { total: 0, totalHBAR: 0 }
      payoutByType[type].total++
      payoutByType[type].totalHBAR += Number(p.amount_hbar ?? 0)
    }

    // ── Response ──────────────────────────────────────────────────────
    return NextResponse.json({
      uploads: {
        total: totalUploads,
        byStatus: statusCounts,
        minted: mintedCount,
        sellable: sellableCount,
        rejected: rejectedCount,
        avgDuration: Math.round(avgDuration * 10) / 10,
        byDialect: dialectCounts,
        dailyActivity: Object.entries(uploadActivity).map(([date, count]) => ({
          date,
          count,
        })),
      },
      qc: {
        byType: qcByType,
        topRejectionReasons,
      },
      tasks: {
        byType: taskThroughput,
      },
      purchases: {
        total: purchases.length,
        completed: completedPurchases.length,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
        totalSamples,
        totalRevenueHBAR: Math.round(totalRevenueHBAR * 100) / 100,
        dailyActivity: Object.entries(purchaseActivity).map(([date, v]) => ({
          date,
          ...v,
        })),
      },
      payouts: {
        byType: payoutByType,
        totalHBAR: payouts.reduce((s, p) => s + Number(p.amount_hbar ?? 0), 0),
      },
    })
  } catch (err) {
    console.error('[api/admin/analytics] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
