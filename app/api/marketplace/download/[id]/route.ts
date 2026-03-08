/**
 * GET /api/marketplace/download/[id]
 *
 * SSE endpoint — streams real-time build progress to the client, then
 * emits a final { step:'done', downloadUrl } event the browser uses to
 * trigger the ZIP download.
 *
 * Steps emitted:
 *   auth_check → checking_cache → loading_clips → fetching_audio (×N) →
 *   building_zip → uploading → generating_url → done | error
 *
 * Storage lifecycle:
 *  - Package built on-demand into dataset-exports bucket
 *  - Signed URL valid for 24 h (EXPORT_TTL_SECONDS)
 *  - Package auto-deleted from storage after first download
 *  - If package already exists (re-download within TTL) it is served directly
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest } from 'next/server'

const EXPORT_TTL_SECONDS = 24 * 60 * 60
const IPFS_GATEWAY = 'https://gateway.pinata.cloud/ipfs'

async function fetchFromIPFS(cid: string): Promise<{ data: ArrayBuffer; contentType: string }> {
  const res = await fetch(`${IPFS_GATEWAY}/${cid}`, { signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`IPFS fetch failed for CID ${cid}: HTTP ${res.status}`)
  return { data: await res.arrayBuffer(), contentType: res.headers.get('content-type') ?? 'application/octet-stream' }
}

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i]
    for (let j = 0; j < 8; j++) crc = (crc >>> 1) ^ (0xEDB88320 & -(crc & 1))
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function buildZipBuffer(files: Array<{ name: string; data: Uint8Array | string }>): Uint8Array {
  const enc = new TextEncoder()
  type Entry = { name: Uint8Array; data: Uint8Array; offset: number }
  const entries: Entry[] = []
  const parts: Uint8Array[] = []
  let offset = 0

  for (const file of files) {
    const nameBytes = enc.encode(file.name)
    const dataBytes = typeof file.data === 'string' ? enc.encode(file.data) : file.data
    const localHeader = new Uint8Array(30 + nameBytes.length)
    const dv = new DataView(localHeader.buffer)
    dv.setUint32(0, 0x04034b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 0, true)
    dv.setUint16(8, 0, true); dv.setUint16(10, 0, true); dv.setUint16(12, 0, true)
    dv.setUint32(14, crc32(dataBytes), true)
    dv.setUint32(18, dataBytes.length, true); dv.setUint32(22, dataBytes.length, true)
    dv.setUint16(26, nameBytes.length, true); dv.setUint16(28, 0, true)
    localHeader.set(nameBytes, 30)
    entries.push({ name: nameBytes, data: dataBytes, offset })
    parts.push(localHeader, dataBytes)
    offset += localHeader.length + dataBytes.length
  }

  const centralParts: Uint8Array[] = []
  let centralSize = 0
  for (const e of entries) {
    const c = new Uint8Array(46 + e.name.length)
    const dv = new DataView(c.buffer)
    dv.setUint32(0, 0x02014b50, true); dv.setUint16(4, 20, true); dv.setUint16(6, 20, true)
    dv.setUint16(8, 0, true); dv.setUint16(10, 0, true); dv.setUint16(12, 0, true); dv.setUint16(14, 0, true)
    dv.setUint32(16, crc32(e.data), true); dv.setUint32(20, e.data.length, true); dv.setUint32(24, e.data.length, true)
    dv.setUint16(28, e.name.length, true); dv.setUint16(30, 0, true); dv.setUint16(32, 0, true)
    dv.setUint16(34, 0, true); dv.setUint16(36, 0, true); dv.setUint32(38, 0, true); dv.setUint32(42, e.offset, true)
    c.set(e.name, 46); centralParts.push(c); centralSize += c.length
  }

  const eocd = new Uint8Array(22)
  const edv = new DataView(eocd.buffer)
  edv.setUint32(0, 0x06054b50, true); edv.setUint16(4, 0, true); edv.setUint16(6, 0, true)
  edv.setUint16(8, entries.length, true); edv.setUint16(10, entries.length, true)
  edv.setUint32(12, centralSize, true); edv.setUint32(16, offset, true); edv.setUint16(20, 0, true)

  const all = [...parts, ...centralParts, eocd]
  const total = all.reduce((s, p) => s + p.length, 0)
  const buf = new Uint8Array(total)
  let pos = 0; for (const p of all) { buf.set(p, pos); pos += p.length }
  return buf
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const encoder = new TextEncoder()
  const { id: purchaseId } = await params

  const stream = new ReadableStream({
    async start(controller) {
      function emit(event: Record<string, unknown>) {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch { /* stream closed */ }
      }
      function close() {
        try { controller.close() } catch { /* already closed */ }
      }

      try {
        // ── Step 1: Auth + ownership check ────────────────────────────
        emit({ step: 'auth_check', message: 'Authenticating…' })

        const supabase = await createClient()
        const { data: { user }, error: authErr } = await supabase.auth.getUser()
        if (authErr || !user) {
          emit({ step: 'error', message: 'Authentication failed', error: 'Unauthorized' })
          close(); return
        }

        const admin = await createAdminClient()

        const { data: purchase, error: fetchErr } = await admin
          .from('dataset_purchases')
          .select('id, buyer_id, payment_status, export_expires_at, downloaded_at, download_count, sample_count, price_usd, audio_clip_ids')
          .eq('id', purchaseId)
          .single()

        if (fetchErr || !purchase) {
          emit({ step: 'error', message: 'Purchase not found', error: 'Not found' })
          close(); return
        }

        const { data: adminRole } = await admin.from('user_roles').select('id').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
        if (purchase.buyer_id !== user.id && !adminRole) {
          emit({ step: 'error', message: 'Access denied', error: 'Forbidden' })
          close(); return
        }
        if (purchase.payment_status !== 'completed') {
          emit({ step: 'error', message: 'Purchase is not completed yet', error: 'Payment pending' })
          close(); return
        }
        if (purchase.export_expires_at && new Date(purchase.export_expires_at) < new Date()) {
          emit({ step: 'error', message: 'Download window has expired', error: 'Link expired — contact support' })
          close(); return
        }

        const exportPath = `purchases/${purchaseId}/dataset.zip`

        // ── Step 2: Check cache ────────────────────────────────────────
        emit({ step: 'checking_cache', message: 'Checking for existing package…' })

        const { data: listing } = await admin.storage
          .from('dataset-exports')
          .list(`purchases/${purchaseId}`)
        const packageExists = (listing ?? []).some((f: { name: string }) => f.name === 'dataset.zip')

        if (!packageExists) {
          // ── Step 3a: Load clip IDs ─────────────────────────────────
          const clipIds: string[] = purchase.audio_clip_ids ?? []

          emit({
            step:    'loading_clips',
            message: 'Loading clip data…',
            detail:  `${clipIds.length} clip(s)`,
          })

          // ── Step 3b: Query clips with joins ────────────────────────
          const { data: clips, error: clipsErr } = await admin
            .from('audio_clips')
            .select(`
              id, audio_cid, duration_seconds, speaker_gender, speaker_age_range, speaker_count,
              dialects ( name, code ),
              transcriptions ( content, transcript_cid ),
              translations ( content, translation_cid )
            `)
            .in('id', clipIds)

          if (clipsErr || !clips) {
            emit({ step: 'error', message: 'Failed to load clip data', error: clipsErr?.message ?? 'Unknown error' })
            close(); return
          }

          const zipFiles: Array<{ name: string; data: Uint8Array | string }> = []
          const manifestLines: string[] = []
          let totalDurationSeconds = 0
          const dialectSet = new Set<string>()
          const genderCounts: Record<string, number> = {}
          const ageCounts: Record<string, number> = {}

          // ── Step 3c: Fetch audio from IPFS + build text files ──────
          for (let i = 0; i < clips.length; i++) {
            const clip = clips[i]
            // @ts-ignore — supabase join typing
            const dialect       = Array.isArray(clip.dialects)       ? clip.dialects[0]       : clip.dialects
            // @ts-ignore
            const transcription = Array.isArray(clip.transcriptions) ? clip.transcriptions[0] : clip.transcriptions
            // @ts-ignore
            const translation   = Array.isArray(clip.translations)   ? clip.translations[0]   : clip.translations

            const dCode = dialect?.code ?? 'xx'
            const dName = dialect?.name ?? 'Unknown'
            dialectSet.add(dName)
            totalDurationSeconds += clip.duration_seconds ?? 0
            if (clip.speaker_gender)    genderCounts[clip.speaker_gender]    = (genderCounts[clip.speaker_gender]    ?? 0) + 1
            if (clip.speaker_age_range) ageCounts[clip.speaker_age_range]    = (ageCounts[clip.speaker_age_range]   ?? 0) + 1

            emit({
              step:    'fetching_audio',
              message: `Fetching audio from IPFS…`,
              detail:  `Clip ${i + 1} of ${clips.length} · ${dName}`,
              current: i + 1,
              total:   clips.length,
            })

            let audioFileName = `audio/${clip.id}.${dCode}.bin`
            if (clip.audio_cid) {
              try {
                const { data: audioData, contentType } = await fetchFromIPFS(clip.audio_cid)
                const ext = contentType.includes('wav') ? 'wav'
                  : (contentType.includes('mpeg') || contentType.includes('mp3')) ? 'mp3'
                  : contentType.includes('ogg') ? 'ogg'
                  : (contentType.includes('m4a') || contentType.includes('mp4')) ? 'm4a' : 'bin'
                audioFileName = `audio/${clip.id}.${dCode}.${ext}`
                zipFiles.push({ name: audioFileName, data: new Uint8Array(audioData) })
              } catch (e) {
                console.warn(`[download] IPFS fetch failed for CID ${clip.audio_cid}:`, e)
                // Non-fatal — clip is included in manifest without audio file
              }
            }

            // Transcript → transcripts/{id}.{dialect}.txt
            const transcriptText = transcription?.content ?? ''
            if (transcriptText) {
              zipFiles.push({ name: `transcripts/${clip.id}.${dCode}.txt`, data: transcriptText })
            }

            // Translation → translations/{id}.en.txt
            const translationText = translation?.content ?? ''
            if (translationText) {
              zipFiles.push({ name: `translations/${clip.id}.en.txt`, data: translationText })
            }

            manifestLines.push(JSON.stringify({
              id:               clip.id,
              dialect_code:     dCode,
              dialect_name:     dName,
              audio_file:       audioFileName,
              audio_cid:        clip.audio_cid ?? null,
              transcript_file:  transcriptText  ? `transcripts/${clip.id}.${dCode}.txt` : null,
              translation_file: translationText ? `translations/${clip.id}.en.txt`      : null,
              duration_seconds: clip.duration_seconds,
              speaker_gender:   clip.speaker_gender,
              speaker_age:      clip.speaker_age_range,
              speaker_count:    clip.speaker_count,
              transcript:       transcriptText  || null,
              translation:      translationText || null,
            }))
          }

          // ── Step 3d: Build README (HuggingFace dataset card) ───────
          emit({ step: 'building_zip', message: 'Building dataset card & JSONL manifest…' })

          zipFiles.push({ name: 'data.jsonl', data: manifestLines.join('\n') })

          const totalMinutes = Math.round(totalDurationSeconds / 60)
          const dialectList  = Array.from(dialectSet)
          const datasetCard  = `---
license: other
license_name: Afridialect Commercial Dataset License
license_link: https://afridialect.ai/legal/dataset-license
language:
${dialectList.map((d) => `  - ${d.toLowerCase().replace(/\s+/g, '-')}`).join('\n')}
task_categories:
  - automatic-speech-recognition
  - audio-classification
size_categories:
  - ${clips.length < 1000 ? 'n<1K' : clips.length < 10000 ? '1K<n<10K' : '10K<n<100K'}
---

# Afridialect AI/ML Dataset Export

**Purchase ID:** ${purchaseId}
**Generated:** ${new Date().toISOString()}
**Buyer:** ${user.email ?? user.id}
**License:** Afridialect Commercial Dataset License (AI/ML Training Use Only)

> ⚠️ **This dataset is licensed exclusively for AI/ML model training purposes.**
> Redistribution, resale, sublicensing, or any use outside of model training is strictly prohibited.
> See the [License Terms](#license-terms) section below.

## Dataset Summary

| Attribute | Value |
|-----------|-------|
| Samples | ${clips.length} |
| Languages / Dialects | ${dialectList.join(', ')} |
| Total Duration | ${totalMinutes} min (${totalDurationSeconds.toFixed(0)}s) |
| Avg Duration/Sample | ${(totalDurationSeconds / Math.max(clips.length, 1)).toFixed(1)}s |

## Speaker Statistics

**Gender distribution:**
${Object.entries(genderCounts).map(([g, c]) => `- ${g}: ${c} samples`).join('\n') || '- (not recorded)'}

**Age distribution:**
${Object.entries(ageCounts).map(([a, c]) => `- ${a}: ${c} samples`).join('\n') || '- (not recorded)'}

## Package Contents

\`\`\`
dataset.zip/
├── README.md                            ← This dataset card & license terms
├── data.jsonl                           ← JSONL manifest (one record per sample)
├── audio/
│   └── <clip-id>.<dialect>.<ext>        ← Audio files (from IPFS)
├── transcripts/
│   └── <clip-id>.<dialect>.txt          ← Verbatim transcriptions
└── translations/
    └── <clip-id>.en.txt                 ← English translations
\`\`\`

## JSONL Manifest Schema

| Field | Type | Description |
|-------|------|-------------|
| \`id\` | string | Unique clip UUID |
| \`dialect_code\` | string | e.g. "kikuyu" |
| \`dialect_name\` | string | e.g. "Kikuyu" |
| \`audio_file\` | string | Path within ZIP |
| \`audio_cid\` | string | IPFS CID (permanent) |
| \`transcript_file\` | string\\|null | Path within ZIP |
| \`translation_file\` | string\\|null | Path within ZIP |
| \`duration_seconds\` | number | Clip length |
| \`speaker_gender\` | string | male/female/mixed/unknown |
| \`speaker_age\` | string | child/teen/adult/senior/mixed |
| \`speaker_count\` | number | Number of speakers |
| \`transcript\` | string\\|null | Full transcription text |
| \`translation\` | string\\|null | Full English translation |

## Annotation Guidelines

- **Transcription:** Verbatim orthographic transcription in the source dialect.
- **Translation:** Faithful English translation of the transcription.
- **QC:** All samples passed multi-stage quality control (audio QC → transcript QC → translation QC).

## IPFS Audio Access

Audio is permanently pinned on IPFS. Retrieve any file directly:

\`https://gateway.pinata.cloud/ipfs/{audio_cid}\`

## License Terms

**Afridialect Commercial Dataset License — AI/ML Training Use Only**

This dataset (including all audio files, transcriptions, translations, and metadata) is provided
under a **restricted commercial license**. By downloading or using this dataset you agree to the
following terms:

### Permitted Uses ✅

- Training, fine-tuning, evaluating, or benchmarking machine learning or AI models.
- Internal research and development directly related to AI/ML model training.
- Publishing academic research results derived from models trained on this data,
  provided the dataset itself is not reproduced or shared.

### Prohibited Uses ❌

- **No redistribution:** You may not share, publish, upload, transfer, or otherwise distribute
  this dataset or any portion of it to any third party, in any form, whether commercially or
  for free.
- **No resale or sublicensing:** You may not sell, rent, lease, sublicense, or otherwise
  commercialise access to this dataset or any derivative dataset that substantially reproduces
  its contents.
- **No non-AI/ML use:** You may not use this dataset for purposes other than AI/ML model
  training (e.g. content production, media, transcription services, or publishing the raw
  audio or text).
- **No public hosting:** You may not upload this dataset or its contents to any publicly
  accessible repository, data platform, or storage service (including but not limited to
  HuggingFace Hub, Kaggle, GitHub, or S3 public buckets).

### Attribution

When publishing research or model cards that reference training data sourced from Afridialect,
include the following attribution:

> *Dataset sourced from Afridialect AI (https://afridialect.ai). Used under commercial license
> for AI/ML training purposes only.*

### Enforcement

Breach of these terms may result in immediate termination of your license, legal action, and
a permanent ban from the Afridialect platform. Afridialect reserves the right to audit usage
upon reasonable notice.

For questions contact: **legal@afridialect.ai**

© ${new Date().getFullYear()} Afridialect AI. All rights reserved.
`
          zipFiles.unshift({ name: 'README.md', data: datasetCard })

          // ── Step 3e: Pack into ZIP ─────────────────────────────────
          emit({
            step:    'building_zip',
            message: 'Packing ZIP archive…',
            detail:  `${zipFiles.length} file(s)`,
          })

          const zipBuffer = buildZipBuffer(zipFiles)

          console.log(`[download] Building ZIP: purchaseId=${purchaseId}, clips=${clips.length}, files=${zipFiles.length}, size=${(zipBuffer.length / 1024).toFixed(1)} KB`)

          // ── Step 3f: Upload ZIP to storage (with retry) ───────────
          emit({
            step:    'uploading',
            message: 'Uploading to secure storage…',
            detail:  `${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB`,
          })

          const zipBlob = new Blob([zipBuffer.buffer as ArrayBuffer], { type: 'application/zip' })

          let uploadErr: { message: string } | null = null
          for (let attempt = 1; attempt <= 3; attempt++) {
            const { error } = await admin.storage
              .from('dataset-exports')
              .upload(exportPath, zipBlob, { contentType: 'application/zip', upsert: true })
            if (!error) { uploadErr = null; break }
            uploadErr = error
            console.warn(`[download] ZIP upload attempt ${attempt}/3 failed:`, error)
            if (attempt < 3) await new Promise((r) => setTimeout(r, 1500 * attempt))
          }

          if (uploadErr) {
            console.error('[download] ZIP upload error:', uploadErr)
            emit({ step: 'error', message: 'Failed to upload dataset package', error: uploadErr.message })
            close(); return
          }

          console.log(`[download] Package built: ${purchaseId}, ${clips.length} clips, ${zipBuffer.length} bytes`)
        } else {
          emit({ step: 'checking_cache', message: 'Using existing package…', detail: 'Package found in cache' })
        }

        // ── Step 4: Generate 24h signed URL ───────────────────────────
        emit({ step: 'generating_url', message: 'Generating secure download link…' })

        const { data: signedData, error: signErr } = await admin.storage
          .from('dataset-exports')
          .createSignedUrl(exportPath, EXPORT_TTL_SECONDS)

        if (signErr || !signedData?.signedUrl) {
          emit({ step: 'error', message: 'Failed to generate download link', error: signErr?.message ?? 'Unknown error' })
          close(); return
        }

        // Track download
        const newCount = (purchase.download_count ?? 0) + 1
        const updateData: Record<string, unknown> = { download_count: newCount }
        if (!purchase.downloaded_at) updateData.downloaded_at = new Date().toISOString()
        await admin.from('dataset_purchases').update(updateData).eq('id', purchaseId)

        await admin.from('audit_logs').insert({
          user_id:       user.id,
          action:        'dataset_download',
          resource_type: 'dataset_purchases',
          resource_id:   purchaseId,
          details:       { sample_count: purchase.sample_count, price_usd: purchase.price_usd, download_count: newCount },
        })

        // ── Step 5: Done ───────────────────────────────────────────────
        emit({
          step:        'done',
          message:     'Dataset ready!',
          downloadUrl: signedData.signedUrl,
          sampleCount: purchase.sample_count,
          downloadCount: newCount,
        })

      } catch (err) {
        console.error('[download] unhandled error:', err)
        emit({ step: 'error', message: 'Unexpected error', error: err instanceof Error ? err.message : 'Internal server error' })
      } finally {
        close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream',
      'Cache-Control':     'no-cache, no-transform',
      'Connection':        'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
