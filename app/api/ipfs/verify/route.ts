/**
 * POST /api/ipfs/verify
 *
 * Admin-only. Verifies that every IPFS CID stored in nft_records
 * for a given clip is actually pinned on Pinata.
 *
 * Body: { clipId: string }
 *
 * Response:
 *  {
 *    success: true,
 *    clipId: string,
 *    results: Array<{ nftType: string; cid: string; pinned: boolean }>
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

    // ── Fetch nft_records for this clip ───────────────────────────────────
    const { data: nftRecords, error: fetchError } = await admin
      .from('nft_records')
      .select('id, nft_type, ipfs_cid')
      .eq('audio_clip_id', clipId)

    if (fetchError) {
      return NextResponse.json(
        { error: `Failed to fetch NFT records: ${fetchError.message}` },
        { status: 500 }
      )
    }

    if (!nftRecords || nftRecords.length === 0) {
      return NextResponse.json(
        { error: 'No NFT records found for this clip. Has it been minted yet?' },
        { status: 404 }
      )
    }

    // ── Verify each CID ───────────────────────────────────────────────────
    const results = await Promise.all(
      nftRecords.map(async (record) => {
        let pinned = false
        let verifyError: string | null = null

        try {
          pinned = await verifyPin(record.ipfs_cid)
        } catch (err) {
          verifyError = err instanceof Error ? err.message : 'Unknown error'
        }

        return {
          nftType: record.nft_type,
          cid: record.ipfs_cid,
          pinned,
          error: verifyError ?? undefined,
        }
      })
    )

    const allPinned = results.every((r) => r.pinned)

    // ── Audit log ─────────────────────────────────────────────────────────
    await admin.from('audit_logs').insert({
      user_id: user.id,
      action: 'ipfs_verify_pins',
      resource_type: 'audio_clip',
      resource_id: clipId,
      details: { results, allPinned },
    })

    console.log(`[ipfs/verify] clip=${clipId} allPinned=${allPinned}`)

    return NextResponse.json({ success: true, clipId, allPinned, results })
  } catch (err) {
    console.error('[ipfs/verify] Unhandled error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
