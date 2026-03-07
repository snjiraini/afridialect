/**
 * POST /api/ipfs/cleanup
 *
 * Admin-only. Removes a minted clip's staging files from Supabase Storage
 * (audio-staging, transcript-staging, translation-staging buckets) after
 * confirming the clip is minted and its audio CID is pinned to IPFS.
 *
 * The transcript and translation content is already captured in the DB
 * (transcriptions.content, translations.content) so the staging files are
 * safe to remove after minting is confirmed.
 *
 * Body: { clipId: string }
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { verifyPin } from '@/lib/hedera/ipfs'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const admin = await createAdminClient()

    const { data: roleRow } = await admin.from('user_roles').select('role').eq('user_id', user.id).eq('role', 'admin').single()
    if (!roleRow) return NextResponse.json({ error: 'Admin role required' }, { status: 403 })

    const body = await request.json()
    const { clipId } = body
    if (!clipId || typeof clipId !== 'string') return NextResponse.json({ error: 'clipId is required' }, { status: 400 })

    const { data: clip, error: clipError } = await admin
      .from('audio_clips')
      .select('id, status, audio_url, audio_cid, uploader_id, staging_cleaned_at')
      .eq('id', clipId)
      .single()

    if (clipError || !clip) return NextResponse.json({ error: 'Audio clip not found' }, { status: 404 })
    if (clip.status !== 'minted') {
      return NextResponse.json({ error: `Clip status is '${clip.status}'. Cleanup only allowed for minted clips.` }, { status: 409 })
    }
    if (!clip.audio_cid) {
      return NextResponse.json({ error: 'Clip has no audio_cid. IPFS pin must exist before cleanup.' }, { status: 422 })
    }
    if (clip.staging_cleaned_at) {
      return NextResponse.json({ success: true, clipId, message: 'Already cleaned up', removedPath: '' })
    }

    let isPinned = false
    try {
      isPinned = await verifyPin(clip.audio_cid)
    } catch (err) {
      return NextResponse.json({ error: `Could not verify IPFS pin: ${err instanceof Error ? err.message : String(err)}` }, { status: 502 })
    }
    if (!isPinned) {
      return NextResponse.json({ error: `CID ${clip.audio_cid} is NOT pinned on Pinata. Refusing to delete staging file.` }, { status: 409 })
    }

    // Derive audio storage path
    const audioUrl: string = clip.audio_url ?? ''
    const markerPublic = '/object/public/audio-staging/'
    const markerSign   = '/object/sign/audio-staging/'
    let storagePath = ''
    if (audioUrl.includes(markerPublic))      storagePath = audioUrl.split(markerPublic)[1] ?? ''
    else if (audioUrl.includes(markerSign))   storagePath = audioUrl.split(markerSign)[1]?.split('?')[0] ?? ''

    const removedPaths: string[] = []

    // Remove audio from staging
    if (storagePath) {
      const { error: removeErr } = await admin.storage.from('audio-staging').remove([storagePath])
      if (!removeErr) removedPaths.push(`audio-staging/${storagePath}`)
      else console.warn(`[ipfs/cleanup] Audio staging remove warning for ${clipId}:`, removeErr.message)
    }

    // Remove transcript staging file if tracked
    const { data: transcription } = await admin.from('transcriptions')
      .select('transcript_url, staging_cleaned_at').eq('audio_clip_id', clipId).maybeSingle()

    if (transcription?.transcript_url && !transcription.staging_cleaned_at) {
      const tUrl = transcription.transcript_url
      const tPath = tUrl.includes('/object/public/transcript-staging/')
        ? tUrl.split('/object/public/transcript-staging/')[1]
        : tUrl.includes('/object/sign/transcript-staging/')
          ? tUrl.split('/object/sign/transcript-staging/')[1]?.split('?')[0]
          : ''
      if (tPath) {
        await admin.storage.from('transcript-staging').remove([tPath]).catch(() => {})
        removedPaths.push(`transcript-staging/${tPath}`)
      }
      await admin.from('transcriptions').update({ staging_cleaned_at: new Date().toISOString() }).eq('audio_clip_id', clipId)
    }

    // Remove translation staging file if tracked
    const { data: translation } = await admin.from('translations')
      .select('translation_url, staging_cleaned_at').eq('audio_clip_id', clipId).maybeSingle()

    if (translation?.translation_url && !translation.staging_cleaned_at) {
      const tUrl = translation.translation_url
      const tPath = tUrl.includes('/object/public/translation-staging/')
        ? tUrl.split('/object/public/translation-staging/')[1]
        : tUrl.includes('/object/sign/translation-staging/')
          ? tUrl.split('/object/sign/translation-staging/')[1]?.split('?')[0]
          : ''
      if (tPath) {
        await admin.storage.from('translation-staging').remove([tPath]).catch(() => {})
        removedPaths.push(`translation-staging/${tPath}`)
      }
      await admin.from('translations').update({ staging_cleaned_at: new Date().toISOString() }).eq('audio_clip_id', clipId)
    }

    // Mark clip staging as cleaned
    await admin.from('audio_clips').update({ staging_cleaned_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq('id', clipId)

    await admin.from('audit_logs').insert({
      user_id: user.id, action: 'ipfs_cleanup_staging', resource_type: 'audio_clip', resource_id: clipId,
      details: { removed_paths: removedPaths, audio_cid: clip.audio_cid, verified_pinned: true },
    })

    console.log(`[ipfs/cleanup] Cleaned staging for clip ${clipId}: ${removedPaths.join(', ')}`)

    return NextResponse.json({ success: true, clipId, removedPath: removedPaths[0] ?? '', removedPaths })
  } catch (err) {
    console.error('[ipfs/cleanup] Unhandled error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal server error' }, { status: 500 })
  }
}
