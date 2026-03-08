/**
 * POST /api/marketplace/payment
 *
 * Executes the on-chain atomic purchase settlement for an existing (pending) purchase.
 *
 * Flow:
 * 1. Auth — buyer must own the purchase
 * 2. Load purchase + pending payouts from DB
 * 3. Lookup each recipient's hedera_account_id from profiles
 * 4. Look up the buyer's KMS key ID from their profile
 * 5. Load NFT records for the purchased clips (to build burn slots)
 * 6. Find one un-burned serial per NFT record (audio / transcript / translation)
 * 7. Load contributor KMS key IDs (needed to sign the NFT-return transfers)
 * 8. Build aggregated HBAR recipient list (one entry per unique Hedera account)
 * 9. Execute a single atomic BatchTransaction:
 *      Inner Tx(s): TransferTransaction  — contributor(s) → treasury (NFT return)
 *      Inner Tx(s): TokenBurnTransaction — treasury burns the returned serials
 *      Inner Tx:    TransferTransaction  — buyer → contributors + platform (HBAR)
 * 10. Update all payout rows to completed, store batch transaction_id
 * 11. Record burned serials in nft_burns table
 * 12. Update dataset_purchases.payment_transaction_id + payment_status = 'completed'
 * 13. Audit log
 *
 * BatchTransaction is Hedera's atomic batch primitive (SDK ≥ 2.80):
 * all inner transactions commit or all revert together on-chain.
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { getSecret } from '@/lib/secrets'
import {
  buildClipRecipients,
  aggregateRecipients,
  usdToHbar,
  type ClipContributors,
  type PayoutRecipient,
  type PayoutStructure,
  DEFAULT_PAYOUT_STRUCTURE,
} from '@/lib/hedera/payment'
import {
  executeAtomicPurchaseBatch,
  type NftBurnSlot,
  type HbarRecipient,
} from '@/lib/hedera/nft'

// Platform treasury Hedera account — receives markup + fallback for missing contributors
async function getPlatformTreasuryId(): Promise<string> {
  const id = await getSecret('HEDERA_TREASURY_ACCOUNT_ID').catch(() => undefined)
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

    const admin = await createAdminClient()

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

    const platformTreasuryId = await getPlatformTreasuryId()
    const clipIds: string[] = purchase.audio_clip_ids ?? []

    // ── 5a. Load admin-configured payout structure ────────────────────────
    let payoutStructure: PayoutStructure = DEFAULT_PAYOUT_STRUCTURE
    try {
      const { data: structureRows } = await admin
        .from('payout_structure')
        .select('role, amount_usd')
      if (structureRows && structureRows.length > 0) {
        const map = Object.fromEntries(structureRows.map((r: { role: string; amount_usd: number }) => [r.role, Number(r.amount_usd)]))
        payoutStructure = {
          audio_uploader:           map['audio_uploader']           ?? DEFAULT_PAYOUT_STRUCTURE.audio_uploader,
          audio_qc_reviewer:        map['audio_qc_reviewer']        ?? DEFAULT_PAYOUT_STRUCTURE.audio_qc_reviewer,
          transcriber:              map['transcriber']              ?? DEFAULT_PAYOUT_STRUCTURE.transcriber,
          translator:               map['translator']              ?? DEFAULT_PAYOUT_STRUCTURE.translator,
          transcript_qc_reviewer:   map['transcript_qc_reviewer']   ?? DEFAULT_PAYOUT_STRUCTURE.transcript_qc_reviewer,
          translation_qc_reviewer:  map['translation_qc_reviewer']  ?? DEFAULT_PAYOUT_STRUCTURE.translation_qc_reviewer,
          platform_markup:          map['platform_markup']          ?? DEFAULT_PAYOUT_STRUCTURE.platform_markup,
        }
      }
    } catch (e) {
      console.warn('[payment] Could not load payout_structure, using defaults:', e)
    }

    // ── 5b. Load clip contributors (uploader, transcriber, translator, QC) ─
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

    // ── 6. Build per-clip HBAR recipient lists, then aggregate ─────────────
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

      const clipRecipients = buildClipRecipients(contributors, hbarRateUSD, platformTreasuryId, payoutStructure)
      perClipRecipients.push(clipRecipients)
    }

    const aggregated = aggregateRecipients(perClipRecipients)
    const totalHbar = aggregated.reduce((sum, r) => sum + r.amountHbar, 0)

    console.log(`[payment] Purchase ${purchaseId}: ${clipIds.length} clips, ${aggregated.length} recipients, ${totalHbar.toFixed(8)} HBAR`)

    // ── 7. Load NFT records for the purchased clips ───────────────────────
    // We need token_id, serial_numbers, contributor_id (and their KMS key)
    // for the atomic NFT-return + burn inner transactions.
    const { data: nftRecords, error: nftErr } = await admin
      .from('nft_records')
      .select('id, audio_clip_id, nft_type, token_id, serial_numbers, contributor_id')
      .in('audio_clip_id', clipIds)

    if (nftErr) {
      console.error('[payment] nft_records load error:', nftErr)
      return NextResponse.json({ error: 'Failed to load NFT records' }, { status: 500 })
    }

    // For each NFT record, find one serial that has NOT been burned yet
    // by checking the nft_burns table for already-used serials.
    const nftRecordIds = (nftRecords ?? []).map((r) => r.id)
    const { data: existingBurns } = nftRecordIds.length
      ? await admin
          .from('nft_burns')
          .select('nft_record_id, serial_number')
          .in('nft_record_id', nftRecordIds)
      : { data: [] }

    // Build a set of already-burned (recordId, serial) pairs
    const burnedSet = new Set<string>(
      (existingBurns ?? []).map((b) => `${b.nft_record_id}:${b.serial_number}`)
    )

    // Collect all contributor IDs from NFT records so we can load KMS keys
    const nftContributorIds = [...new Set((nftRecords ?? []).map((r) => r.contributor_id))]
    const { data: nftContributorProfiles } = nftContributorIds.length
      ? await admin
          .from('profiles')
          .select('id, hedera_account_id, kms_key_id')
          .in('id', nftContributorIds)
      : { data: [] }

    const contributorProfileMap = new Map<string, { hederaAccountId: string | null; kmsKeyId: string | null }>()
    for (const p of nftContributorProfiles ?? []) {
      contributorProfileMap.set(p.id, {
        hederaAccountId: p.hedera_account_id ?? null,
        kmsKeyId:        p.kms_key_id ?? null,
      })
    }

    // Build burn slots — one serial per NFT record per purchased clip
    const burnSlots: NftBurnSlot[] = []
    const burnRecords: Array<{ nftRecordId: string; serial: number }> = []

    for (const record of nftRecords ?? []) {
      const profile = contributorProfileMap.get(record.contributor_id)
      if (!profile?.hederaAccountId || !profile?.kmsKeyId) {
        // Contributor has no Hedera account — skip burn for this record
        console.warn(
          `[payment] NFT record ${record.id} contributor ${record.contributor_id} ` +
          `has no Hedera account — skipping burn`
        )
        continue
      }

      // Pick the first un-burned serial from this record
      const serials: number[] = record.serial_numbers ?? []
      const availableSerial = serials.find(
        (s) => !burnedSet.has(`${record.id}:${s}`)
      )

      if (availableSerial === undefined) {
        console.warn(
          `[payment] NFT record ${record.id} (${record.nft_type}) has no available ` +
          `serials to burn — all ${serials.length} serial(s) already burned`
        )
        continue
      }

      burnSlots.push({
        tokenId:              record.token_id,
        serial:               availableSerial,
        contributorAccountId: profile.hederaAccountId,
        contributorKmsKeyId:  profile.kmsKeyId,
      })
      burnRecords.push({ nftRecordId: record.id, serial: availableSerial })
    }

    console.log(
      `[payment] Burn slots: ${burnSlots.length} NFT(s) across ` +
      `${[...new Set(burnSlots.map(s => s.tokenId))].length} token collection(s)`
    )

    // ── 8. Execute atomic BatchTransaction ───────────────────────────────
    //   Inner Tx 1…N : NFT contributor → treasury (one tx per unique contributor)
    //   Inner Tx N+1…M: TokenBurnTransaction per token collection
    //   Inner Tx Last : HBAR buyer → all recipients
    const batchResult = await executeAtomicPurchaseBatch({
      burnSlots,
      hbarRecipients: aggregated as HbarRecipient[],
      totalHbar,
      buyerHederaAccountId: buyerProfile.hedera_account_id,
      buyerKmsKeyId:        buyerProfile.kms_key_id,
      memo: `Afridialect purchase ${purchaseId.slice(0, 8)}`,
    })

    const txId = batchResult.batchTransactionId
    console.log(`[payment] Atomic batch tx SUCCESS: ${txId}`)

    // ── 9. Record burned serials in nft_burns ────────────────────────────
    if (burnRecords.length > 0) {
      await admin.from('nft_burns').insert(
        burnRecords.map((b) => ({
          nft_record_id:  b.nftRecordId,
          serial_number:  b.serial,
          purchase_id:    purchaseId,
          burned_at:      new Date().toISOString(),
          transaction_id: txId,
        }))
      )
    }

    // ── 10. Update payouts to completed ───────────────────────────────────
    await admin
      .from('payouts')
      .update({
        transaction_status: 'completed',
        transaction_id:     txId,
        processed_at:       new Date().toISOString(),
      })
      .eq('purchase_id', purchaseId)
      .eq('transaction_status', 'pending')

    // ── 11. Update purchase record ────────────────────────────────────────
    await admin
      .from('dataset_purchases')
      .update({
        payment_transaction_id: txId,
        payment_status:         'completed',
        completed_at:           new Date().toISOString(),
      })
      .eq('id', purchaseId)

    // ── 12. Audit log ─────────────────────────────────────────────────────
    await admin.from('audit_logs').insert({
      user_id:       user.id,
      action:        'hedera_atomic_batch_executed',
      resource_type: 'dataset_purchases',
      resource_id:   purchaseId,
      details: {
        transaction_id:   txId,
        total_hbar:       totalHbar,
        recipient_count:  aggregated.length,
        clip_count:       clipIds.length,
        nft_burns:        burnRecords.length,
      },
    })

    return NextResponse.json({
      success:       true,
      transactionId: txId,
      totalHbar,
      recipientCount: aggregated.length,
      nftsBurned:    burnRecords.length,
      hashscanUrl: `https://hashscan.io/${process.env.HEDERA_NETWORK ?? 'testnet'}/transaction/${txId}`,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error'
    console.error('[api/marketplace/payment] error:', err)

    // Mark purchase as failed on unrecoverable Hedera errors
    if (
      typeof msg === 'string' &&
      (msg.includes('Atomic purchase batch failed') ||
       msg.includes('Hedera payment') ||
       msg.includes('INSUFFICIENT_ACCOUNT_BALANCE'))
    ) {
      if (purchaseIdForErrorHandler) {
        const admin = await createAdminClient()
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
