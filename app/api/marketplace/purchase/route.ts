/**
 * POST /api/marketplace/purchase
 *
 * Creates a dataset purchase from a buyer-provided list of clip IDs.
 *
 * Flow:
 * 1. Auth check (buyer role required)
 * 2. Validate all clipIds are status = minted | sellable
 * 3. Calculate price (PRICE_PER_SAMPLE_USD * count)
 * 4. Insert dataset_purchases record
 * 5. Build HuggingFace-compatible JSONL manifest
 * 6. Upload manifest JSON to dataset-exports bucket
 * 7. Generate signed download URL (24 h TTL)
 * 8. Create payout records for contributors
 * 9. Update purchase to completed, audit log
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { PRICE_PER_SAMPLE_USD } from '@/types'
import type { PurchaseRequest, PurchaseResponse } from '@/types'

// Payout breakdown per PRD §6.6.3 — must sum to PRICE_PER_SAMPLE_USD
const PAYOUT_AUDIO_USD         = 0.50
const PAYOUT_TRANSCRIPT_USD    = 1.00
const PAYOUT_TRANSLATION_USD   = 1.00
const PAYOUT_QC_TRANSCRIPT_USD = 1.00
const PAYOUT_QC_TRANSLATION_USD= 1.00
// 0.50 platform markup — retained, no payout record

const EXPORT_TTL_SECONDS = 24 * 60 * 60 // 24 hours

export async function POST(request: NextRequest) {
  try {
    // ── 1. Auth ────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Check buyer role
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('id')
      .eq('user_id', user.id)
      .in('role', ['buyer', 'admin'])
      .maybeSingle()

    if (!roleRow) {
      return NextResponse.json({ error: 'Forbidden — buyer role required' }, { status: 403 })
    }

    // ── 2. Parse & validate body ───────────────────────────────────────
    const body: PurchaseRequest = await request.json()
    const { clipIds, filters, hbarRateUSD } = body

    if (!Array.isArray(clipIds) || clipIds.length === 0) {
      return NextResponse.json({ error: 'clipIds must be a non-empty array' }, { status: 400 })
    }
    if (!hbarRateUSD || hbarRateUSD <= 0) {
      return NextResponse.json({ error: 'hbarRateUSD must be a positive number' }, { status: 400 })
    }

    // ── 3. Validate clips exist and are sellable ───────────────────────
    const { data: clips, error: clipsErr } = await admin
      .from('audio_clips')
      .select(`
        id, duration_seconds, speaker_gender, speaker_age_range, speaker_count,
        audio_cid, uploader_id,
        dialects ( name, code ),
        transcriptions ( id, content, transcriber_id ),
        translations ( id, content, translator_id )
      `)
      .in('id', clipIds)
      .in('status', ['minted', 'sellable'])

    if (clipsErr) {
      return NextResponse.json({ error: clipsErr.message }, { status: 500 })
    }

    if (!clips || clips.length !== clipIds.length) {
      return NextResponse.json(
        { error: `Some clips are not available. Requested ${clipIds.length}, found ${clips?.length ?? 0} eligible.` },
        { status: 400 }
      )
    }

    // ── 4. Pricing ─────────────────────────────────────────────────────
    const sampleCount = clips.length
    const priceUSD    = parseFloat((sampleCount * PRICE_PER_SAMPLE_USD).toFixed(2))
    const priceHBAR   = parseFloat((priceUSD / hbarRateUSD).toFixed(8))

    // ── 5. Insert purchase record (pending) ────────────────────────────
    const expiresAt = new Date(Date.now() + EXPORT_TTL_SECONDS * 1000).toISOString()

    const { data: purchase, error: insertErr } = await admin
      .from('dataset_purchases')
      .insert({
        buyer_id:           user.id,
        sample_count:       sampleCount,
        price_usd:          priceUSD,
        price_hbar:         priceHBAR,
        filters:            filters ?? {},
        audio_clip_ids:     clipIds,
        payment_status:     'pending',
        export_expires_at:  expiresAt,
        hbar_rate:          hbarRateUSD,
        dialect_ids:        [],
      })
      .select('id')
      .single()

    if (insertErr || !purchase) {
      console.error('[marketplace/purchase] insert error:', insertErr)
      return NextResponse.json({ error: 'Failed to create purchase record' }, { status: 500 })
    }

    const purchaseId = purchase.id

    // ── 6. Build HuggingFace-compatible JSONL manifest ────────────────
    const manifestLines: string[] = []

    for (const clip of clips) {
      // @ts-ignore — supabase join typing
      const dialect     = Array.isArray(clip.dialects) ? clip.dialects[0] : clip.dialects
      // @ts-ignore
      const transcription = Array.isArray(clip.transcriptions) ? clip.transcriptions[0] : clip.transcriptions
      // @ts-ignore
      const translation   = Array.isArray(clip.translations)   ? clip.translations[0]   : clip.translations

      const entry = {
        id:              clip.id,
        dialect_code:    dialect?.code   ?? 'xx',
        dialect_name:    dialect?.name   ?? 'Unknown',
        audio_cid:       clip.audio_cid,
        duration_seconds: clip.duration_seconds,
        speaker_gender:  clip.speaker_gender,
        speaker_age:     clip.speaker_age_range,
        speaker_count:   clip.speaker_count,
        transcript:      transcription?.content ?? null,
        translation:     translation?.content   ?? null,
      }
      manifestLines.push(JSON.stringify(entry))
    }

    const manifestContent = manifestLines.join('\n')

    // Dataset card (README) in HuggingFace format
    const datasetCard = `---
license: cc-by-4.0
language:
  - af
task_categories:
  - automatic-speech-recognition
---

# Afridialect Dataset Export

**Purchase ID:** ${purchaseId}  
**Sample count:** ${sampleCount}  
**Generated:** ${new Date().toISOString()}

## Contents

This dataset export contains ${sampleCount} audio sample records.

### Format

Each line in \`data.jsonl\` is a JSON object with:

| Field | Type | Description |
|-------|------|-------------|
| id | string | Clip UUID |
| dialect_code | string | e.g. "kikuyu" |
| dialect_name | string | e.g. "Kikuyu" |
| audio_cid | string | IPFS CID of the audio file |
| duration_seconds | number | Clip length |
| speaker_gender | string | male / female / mixed / unknown |
| speaker_age | string | child / teen / adult / senior / mixed |
| speaker_count | number | Number of speakers |
| transcript | string | Original language transcription |
| translation | string | English translation |

### Audio Access

Audio files are accessible via any public IPFS gateway:
\`https://gateway.pinata.cloud/ipfs/{audio_cid}\`
`

    // Build JSON package (manifest + dataset card)
    const packageContent = JSON.stringify({
      dataset_card: datasetCard,
      records: manifestLines.map((l) => JSON.parse(l)),
      meta: {
        purchase_id:   purchaseId,
        buyer_id:      user.id,
        sample_count:  sampleCount,
        price_usd:     priceUSD,
        price_hbar:    priceHBAR,
        hbar_rate:     hbarRateUSD,
        generated_at:  new Date().toISOString(),
        expires_at:    expiresAt,
      },
    }, null, 2)

    const exportPath = `purchases/${purchaseId}/dataset.json`

    // ── 7. Upload to Supabase Storage ──────────────────────────────────
    const { error: uploadErr } = await admin.storage
      .from('dataset-exports')
      .upload(exportPath, Buffer.from(packageContent), {
        contentType: 'application/json',
        upsert: true,
      })

    if (uploadErr) {
      console.error('[marketplace/purchase] storage upload error:', uploadErr)
      // Non-fatal for V1 — purchase still created, URL will be null
    }

    // ── 8. Generate signed URL ─────────────────────────────────────────
    let exportUrl: string | null = null
    if (!uploadErr) {
      const { data: signedData } = await admin.storage
        .from('dataset-exports')
        .createSignedUrl(exportPath, EXPORT_TTL_SECONDS)
      exportUrl = signedData?.signedUrl ?? null
    }

    // ── 9. Create payout records ───────────────────────────────────────
    // Collect contributor IDs for each clip
    const payoutInserts: object[] = []

    for (const clip of clips) {
      // @ts-ignore
      const transcription = Array.isArray(clip.transcriptions) ? clip.transcriptions[0] : clip.transcriptions
      // @ts-ignore
      const translation   = Array.isArray(clip.translations)   ? clip.translations[0]   : clip.translations

      // Audio uploader payout
      payoutInserts.push({
        purchase_id:        purchaseId,
        recipient_id:       clip.uploader_id,
        payout_type:        'audio',
        amount_usd:         PAYOUT_AUDIO_USD,
        amount_hbar:        parseFloat((PAYOUT_AUDIO_USD / hbarRateUSD).toFixed(8)),
        transaction_status: 'pending',
      })

      // Transcriber payout
      if (transcription?.transcriber_id) {
        payoutInserts.push({
          purchase_id:        purchaseId,
          recipient_id:       transcription.transcriber_id,
          payout_type:        'transcription',
          amount_usd:         PAYOUT_TRANSCRIPT_USD,
          amount_hbar:        parseFloat((PAYOUT_TRANSCRIPT_USD / hbarRateUSD).toFixed(8)),
          transaction_status: 'pending',
        })
      }

      // Translator payout
      if (translation?.translator_id) {
        payoutInserts.push({
          purchase_id:        purchaseId,
          recipient_id:       translation.translator_id,
          payout_type:        'translation',
          amount_usd:         PAYOUT_TRANSLATION_USD,
          amount_hbar:        parseFloat((PAYOUT_TRANSLATION_USD / hbarRateUSD).toFixed(8)),
          transaction_status: 'pending',
        })
      }
    }

    if (payoutInserts.length > 0) {
      const { error: payoutErr } = await admin.from('payouts').insert(payoutInserts)
      if (payoutErr) {
        console.error('[marketplace/purchase] payout insert error:', payoutErr)
        // Non-fatal — purchase record already exists
      }
    }

    // ── 10. Mark purchase completed ────────────────────────────────────
    await admin
      .from('dataset_purchases')
      .update({
        payment_status: 'completed',
        export_url:     exportUrl,
        completed_at:   new Date().toISOString(),
      })
      .eq('id', purchaseId)

    // ── 11. Audit log ──────────────────────────────────────────────────
    await admin.from('audit_logs').insert({
      user_id:       user.id,
      action:        'dataset_purchase',
      resource_type: 'dataset_purchases',
      resource_id:   purchaseId,
      details: {
        sample_count: sampleCount,
        price_usd:    priceUSD,
        price_hbar:   priceHBAR,
        hbar_rate:    hbarRateUSD,
      },
    })

    const response: PurchaseResponse = {
      success:     true,
      purchaseId,
      sampleCount,
      priceUSD,
      priceHBAR,
      hbarRate: hbarRateUSD,
    }
    return NextResponse.json(response, { status: 201 })

  } catch (err) {
    console.error('[marketplace/purchase] unhandled error:', err)
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
