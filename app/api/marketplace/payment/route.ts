/**
 * POST /api/marketplace/payment
 *
 * Executes the on-chain HBAR payment for an existing (pending) dataset purchase.
 *
 * Flow:
 * 1. Auth — buyer must own the purchase
 * 2. Load purchase + pending payouts from DB
 * 3. Lookup each recipient's hedera_account_id from profiles
 * 4. Look up the buyer's KMS key ID from their profile
 * 5. Build aggregated recipient list (one entry per unique Hedera account)
 * 6. Execute single atomic TransferTransaction on Hedera (buyer → contributors + treasury)
 * 7. Update all payout rows to completed, store transaction_id
 * 8. Update dataset_purchases.payment_transaction_id + payment_status = 'completed'
 * 9. Audit log
 *
 * The Hedera TransferTransaction is the single network transaction that moves
 * real funds from the buyer to every contributor and the platform in one
 * atomic commit — satisfying the PRD §6 requirement for on-chain payout.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import {
  executePurchasePayment,
  buildClipRecipients,
  aggregateRecipients,
  usdToHbar,
  type ClipContributors,
  type PayoutRecipient,
} from '@/lib/hedera/payment'

// Platform treasury Hedera account — receives markup + fallback for missing contributors
function getPlatformTreasuryId(): string {
  const id = process.env.HEDERA_TREASURY_ACCOUNT_ID
  if (!id) throw new Error('HEDERA_TREASURY_ACCOUNT_ID not configured')
  return id
}

export async function POST(request: NextRequest) {
  let purchaseIdForErrorHandler: string | undefined

  try {
    // ── 1. Auth ──────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // ── 2. Parse body ────────────────────────────────────────────────────
    const body = await request.json() as { purchaseId: string }
    const { purchaseId } = body
    if (!purchaseId) {
      return NextResponse.json({ error: 'purchaseId is required' }, { status: 400 })
    }
    purchaseIdForErrorHandler = purchaseId

    // ── 3. Load purchase — must belong to caller ─────────────────────────
    const { data: purchase, error: purchaseErr } = await admin
      .from('dataset_purchases')
      .select('id, buyer_id, price_hbar, hbar_rate, audio_clip_ids, payment_status, payment_transaction_id')
      .eq('id', purchaseId)
      .single()

    if (purchaseErr || !purchase) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })
    }

    if (purchase.buyer_id !== user.id) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (purchase.payment_status === 'completed' && purchase.payment_transaction_id) {
      // Idempotent: already paid
      return NextResponse.json({
        success: true,
        transactionId: purchase.payment_transaction_id,
        alreadyPaid: true,
      })
    }

    if (purchase.payment_status === 'failed') {
      return NextResponse.json(
        { error: 'Purchase payment previously failed. Please contact support.' },
        { status: 409 }
      )
    }

    // ── 4. Load buyer profile for Hedera account + KMS key ───────────────
    const { data: buyerProfile, error: buyerErr } = await admin
      .from('profiles')
      .select('hedera_account_id, kms_key_id')
      .eq('id', user.id)
      .single()

    if (buyerErr || !buyerProfile?.hedera_account_id || !buyerProfile?.kms_key_id) {
      return NextResponse.json(
        { error: 'Buyer Hedera account not set up. Please complete account setup.' },
        { status: 422 }
      )
    }

    const hbarRateUSD: number = purchase.hbar_rate ?? 0
    if (!hbarRateUSD || hbarRateUSD <= 0) {
      return NextResponse.json(
        { error: 'Invalid HBAR rate on purchase record.' },
        { status: 422 }
      )
    }

    const platformTreasuryId = getPlatformTreasuryId()
    const clipIds: string[] = purchase.audio_clip_ids ?? []

    // ── 5. Load clip contributors (uploader, transcriber, translator, QC) ─
    // We need the hedera_account_id for each contributor.
    const { data: clips, error: clipsErr } = await admin
      .from('audio_clips')
      .select(`
        id,
        uploader_id,
        transcriptions ( transcriber_id ),
        translations ( translator_id ),
        qc_reviews ( reviewer_id, review_type )
      `)
      .in('id', clipIds)

    if (clipsErr || !clips) {
      return NextResponse.json({ error: 'Failed to load clip data' }, { status: 500 })
    }

    // Collect all unique user IDs we need Hedera accounts for
    const userIds = new Set<string>()
    for (const clip of clips) {
      if (clip.uploader_id) userIds.add(clip.uploader_id)

      const transcription = Array.isArray(clip.transcriptions)
        ? clip.transcriptions[0]
        : clip.transcriptions
      if (transcription?.transcriber_id) userIds.add(transcription.transcriber_id)

      const translation = Array.isArray(clip.translations)
        ? clip.translations[0]
        : clip.translations
      if (translation?.translator_id) userIds.add(translation.translator_id)

      const reviews: Array<{ reviewer_id: string; review_type: string }> = Array.isArray(clip.qc_reviews)
        ? clip.qc_reviews
        : clip.qc_reviews
          ? [clip.qc_reviews as { reviewer_id: string; review_type: string }]
          : []
      for (const r of reviews) {
        if (r.reviewer_id) userIds.add(r.reviewer_id)
      }
    }

    // Fetch Hedera account IDs for all contributors
    const { data: profiles, error: profilesErr } = await admin
      .from('profiles')
      .select('id, hedera_account_id')
      .in('id', Array.from(userIds))

    if (profilesErr) {
      return NextResponse.json({ error: 'Failed to load contributor profiles' }, { status: 500 })
    }

    const hederaById = new Map<string, string | null>()
    for (const p of profiles ?? []) {
      hederaById.set(p.id, p.hedera_account_id ?? null)
    }

    // ── 6. Build per-clip recipient lists, then aggregate ─────────────────
    const perClipRecipients: PayoutRecipient[][] = []

    for (const clip of clips) {
      const transcription = Array.isArray(clip.transcriptions)
        ? clip.transcriptions[0]
        : clip.transcriptions
      const translation = Array.isArray(clip.translations)
        ? clip.translations[0]
        : clip.translations
      const reviews: Array<{ reviewer_id: string; review_type: string }> = Array.isArray(clip.qc_reviews)
        ? clip.qc_reviews
        : clip.qc_reviews
          ? [clip.qc_reviews as { reviewer_id: string; review_type: string }]
          : []

      const transcriptQcReviewer = reviews.find(r => r.review_type === 'transcript_qc')
      const translationQcReviewer = reviews.find(r => r.review_type === 'translation_qc')
      const audioQcReviewer = reviews.find(r => r.review_type === 'audio_qc')

      const contributors: ClipContributors = {
        uploaderHederaAccountId:              hederaById.get(clip.uploader_id) ?? null,
        audioQcReviewerHederaAccountId:       audioQcReviewer?.reviewer_id
          ? (hederaById.get(audioQcReviewer.reviewer_id) ?? null)
          : null,
        transcriberHederaAccountId:           transcription?.transcriber_id
          ? (hederaById.get(transcription.transcriber_id) ?? null)
          : null,
        translatorHederaAccountId:            translation?.translator_id
          ? (hederaById.get(translation.translator_id) ?? null)
          : null,
        transcriptQcReviewerHederaAccountId:  transcriptQcReviewer?.reviewer_id
          ? (hederaById.get(transcriptQcReviewer.reviewer_id) ?? null)
          : null,
        translationQcReviewerHederaAccountId: translationQcReviewer?.reviewer_id
          ? (hederaById.get(translationQcReviewer.reviewer_id) ?? null)
          : null,
      }

      const clipRecipients = buildClipRecipients(contributors, hbarRateUSD, platformTreasuryId)
      perClipRecipients.push(clipRecipients)
    }

    const aggregated = aggregateRecipients(perClipRecipients)

    // Total HBAR to debit from buyer (must match purchase record)
    const totalHbar = aggregated.reduce((sum, r) => sum + r.amountHbar, 0)

    console.log(`[payment] Purchase ${purchaseId}: ${clipIds.length} clips, ${aggregated.length} recipients, ${totalHbar.toFixed(8)} HBAR`)

    // ── 7. Execute on-chain payment ───────────────────────────────────────
    const paymentResult = await executePurchasePayment({
      buyerHederaAccountId: buyerProfile.hedera_account_id,
      buyerKmsKeyId:        buyerProfile.kms_key_id,
      totalAmountHbar:      totalHbar,
      recipients:           aggregated,
      memo: `Afridialect purchase ${purchaseId.slice(0, 8)}`,
    })

    const txId = paymentResult.transactionId
    console.log(`[payment] On-chain tx: ${txId}`)

    // ── 8. Update payouts to completed ────────────────────────────────────
    await admin
      .from('payouts')
      .update({
        transaction_status: 'completed',
        transaction_id:     txId,
        processed_at:       new Date().toISOString(),
      })
      .eq('purchase_id', purchaseId)
      .eq('transaction_status', 'pending')

    // ── 10. Update purchase record ────────────────────────────────────────
    await admin
      .from('dataset_purchases')
      .update({
        payment_transaction_id: txId,
        payment_status:         'completed',
        completed_at:           new Date().toISOString(),
      })
      .eq('id', purchaseId)

    // ── 11. Audit log ─────────────────────────────────────────────────────
    await admin.from('audit_logs').insert({
      user_id:       user.id,
      action:        'hedera_payment_executed',
      resource_type: 'dataset_purchases',
      resource_id:   purchaseId,
      details: {
        transaction_id:  txId,
        total_hbar:      totalHbar,
        recipient_count: aggregated.length,
        clip_count:      clipIds.length,
      },
    })

    return NextResponse.json({
      success:       true,
      transactionId: txId,
      totalHbar,
      recipientCount: aggregated.length,
      hashscanUrl: `https://hashscan.io/${process.env.HEDERA_NETWORK ?? 'testnet'}/transaction/${txId}`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[api/marketplace/payment] error:', err)

    // Mark purchase as failed on unrecoverable Hedera errors
    if (
      typeof msg === 'string' &&
      (msg.includes('Hedera payment') || msg.includes('INSUFFICIENT_ACCOUNT_BALANCE'))
    ) {
      if (purchaseIdForErrorHandler) {
        const admin = createAdminClient()
        await admin
          .from('dataset_purchases')
          .update({ payment_status: 'failed' })
          .eq('id', purchaseIdForErrorHandler)
          .eq('payment_status', 'pending')
      }
    }

    return NextResponse.json({ success: false, error: msg }, { status: 500 })
  }
}
