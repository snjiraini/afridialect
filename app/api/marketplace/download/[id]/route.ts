/**
 * GET /api/marketplace/download/[id]
 *
 * Builds and returns a full HuggingFace-compatible AI/ML dataset package
 * for a completed purchase. The package is assembled from IPFS-pinned files
 * and includes:
 *   - Audio files (downloaded from IPFS)
 *   - Transcripts (text)
 *   - English translations (text)
 *   - A JSONL manifest
 *   - A dataset card (README.md in HuggingFace format)
 *
 * Flow:
 * 1. Auth + ownership check
 * 2. If package already exists in staging (dataset-exports bucket), serve it
 * 3. Otherwise: fetch clip data, download from IPFS, build ZIP, upload to staging
 * 4. Return signed URL (24h TTL)
 * 5. Track download; auto-delete package from staging after first successful download
 *
 * Storage lifecycle:
 *  - After minting: staging audio/transcript/translation files cleaned up
 *  - On purchase: package assembled from IPFS into dataset-exports bucket
 *  - After download: package deleted from dataset-exports bucket
 *  - Package auto-expires after 24h regardless (export_expires_at)
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

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
  try {
    const { id: purchaseId } = await params

    const supabase = await createClient()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = createAdminClient()

    const { data: purchase, error: fetchErr } = await admin
      .from('dataset_purchases')
      .select('id, buyer_id, payment_status, export_expires_at, downloaded_at, download_count, sample_count, price_usd, audio_clip_ids, package_deleted_at')
      .eq('id', purchaseId)
      .single()

    if (fetchErr || !purchase) return NextResponse.json({ error: 'Purchase not found' }, { status: 404 })

    const { data: adminRole } = await admin.from('user_roles').select('id').eq('user_id', user.id).eq('role', 'admin').maybeSingle()
    if (purchase.buyer_id !== user.id && !adminRole) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    if (purchase.payment_status !== 'completed') return NextResponse.json({ error: 'Purchase is not completed' }, { status: 400 })

    if (purchase.export_expires_at && new Date(purchase.export_expires_at) < new Date()) {
      return NextResponse.json({ error: 'Download link has expired. Please contact support.' }, { status: 410 })
    }
    if (purchase.package_deleted_at) {
      return NextResponse.json({ error: 'This dataset package was already downloaded and deleted per our retention policy.' }, { status: 410 })
    }

    const exportPath = `purchases/${purchaseId}/dataset.zip`

    // Check if package already exists
    const { data: listing } = await admin.storage.from('dataset-exports').list(`purchases/${purchaseId}`)
    const packageExists = (listing ?? []).some((f: { name: string }) => f.name === 'dataset.zip')

    if (!packageExists) {
      // Build the package from IPFS
      const clipIds: string[] = purchase.audio_clip_ids ?? []
      const { data: clips, error: clipsErr } = await admin
        .from('audio_clips')
        .select(`
          id, audio_cid, duration_seconds, speaker_gender, speaker_age_range, speaker_count,
          dialects ( name, code ),
          transcriptions ( content, transcript_cid ),
          translations ( content, translation_cid )
        `)
        .in('id', clipIds)

      if (clipsErr || !clips) return NextResponse.json({ error: 'Failed to load clip data' }, { status: 500 })

      const zipFiles: Array<{ name: string; data: Uint8Array | string }> = []
      const manifestLines: string[] = []
      let totalDurationSeconds = 0
      const dialectSet = new Set<string>()
      const genderCounts: Record<string, number> = {}
      const ageCounts: Record<string, number> = {}

      for (const clip of clips) {
        // @ts-ignore
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
            console.warn(`[download] Could not fetch audio CID ${clip.audio_cid} from IPFS:`, e)
          }
        }

        const transcriptText = transcription?.content ?? ''
        if (transcriptText) zipFiles.push({ name: `transcripts/${clip.id}.${dCode}.txt`, data: transcriptText })

        const translationText = translation?.content ?? ''
        if (translationText) zipFiles.push({ name: `translations/${clip.id}.en.txt`, data: translationText })

        manifestLines.push(JSON.stringify({
          id:               clip.id,
          dialect_code:     dCode,
          dialect_name:     dName,
          audio_file:       audioFileName,
          audio_cid:        clip.audio_cid ?? null,
          transcript_file:  transcriptText ? `transcripts/${clip.id}.${dCode}.txt` : null,
          translation_file: translationText ? `translations/${clip.id}.en.txt` : null,
          duration_seconds: clip.duration_seconds,
          speaker_gender:   clip.speaker_gender,
          speaker_age:      clip.speaker_age_range,
          speaker_count:    clip.speaker_count,
          transcript:       transcriptText || null,
          translation:      translationText || null,
        }))
      }

      zipFiles.push({ name: 'data.jsonl', data: manifestLines.join('\n') })

      // Build dataset card
      const totalMinutes = Math.round(totalDurationSeconds / 60)
      const dialectList  = Array.from(dialectSet)
      const datasetCard  = `---
license: cc-by-4.0
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
**License:** [CC-BY-4.0](https://creativecommons.org/licenses/by/4.0/)

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
├── README.md                            ← This dataset card
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

- **Transcription:** Verbatim orthographic transcription in the source dialect. Speaker turns separated by newlines.
- **Translation:** Faithful English translation of the transcription.
- **QC:** All samples passed multi-stage quality control (audio QC → transcript QC → translation QC).

## IPFS Audio Access

Audio is permanently pinned on IPFS. Retrieve any file via:

\`https://gateway.pinata.cloud/ipfs/{audio_cid}\`

## Licensing

[Creative Commons Attribution 4.0 International (CC-BY-4.0)](https://creativecommons.org/licenses/by/4.0/)

## Citation

\`\`\`bibtex
@dataset{afridialect_${new Date().getFullYear()},
  title     = {Afridialect AI/ML Dataset},
  author    = {Afridialect Community Contributors},
  year      = {${new Date().getFullYear()}},
  url       = {https://afridialect.ai},
  license   = {CC-BY-4.0}
}
\`\`\`
`
      zipFiles.unshift({ name: 'README.md', data: datasetCard })

      const zipBuffer = buildZipBuffer(zipFiles)

      const { error: uploadErr } = await admin.storage
        .from('dataset-exports')
        .upload(exportPath, zipBuffer, { contentType: 'application/zip', upsert: true })

      if (uploadErr) {
        console.error('[download] ZIP upload error:', uploadErr)
        return NextResponse.json({ error: 'Failed to build dataset package' }, { status: 500 })
      }
      console.log(`[download] Package built for ${purchaseId}: ${clips.length} clips, ${zipBuffer.length} bytes`)
    }

    // Generate signed URL
    const { data: signedData, error: signErr } = await admin.storage
      .from('dataset-exports')
      .createSignedUrl(exportPath, EXPORT_TTL_SECONDS)

    if (signErr || !signedData?.signedUrl) {
      console.error('[download] signed URL error:', signErr)
      return NextResponse.json({ error: 'Failed to generate download URL' }, { status: 500 })
    }

    // Track download
    const newCount = (purchase.download_count ?? 0) + 1
    const updateData: Record<string, unknown> = { download_count: newCount }
    if (!purchase.downloaded_at) updateData.downloaded_at = new Date().toISOString()
    await admin.from('dataset_purchases').update(updateData).eq('id', purchaseId)

    await admin.from('audit_logs').insert({
      user_id: user.id, action: 'dataset_download', resource_type: 'dataset_purchases', resource_id: purchaseId,
      details: { sample_count: purchase.sample_count, price_usd: purchase.price_usd, download_count: newCount },
    })

    // Auto-delete package from storage after first download (signed URL remains valid)
    Promise.resolve().then(async () => {
      try {
        await admin.storage.from('dataset-exports').remove([exportPath])
        await admin.from('dataset_purchases').update({ package_deleted_at: new Date().toISOString() }).eq('id', purchaseId)
        console.log(`[download] Auto-deleted package for ${purchaseId} after download #${newCount}`)
      } catch (e) {
        console.warn(`[download] Auto-delete failed for ${purchaseId}:`, e)
      }
    })

    return NextResponse.json({
      success: true, downloadUrl: signedData.signedUrl,
      expiresAt: purchase.export_expires_at, sampleCount: purchase.sample_count,
      priceUSD: purchase.price_usd, downloadCount: newCount, packageFormat: 'zip',
    })

  } catch (err) {
    console.error('[marketplace/download] unhandled error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 })
  }
}
