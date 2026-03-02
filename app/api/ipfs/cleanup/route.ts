/**
 * POST /api/ipfs/cleanup
 *
 * Admin-only. Removes a minted clip's audio file from Supabase Storage
 * (audio-staging bucket) after confirming it has been pinned to IPFS
 * and the clip status is `minted`.
 *
 * Body: { clipId: string }
 *
 * Response:
 *  {
 *    success: true,
 *    clipId: string,
 *    removedPath: string
 *  }
 */

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import { verifyPin } from '@/lib/hedera/ipfs'

export async function POST(request: NextRequest) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
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
      return NextResponse.json({ error: 'Admin role required' }, { status: 403 })
    }

    // ── Parse body ────────────────────────────────────────────────────────
    const body = await request.json()
    const { clipId } = body

    if (!clipId || typeof clipId !== 'string') {
      return NextResponse.json({ error: 'clipId is required' }, { status: 400 })
    }

    // ── Fetch the clip ────────────────────────────────────────────────────
    const { data: clip, error: clipError } = await admin
      .from('audio_clips')
      .select('id, status, audio_url, audio_cid, uploader_id')
      .eq('id', clipId)
      .single()

    if (clipError || !clip) {
      return NextResponse.json({ error: 'Audio clip not found' }, { status: 404 })
    }

    // Guard: only clean up after the clip is fully minted
    if (clip.status !== 'minted') {
      return NextResponse.json(
        {
          error: `Clip status is '${clip.status}'. Cleanup is only allowed for minted clips.`,
        },
        { status: 409 }
      )
    }

    // Guard: ensure the audio CID is pinned before removing staging file
    if (!clip.audio_cid) {
      return NextResponse.json(
        { error: 'Clip has no audio_cid. IPFS pin must exist before cleanup.' },
        { status: 422 }
      )
    }

    let isPinned = false
    try {
      isPinned = await verifyPin(clip.audio_cid)
    } catch (err) {
      return NextResponse.json(
        { error: `Could not verify IPFS pin: ${err instanceof Error ? err.message : String(err)}` },
        { status: 502 }
      )
    }

    if (!isPinned) {
      return NextResponse.json(
        {
          error: `CID ${clip.audio_cid} is NOT pinned on Pinata. Refusing to delete staging file until IPFS pin is confirmed.`,
        },
        { status: 409 }
      )
    }

    // ── Derive the storage path from the audio_url ─────────────────────
    // audio_url format: https://<host>/storage/v1/object/public/audio-staging/{user_id}/{clip_id}.{ext}
    const audioUrl: string = clip.audio_url ?? ''
    const markerPublic = '/object/public/audio-staging/'
    const markerSign = '/object/sign/audio-staging/'

    let storagePath = ''
    if (audioUrl.includes(markerPublic)) {
      storagePath = audioUrl.split(markerPublic)[1] ?? ''
    } else if (audioUrl.includes(markerSign)) {
      storagePath = audioUrl.split(markerSign)[1]?.split('?')[0] ?? ''
    }

    if (!storagePath) {
      return NextResponse.json(
        { error: 'Could not determine storage path from audio_url.' },
        { status: 422 }
      )
    }

    // ── Remove from Supabase Storage ──────────────────────────────────────
    const { error: removeError } = await admin.storage
      .from('audio-staging')
      .remove([storagePath])

    if (removeError) {
      return NextResponse.json(
        { error: `Storage removal failed: ${removeError.message}` },
        { status: 500 }
      )
    }

    // ── Mark clip as cleaned up in DB ─────────────────────────────────────
    await admin
      .from('audio_clips')
      .update({
        staging_cleaned_up: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', clipId)

    // ── Audit log ─────────────────────────────────────────────────────────
    await admin.from('audit_logs').insert({
      user_id: user.id,
      action: 'ipfs_cleanup_staging',
      resource_type: 'audio_clip',
      resource_id: clipId,
      details: {
        removed_path: storagePath,
        audio_cid: clip.audio_cid,
        verified_pinned: true,
      },
    })

    console.log(`[ipfs/cleanup] Removed staging file: ${storagePath}`)

    return NextResponse.json({
      success: true,
      clipId,
      removedPath: storagePath,
    })
  } catch (err) {
    console.error('[ipfs/cleanup] Unhandled error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
