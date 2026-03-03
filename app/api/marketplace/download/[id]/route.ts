/**
 * GET /api/marketplace/download/[id]
 *
 * Returns a fresh signed download URL for a buyer's dataset export.
 * Also records the first download timestamp.
 *
 * Auth: buyer must own the purchase
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

const EXPORT_TTL_SECONDS = 24 * 60 * 60 // 24 hours

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: purchaseId } = await params

    // ── Auth ───────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // ── Fetch purchase ─────────────────────────────────────────────────
    const { data: purchase, error: fetchErr } = await admin
      .from('dataset_purchases')
      .select('id, buyer_id, payment_status, export_expires_at, downloaded_at, sample_count, price_usd, audio_clip_ids')
      .eq('id', purchaseId)
      .single()

    if (fetchErr || !purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }

    // ── Ownership check ────────────────────────────────────────────────
    // Admins can also download on behalf of buyers
    const { data: adminRole } = await admin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()

    if (purchase.buyer_id !== user.id && !adminRole) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (purchase.payment_status !== 'completed') {
      return NextResponse.json({ error: 'Purchase is not completed' }, { status: 400 })
    }

    // ── Check expiry ───────────────────────────────────────────────────
    if (purchase.export_expires_at) {
      const expiresAt = new Date(purchase.export_expires_at)
      if (expiresAt < new Date()) {
        return NextResponse.json(
          { error: 'Download link has expired. Please contact support.' },
          { status: 410 }
        )
      }
    }

    // ── Generate fresh signed URL ──────────────────────────────────────
    const exportPath = `purchases/${purchaseId}/dataset.json`

    const { data: signedData, error: signErr } = await admin.storage
      .from('dataset-exports')
      .createSignedUrl(exportPath, EXPORT_TTL_SECONDS)

    if (signErr || !signedData?.signedUrl) {
      console.error('[marketplace/download] signed URL error:', signErr)
      return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
    }

    // ── Record first download timestamp ────────────────────────────────
    if (!purchase.downloaded_at) {
      await admin
        .from('dataset_purchases')
        .update({ downloaded_at: new Date().toISOString() })
        .eq('id', purchaseId)

      // Audit log
      await admin.from('audit_logs').insert({
        user_id:       user.id,
        action:        'dataset_download',
        resource_type: 'dataset_purchases',
        resource_id:   purchaseId,
        details: { sample_count: purchase.sample_count, price_usd: purchase.price_usd },
      })
    }

    return NextResponse.json({
      success:    true,
      downloadUrl: signedData.signedUrl,
      expiresAt:  purchase.export_expires_at,
      sampleCount: purchase.sample_count,
      priceUSD:   purchase.price_usd,
    })

  } catch (err) {
    console.error('[marketplace/download] unhandled error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
