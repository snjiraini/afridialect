/**
 * POST /api/hedera/mint
 *
 * Admin-only endpoint to mint NFTs for a clip that is in `mint_ready` status.
 *
 * Flow:
 *  1. Verify admin role
 *  2. Fetch clip, transcription, translation, and contributor profiles
 *  3. Pin audio/transcript/translation files to IPFS via Pinata
 *  4. Build NFT metadata and pin metadata JSON to IPFS
 *  5. Mint 300 audio NFTs → uploader Hedera account
 *  6. Mint 300 transcript NFTs → transcriber Hedera account
 *  7. Mint 300 translation NFTs → translator Hedera account
 *  8. Save nft_records rows to database
 *  9. Update clip status → minted
 * 10. Audit log
 *
 * Body: { clipId: string }
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { mintNftSet } from '@/lib/hedera/nft'
import {
  pinFileFromUrl,
  pinJsonToIPFS,
  buildNftMetadata,
} from '@/lib/hedera/ipfs'

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Verify admin role
    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (!roleRow) {
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 })
    }

    // ── Validate request body ─────────────────────────────────────────────
    const body = await request.json()
    const { clipId } = body

    if (!clipId || typeof clipId !== 'string') {
      return NextResponse.json({ error: 'clipId is required' }, { status: 400 })
    }

    // ── Fetch clip ────────────────────────────────────────────────────────
    const { data: clip, error: clipError } = await admin
      .from('audio_clips')
      .select(`
        id,
        status,
        audio_url,
        duration_seconds,
        uploader_id,
        dialects ( name, code )
      `)
      .eq('id', clipId)
      .single()

    if (clipError || !clip) {
      return NextResponse.json({ error: 'Audio clip not found' }, { status: 404 })
    }

    if (clip.status !== 'mint_ready') {
      return NextResponse.json(
        { error: `Clip is not in mint_ready status (current: ${clip.status})` },
        { status: 409 }
      )
    }

    // ── Fetch transcription ───────────────────────────────────────────────
    const { data: transcription } = await admin
      .from('transcriptions')
      .select('content, transcriber_id')
      .eq('audio_clip_id', clipId)
      .single()

    if (!transcription) {
      return NextResponse.json({ error: 'Transcription not found for clip' }, { status: 422 })
    }

    // ── Fetch translation ─────────────────────────────────────────────────
    const { data: translation } = await admin
      .from('translations')
      .select('content, translator_id')
      .eq('audio_clip_id', clipId)
      .single()

    if (!translation) {
      return NextResponse.json({ error: 'Translation not found for clip' }, { status: 422 })
    }

    // ── Fetch contributor Hedera accounts ─────────────────────────────────
    const contributorIds = [
      clip.uploader_id,
      transcription.transcriber_id,
      translation.translator_id,
    ]

    const { data: profiles } = await admin
      .from('profiles')
      .select('id, hedera_account_id')
      .in('id', contributorIds)

    const profileMap: Record<string, string> = {}
    for (const p of profiles ?? []) {
      if (p.hedera_account_id) profileMap[p.id] = p.hedera_account_id
    }

    const uploaderAccount = profileMap[clip.uploader_id]
    const transcriberAccount = profileMap[transcription.transcriber_id]
    const translatorAccount = profileMap[translation.translator_id]

    if (!uploaderAccount) {
      return NextResponse.json(
        { error: 'Uploader does not have a Hedera account. Cannot mint audio NFTs.' },
        { status: 422 }
      )
    }
    if (!transcriberAccount) {
      return NextResponse.json(
        { error: 'Transcriber does not have a Hedera account. Cannot mint transcript NFTs.' },
        { status: 422 }
      )
    }
    if (!translatorAccount) {
      return NextResponse.json(
        { error: 'Translator does not have a Hedera account. Cannot mint translation NFTs.' },
        { status: 422 }
      )
    }

    // @ts-ignore — Supabase join typing
    const dialectRaw = clip.dialects
    const dialect = Array.isArray(dialectRaw) ? dialectRaw[0] : dialectRaw
    const dialectName: string = dialect?.name ?? 'Unknown'
    const dialectCode: string = dialect?.code ?? 'xx'

    // ── Pin audio file to IPFS ────────────────────────────────────────────
    console.log(`[mint] Pinning audio for clip ${clipId}...`)

    if (!clip.audio_url) {
      return NextResponse.json({ error: 'Audio URL is missing on clip' }, { status: 422 })
    }

    // Generate a signed URL for the private bucket (1 hour TTL for pinning)
    const audioPath = clip.audio_url.split('/audio-staging/')[1] ?? ''
    const { data: signedAudio } = await supabase.storage
      .from('audio-staging')
      .createSignedUrl(audioPath, 3600)

    if (!signedAudio?.signedUrl) {
      return NextResponse.json({ error: 'Could not generate signed URL for audio file' }, { status: 500 })
    }

    // Detect extension from URL
    const audioExt = audioPath.split('.').pop() ?? 'wav'
    const audioMime =
      audioExt === 'mp3' ? 'audio/mpeg' :
      audioExt === 'm4a' ? 'audio/m4a' :
      audioExt === 'ogg' ? 'audio/ogg' :
      audioExt === 'webm' ? 'audio/webm' :
      'audio/wav'

    const audioPinResult = await pinFileFromUrl(
      signedAudio.signedUrl,
      `clip_${clipId}.${audioExt}`,
      audioMime
    )
    const audioCid = audioPinResult.cid
    console.log(`[mint] Audio pinned: ipfs://${audioCid}`)

    // ── Build & pin NFT metadata for each type ────────────────────────────
    console.log(`[mint] Pinning NFT metadata...`)

    const audioMeta = buildNftMetadata({
      type: 'audio',
      clipId,
      dialectName,
      dialectCode,
      durationSeconds: clip.duration_seconds,
      audioCid,
      contributorAccountId: uploaderAccount,
    })

    const transcriptMeta = buildNftMetadata({
      type: 'transcript',
      clipId,
      dialectName,
      dialectCode,
      durationSeconds: clip.duration_seconds,
      audioCid,
      transcriptContent: transcription.content,
      contributorAccountId: transcriberAccount,
    })

    const translationMeta = buildNftMetadata({
      type: 'translation',
      clipId,
      dialectName,
      dialectCode,
      durationSeconds: clip.duration_seconds,
      audioCid,
      translationContent: translation.content,
      contributorAccountId: translatorAccount,
    })

    const [audioPinMeta, transcriptPinMeta, translationPinMeta] = await Promise.all([
      pinJsonToIPFS(audioMeta, `meta_audio_${clipId}`),
      pinJsonToIPFS(transcriptMeta, `meta_transcript_${clipId}`),
      pinJsonToIPFS(translationMeta, `meta_translation_${clipId}`),
    ])

    console.log(`[mint] Metadata pinned: audio=${audioPinMeta.cid}, transcript=${transcriptPinMeta.cid}, translation=${translationPinMeta.cid}`)

    // Update clip with audio CID now that it's pinned
    await admin
      .from('audio_clips')
      .update({ audio_cid: audioCid, status: 'ipfs_pinned', updated_at: new Date().toISOString() })
      .eq('id', clipId)

    // ── Mint NFTs on Hedera ───────────────────────────────────────────────
    console.log(`[mint] Minting audio NFTs for clip ${clipId}...`)

    const audioMintResult = await mintNftSet({
      type: 'audio',
      clipId,
      dialectName,
      metadataCid: audioPinMeta.cid,
      contributorAccountId: uploaderAccount,
    })

    console.log(`[mint] Minting transcript NFTs...`)
    const transcriptMintResult = await mintNftSet({
      type: 'transcript',
      clipId,
      dialectName,
      metadataCid: transcriptPinMeta.cid,
      contributorAccountId: transcriberAccount,
    })

    console.log(`[mint] Minting translation NFTs...`)
    const translationMintResult = await mintNftSet({
      type: 'translation',
      clipId,
      dialectName,
      metadataCid: translationPinMeta.cid,
      contributorAccountId: translatorAccount,
    })

    // ── Save nft_records ──────────────────────────────────────────────────
    const now = new Date().toISOString()

    const { error: nftInsertError } = await admin
      .from('nft_records')
      .insert([
        {
          audio_clip_id: clipId,
          nft_type: 'audio',
          token_id: audioMintResult.tokenId,
          serial_numbers: audioMintResult.serialNumbers,
          contributor_id: clip.uploader_id,
          ipfs_cid: audioPinMeta.cid,
          metadata: {
            createTransactionId: audioMintResult.createTransactionId,
            mintTransactionIds: audioMintResult.mintTransactionIds,
            transferTransactionId: audioMintResult.transferTransactionId,
            metadataCid: audioPinMeta.cid,
            audioCid,
          },
          minted_at: now,
        },
        {
          audio_clip_id: clipId,
          nft_type: 'transcript',
          token_id: transcriptMintResult.tokenId,
          serial_numbers: transcriptMintResult.serialNumbers,
          contributor_id: transcription.transcriber_id,
          ipfs_cid: transcriptPinMeta.cid,
          metadata: {
            createTransactionId: transcriptMintResult.createTransactionId,
            mintTransactionIds: transcriptMintResult.mintTransactionIds,
            transferTransactionId: transcriptMintResult.transferTransactionId,
            metadataCid: transcriptPinMeta.cid,
            audioCid,
          },
          minted_at: now,
        },
        {
          audio_clip_id: clipId,
          nft_type: 'translation',
          token_id: translationMintResult.tokenId,
          serial_numbers: translationMintResult.serialNumbers,
          contributor_id: translation.translator_id,
          ipfs_cid: translationPinMeta.cid,
          metadata: {
            createTransactionId: translationMintResult.createTransactionId,
            mintTransactionIds: translationMintResult.mintTransactionIds,
            transferTransactionId: translationMintResult.transferTransactionId,
            metadataCid: translationPinMeta.cid,
            audioCid,
          },
          minted_at: now,
        },
      ])

    if (nftInsertError) {
      console.error('[mint] NFT records insert error:', nftInsertError)
      // Don't fail the request — NFTs are already minted on-chain; log the error
      return NextResponse.json(
        {
          success: true,
          warning: 'NFTs minted on-chain but database records could not be saved. Check logs.',
          clipId,
          audioTokenId: audioMintResult.tokenId,
          transcriptTokenId: transcriptMintResult.tokenId,
          translationTokenId: translationMintResult.tokenId,
        },
        { status: 207 }
      )
    }

    // ── Update clip status → minted ───────────────────────────────────────
    await admin
      .from('audio_clips')
      .update({ status: 'minted', updated_at: now })
      .eq('id', clipId)

    // ── Audit log ─────────────────────────────────────────────────────────
    await admin.from('audit_logs').insert({
      user_id: user.id,
      action: 'mint_nfts',
      resource_type: 'audio_clip',
      resource_id: clipId,
      details: {
        audio_token_id: audioMintResult.tokenId,
        transcript_token_id: transcriptMintResult.tokenId,
        translation_token_id: translationMintResult.tokenId,
        audio_cid: audioCid,
        dialect: dialectName,
        contributor_ids: {
          uploader: clip.uploader_id,
          transcriber: transcription.transcriber_id,
          translator: translation.translator_id,
        },
      },
    })

    console.log(`[mint] ✅ Clip ${clipId} fully minted`)

    return NextResponse.json({
      success: true,
      clipId,
      audioCid,
      audioToken: {
        tokenId: audioMintResult.tokenId,
        serialNumbers: audioMintResult.serialNumbers,
        metadataCid: audioPinMeta.cid,
      },
      transcriptToken: {
        tokenId: transcriptMintResult.tokenId,
        serialNumbers: transcriptMintResult.serialNumbers,
        metadataCid: transcriptPinMeta.cid,
      },
      translationToken: {
        tokenId: translationMintResult.tokenId,
        serialNumbers: translationMintResult.serialNumbers,
        metadataCid: translationPinMeta.cid,
      },
    })
  } catch (err) {
    console.error('[mint] Unhandled error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
