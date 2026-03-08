/**
 * POST /api/marketplace/checkout
 *
 * Unified SSE endpoint that:
 *   1. Validates auth + clips + buyer Hedera account
 *   2. Executes the atomic Hedera BatchTransaction (blockchain FIRST)
 *   3. ONLY on success — writes dataset_purchases, payouts, nft_burns to DB
 *   4. Streams real-time step events via Server-Sent Events throughout
 *
 * This replaces the two-step /api/marketplace/purchase + /api/marketplace/payment
 * flow to guarantee no dangling purchase records when the blockchain tx fails.
 *
 * SSE event format:
 *   data: {"step":"...","message":"...","detail":"...","txId":"...","error":"..."}\n\n
 *
 * Steps emitted:
 *   validating → loading_payout → loading_nfts → building_tx →
 *   signing_tx → submitting_tx → confirming_tx → saving_records → done | error
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'
import { PRICE_PER_SAMPLE_USD } from '@/types'
import type { DatasetFilter } from '@/types'
import { getSecret } from '@/lib/secrets'
import {
  buildClipRecipients,
  aggregateRecipients,
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

const EXPORT_TTL_SECONDS = 24 * 60 * 60 // 24 hours

async function getPlatformTreasuryId(): Promise<string> {
  const id = await getSecret('HEDERA_TREASURY_ACCOUNT_ID').catch(() => undefined)
  if (!id) throw new Error('HEDERA_TREASURY_ACCOUNT_ID not configured')
  return id
}

type CheckoutStep =
  | 'validating'
  | 'loading_payout'
  | 'loading_nfts'
  | 'building_tx'
  | 'signing_tx'
  | 'submitting_tx'
  | 'confirming_tx'
  | 'saving_records'
  | 'done'
  | 'error'

interface StepEvent {
  step: CheckoutStep
  message: string
  detail?: string
  txId?: string
  hashscanUrl?: string
  purchaseId?: string
  sampleCount?: number
  priceUSD?: number
  priceHBAR?: number
  error?: string
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: StepEvent) {
        const line = `data: ${JSON.stringify(event)}\n\n`
        try {
          controller.enqueue(encoder.encode(line))
        } catch {
          // stream already closed — ignore
        }
      }

      function close() {
        try { controller.close() } catch { /* already closed */ }
      }

      try {
        // ── 1. Auth ────────────────────────────────────────────────────
        emit({ step: 'validating', message: 'Authenticating…' })

        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) {
          emit({ step: 'error', message: 'Authentication failed', error: 'Unauthorized' })
          close(); return
        }

        const admin = await createAdminClient()

        // Check buyer role
        const { data: roleRow } = await admin
          .from('user_roles')
          .select('id')
          .eq('user_id', user.id)
          .in('role', ['buyer', 'admin'])
          .maybeSingle()

        if (!roleRow) {
          emit({ step: 'error', message: 'Forbidden', error: 'Buyer role required' })
          close(); return
        }

        // ── 2. Parse body ──────────────────────────────────────────────
        const body = await request.json() as {
          clipIds: string[]
          filters: DatasetFilter
          hbarRateUSD: number
        }
        const { clipIds, filters, hbarRateUSD } = body

        if (!Array.isArray(clipIds) || clipIds.length === 0) {
          emit({ step: 'error', message: 'Invalid request', error: 'clipIds must be a non-empty array' })
          close(); return
        }
        if (!hbarRateUSD || hbarRateUSD <= 0) {
          emit({ step: 'error', message: 'Invalid request', error: 'hbarRateUSD must be a positive number' })
          close(); return
        }

        // ── 3. Validate clips ──────────────────────────────────────────
        emit({ step: 'validating', message: 'Validating clips…', detail: `${clipIds.length} clip(s) requested` })

        const { data: clips, error: clipsErr } = await admin
          .from('audio_clips')
          .select(`
            id, duration_seconds, speaker_gender, speaker_age_range, speaker_count,
            audio_cid, uploader_id,
            dialects ( name, code ),
            transcriptions ( id, content, transcriber_id ),
            translations ( id, content, translator_id ),
            qc_reviews ( reviewer_id, review_type )
          `)
          .in('id', clipIds)
          .in('status', ['minted', 'sellable'])

        if (clipsErr || !clips || clips.length !== clipIds.length) {
          emit({
            step: 'error',
            message: 'Some clips are not available',
            error: `Requested ${clipIds.length}, found ${clips?.length ?? 0} eligible clips`,
          })
          close(); return
        }

        // ── 4. Validate buyer's Hedera account ────────────────────────
        emit({ step: 'validating', message: 'Checking your Hedera account…' })

        const { data: buyerProfile, error: buyerErr } = await admin
          .from('profiles')
          .select('hedera_account_id, kms_key_id')
          .eq('id', user.id)
          .single()

        if (buyerErr || !buyerProfile?.hedera_account_id || !buyerProfile?.kms_key_id) {
          emit({
            step: 'error',
            message: 'Hedera account not set up',
            error: 'Your Hedera account is not configured. Please complete account setup.',
          })
          close(); return
        }

        const sampleCount = clips.length
        const priceUSD    = parseFloat((sampleCount * PRICE_PER_SAMPLE_USD).toFixed(2))
        const priceHBAR   = parseFloat((priceUSD / hbarRateUSD).toFixed(8))
        const platformTreasuryId = await getPlatformTreasuryId()

        // ── 5. Load payout structure ───────────────────────────────────
        emit({ step: 'loading_payout', message: 'Loading payout configuration…' })

        let payoutStructure: PayoutStructure = DEFAULT_PAYOUT_STRUCTURE
        try {
          const { data: structureRows } = await admin.from('payout_structure').select('role, amount_usd')
          if (structureRows && structureRows.length > 0) {
            const map = Object.fromEntries(
              structureRows.map((r: { role: string; amount_usd: number }) => [r.role, Number(r.amount_usd)])
            )
            payoutStructure = {
              audio_uploader:           map['audio_uploader']          ?? DEFAULT_PAYOUT_STRUCTURE.audio_uploader,
              audio_qc_reviewer:        map['audio_qc_reviewer']       ?? DEFAULT_PAYOUT_STRUCTURE.audio_qc_reviewer,
              transcriber:              map['transcriber']             ?? DEFAULT_PAYOUT_STRUCTURE.transcriber,
              translator:               map['translator']             ?? DEFAULT_PAYOUT_STRUCTURE.translator,
              transcript_qc_reviewer:   map['transcript_qc_reviewer']  ?? DEFAULT_PAYOUT_STRUCTURE.transcript_qc_reviewer,
              translation_qc_reviewer:  map['translation_qc_reviewer'] ?? DEFAULT_PAYOUT_STRUCTURE.translation_qc_reviewer,
              platform_markup:          map['platform_markup']         ?? DEFAULT_PAYOUT_STRUCTURE.platform_markup,
            }
          }
        } catch (e) {
          console.warn('[checkout] Could not load payout_structure, using defaults:', e)
        }

        // ── 6. Load contributor profiles ───────────────────────────────
        emit({ step: 'loading_payout', message: 'Loading contributor accounts…' })

        const userIds = new Set<string>()
        for (const clip of clips) {
          if (clip.uploader_id) userIds.add(clip.uploader_id)
          const transcription = Array.isArray(clip.transcriptions) ? clip.transcriptions[0] : clip.transcriptions
          const translation   = Array.isArray(clip.translations)   ? clip.translations[0]   : clip.translations
          // @ts-ignore
          if (transcription?.transcriber_id) userIds.add(transcription.transcriber_id)
          // @ts-ignore
          if (translation?.translator_id)    userIds.add(translation.translator_id)
          const reviews: Array<{ reviewer_id: string; review_type: string }> = Array.isArray(clip.qc_reviews)
            ? clip.qc_reviews as Array<{ reviewer_id: string; review_type: string }>
            : clip.qc_reviews ? [clip.qc_reviews as { reviewer_id: string; review_type: string }] : []
          for (const r of reviews) {
            if (r.reviewer_id) userIds.add(r.reviewer_id)
          }
        }

        const { data: profiles, error: profilesErr } = await admin
          .from('profiles')
          .select('id, hedera_account_id')
          .in('id', Array.from(userIds))

        if (profilesErr) {
          emit({ step: 'error', message: 'Failed to load contributor profiles', error: profilesErr.message })
          close(); return
        }

        const hederaById = new Map<string, string | null>()
        for (const p of profiles ?? []) {
          hederaById.set(p.id, p.hedera_account_id ?? null)
        }

        // ── 7. Build HBAR recipient lists ──────────────────────────────
        const perClipRecipients: PayoutRecipient[][] = []

        for (const clip of clips) {
          const transcription = Array.isArray(clip.transcriptions) ? clip.transcriptions[0] : clip.transcriptions
          const translation   = Array.isArray(clip.translations)   ? clip.translations[0]   : clip.translations
          const reviews: Array<{ reviewer_id: string; review_type: string }> = Array.isArray(clip.qc_reviews)
            ? clip.qc_reviews as Array<{ reviewer_id: string; review_type: string }>
            : clip.qc_reviews ? [clip.qc_reviews as { reviewer_id: string; review_type: string }] : []

          const transcriptQcReviewer  = reviews.find(r => r.review_type === 'transcript_qc')
          const translationQcReviewer = reviews.find(r => r.review_type === 'translation_qc')
          const audioQcReviewer       = reviews.find(r => r.review_type === 'audio_qc')

          const contributors: ClipContributors = {
            uploaderHederaAccountId:              hederaById.get(clip.uploader_id) ?? null,
            audioQcReviewerHederaAccountId:       audioQcReviewer?.reviewer_id
              ? (hederaById.get(audioQcReviewer.reviewer_id) ?? null) : null,
            // @ts-ignore
            transcriberHederaAccountId:           transcription?.transcriber_id
              // @ts-ignore
              ? (hederaById.get(transcription.transcriber_id) ?? null) : null,
            // @ts-ignore
            translatorHederaAccountId:            translation?.translator_id
              // @ts-ignore
              ? (hederaById.get(translation.translator_id) ?? null) : null,
            transcriptQcReviewerHederaAccountId:  transcriptQcReviewer?.reviewer_id
              ? (hederaById.get(transcriptQcReviewer.reviewer_id) ?? null) : null,
            translationQcReviewerHederaAccountId: translationQcReviewer?.reviewer_id
              ? (hederaById.get(translationQcReviewer.reviewer_id) ?? null) : null,
          }

          perClipRecipients.push(buildClipRecipients(contributors, hbarRateUSD, platformTreasuryId, payoutStructure))
        }

        const aggregated = aggregateRecipients(perClipRecipients)
        const totalHbar  = aggregated.reduce((sum, r) => sum + r.amountHbar, 0)

        // ── 8. Load NFT records ────────────────────────────────────────
        emit({
          step:    'loading_nfts',
          message: 'Loading NFT records…',
          detail:  `${sampleCount} clip(s), ℏ${totalHbar.toFixed(4)} total`,
        })

        const { data: nftRecords, error: nftErr } = await admin
          .from('nft_records')
          .select('id, audio_clip_id, nft_type, token_id, serial_numbers, contributor_id')
          .in('audio_clip_id', clipIds)

        if (nftErr) {
          emit({ step: 'error', message: 'Failed to load NFT records', error: nftErr.message })
          close(); return
        }

        // Check existing burns
        const nftRecordIds = (nftRecords ?? []).map((r) => r.id)
        const { data: existingBurns } = nftRecordIds.length
          ? await admin.from('nft_burns').select('nft_record_id, serial_number').in('nft_record_id', nftRecordIds)
          : { data: [] }

        const burnedSet = new Set<string>(
          (existingBurns ?? []).map((b) => `${b.nft_record_id}:${b.serial_number}`)
        )

        // Load NFT contributor KMS keys
        const nftContributorIds = [...new Set((nftRecords ?? []).map((r) => r.contributor_id))]
        const { data: nftContributorProfiles } = nftContributorIds.length
          ? await admin.from('profiles').select('id, hedera_account_id, kms_key_id').in('id', nftContributorIds)
          : { data: [] }

        const contributorProfileMap = new Map<string, { hederaAccountId: string | null; kmsKeyId: string | null }>()
        for (const p of nftContributorProfiles ?? []) {
          contributorProfileMap.set(p.id, {
            hederaAccountId: p.hedera_account_id ?? null,
            kmsKeyId:        p.kms_key_id ?? null,
          })
        }

        // Build burn slots
        const burnSlots: NftBurnSlot[] = []
        const burnRecords: Array<{ nftRecordId: string; serial: number }> = []

        for (const record of nftRecords ?? []) {
          const profile = contributorProfileMap.get(record.contributor_id)
          if (!profile?.hederaAccountId || !profile?.kmsKeyId) {
            console.warn(`[checkout] NFT record ${record.id} contributor ${record.contributor_id} has no Hedera account — skipping burn`)
            continue
          }
          const serials: number[] = record.serial_numbers ?? []
          const availableSerial   = serials.find((s) => !burnedSet.has(`${record.id}:${s}`))
          if (availableSerial === undefined) {
            console.warn(`[checkout] NFT record ${record.id} has no available serials to burn`)
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
          `[checkout] ${clipIds.length} clips, ${burnSlots.length} burn slots, ` +
          `${aggregated.length} HBAR recipients, ${totalHbar.toFixed(8)} HBAR`
        )

        // ── 9. Build + sign + submit Hedera BatchTransaction ───────────
        emit({
          step:    'building_tx',
          message: 'Building atomic Hedera transaction…',
          detail:  `${burnSlots.length} NFT burn slot(s), ${aggregated.length} HBAR recipient(s)`,
        })

        emit({
          step:    'signing_tx',
          message: 'Signing with AWS KMS keys…',
          detail:  'Contributor keys + platform guardian key + buyer key',
        })

        emit({
          step:    'submitting_tx',
          message: 'Submitting to Hedera network…',
          detail:  `ℏ${totalHbar.toFixed(4)} distributed across ${aggregated.length} recipients`,
        })

        const batchResult = await executeAtomicPurchaseBatch({
          burnSlots,
          hbarRecipients: aggregated as HbarRecipient[],
          totalHbar,
          buyerHederaAccountId: buyerProfile.hedera_account_id,
          buyerKmsKeyId:        buyerProfile.kms_key_id,
          memo: `Afridialect purchase ${sampleCount} samples`,
        })

        const txId = batchResult.batchTransactionId
        const hashscanUrl = `https://hashscan.io/${process.env.HEDERA_NETWORK ?? 'testnet'}/transaction/${txId}`

        emit({
          step:    'confirming_tx',
          message: 'Transaction confirmed on Hedera!',
          detail:  txId,
          txId,
          hashscanUrl,
        })

        console.log(`[checkout] Atomic batch tx SUCCESS: ${txId}`)

        // ── 10. DB writes — ONLY after blockchain success ──────────────
        emit({ step: 'saving_records', message: 'Saving purchase records…' })

        const expiresAt  = new Date(Date.now() + EXPORT_TTL_SECONDS * 1000).toISOString()
        const purchaseId = crypto.randomUUID()

        // Insert purchase record (status = completed from the start)
        // The full ZIP package is built on-demand by GET /api/marketplace/download/[id]
        await admin.from('dataset_purchases').insert({
          id:                     purchaseId,
          buyer_id:               user.id,
          sample_count:           sampleCount,
          price_usd:              priceUSD,
          price_hbar:             priceHBAR,
          filters:                filters ?? {},
          audio_clip_ids:         clipIds,
          payment_status:         'completed',
          payment_transaction_id: txId,
          export_expires_at:      expiresAt,
          hbar_rate:              hbarRateUSD,
          dialect_ids:            [],
          completed_at:           new Date().toISOString(),
        })

        // Insert payout records (status = completed immediately)
        const payoutInserts: object[] = []
        for (const clip of clips) {
          // @ts-ignore
          const transcription = Array.isArray(clip.transcriptions) ? clip.transcriptions[0] : clip.transcriptions
          // @ts-ignore
          const translation   = Array.isArray(clip.translations)   ? clip.translations[0]   : clip.translations
          const reviews: Array<{ reviewer_id: string; review_type: string }> = Array.isArray(clip.qc_reviews)
            ? clip.qc_reviews as Array<{ reviewer_id: string; review_type: string }>
            : clip.qc_reviews ? [clip.qc_reviews as { reviewer_id: string; review_type: string }] : []
          const audioQcReview = reviews.find(r => r.review_type === 'audio_qc')

          payoutInserts.push({
            purchase_id:        purchaseId,
            recipient_id:       clip.uploader_id,
            payout_type:        'audio',
            amount_usd:         payoutStructure.audio_uploader,
            amount_hbar:        parseFloat((payoutStructure.audio_uploader / hbarRateUSD).toFixed(8)),
            transaction_status: 'completed',
            transaction_id:     txId,
            processed_at:       new Date().toISOString(),
          })
          if (audioQcReview?.reviewer_id) {
            payoutInserts.push({
              purchase_id:        purchaseId,
              recipient_id:       audioQcReview.reviewer_id,
              payout_type:        'qc_review',
              amount_usd:         payoutStructure.audio_qc_reviewer,
              amount_hbar:        parseFloat((payoutStructure.audio_qc_reviewer / hbarRateUSD).toFixed(8)),
              transaction_status: 'completed',
              transaction_id:     txId,
              processed_at:       new Date().toISOString(),
            })
          }
          // @ts-ignore
          if (transcription?.transcriber_id) {
            payoutInserts.push({
              purchase_id:        purchaseId,
              // @ts-ignore
              recipient_id:       transcription.transcriber_id,
              payout_type:        'transcription',
              amount_usd:         payoutStructure.transcriber,
              amount_hbar:        parseFloat((payoutStructure.transcriber / hbarRateUSD).toFixed(8)),
              transaction_status: 'completed',
              transaction_id:     txId,
              processed_at:       new Date().toISOString(),
            })
          }
          // @ts-ignore
          if (translation?.translator_id) {
            payoutInserts.push({
              purchase_id:        purchaseId,
              // @ts-ignore
              recipient_id:       translation.translator_id,
              payout_type:        'translation',
              amount_usd:         payoutStructure.translator,
              amount_hbar:        parseFloat((payoutStructure.translator / hbarRateUSD).toFixed(8)),
              transaction_status: 'completed',
              transaction_id:     txId,
              processed_at:       new Date().toISOString(),
            })
          }
        }

        if (payoutInserts.length > 0) {
          const { error: payoutErr } = await admin.from('payouts').insert(payoutInserts)
          if (payoutErr) console.error('[checkout] payout insert error:', payoutErr)
        }

        // Insert nft_burns
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

        // Audit log
        await admin.from('audit_logs').insert({
          user_id:       user.id,
          action:        'hedera_atomic_batch_executed',
          resource_type: 'dataset_purchases',
          resource_id:   purchaseId,
          details: {
            transaction_id:  txId,
            total_hbar:      totalHbar,
            recipient_count: aggregated.length,
            clip_count:      clipIds.length,
            nft_burns:       burnRecords.length,
          },
        })

        // ── 11. Done ───────────────────────────────────────────────────
        emit({
          step:        'done',
          message:     'Purchase complete! Your dataset is ready.',
          txId,
          hashscanUrl,
          purchaseId,
          sampleCount,
          priceUSD,
          priceHBAR,
        })

        console.log(`[checkout] Purchase ${purchaseId} complete — tx ${txId}`)

      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Internal server error'
        console.error('[api/marketplace/checkout] error:', err)
        emit({ step: 'error', message: 'Checkout failed', error: msg })
      } finally {
        close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':  'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection':    'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
