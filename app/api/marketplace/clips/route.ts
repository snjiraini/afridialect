/**
 * GET /api/marketplace/clips
 *
 * Public browse endpoint — returns sellable clips matching optional filters.
 * Clips with status 'minted' or 'sellable' are eligible.
 *
 * Query params:
 *   dialects    comma-separated dialect codes  e.g. "kikuyu,swahili"
 *   gender      comma-separated                e.g. "male,female"
 *   age         comma-separated                e.g. "adult,senior"
 *   minDuration number (seconds)
 *   maxDuration number (seconds)
 *   speakerCount number
 *   limit       default 50, max 200
 *   offset      default 0
 */

import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'
import type { MarketplaceClip, MarketplaceBrowseResponse } from '@/types'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const dialectsParam = searchParams.get('dialects')
    const genderParam   = searchParams.get('gender')
    const ageParam      = searchParams.get('age')
    const minDur        = parseFloat(searchParams.get('minDuration') ?? '0') || 0
    const maxDur        = parseFloat(searchParams.get('maxDuration') ?? '0') || 0
    const speakerCount  = parseInt(searchParams.get('speakerCount') ?? '0') || 0
    const limit         = Math.min(parseInt(searchParams.get('limit') ?? '50') || 50, 200)
    const offset        = parseInt(searchParams.get('offset') ?? '0') || 0

    const admin = createAdminClient()

    // ── Build base query ──────────────────────────────────────────────────
    let query = admin
      .from('audio_clips')
      .select(`
        id,
        duration_seconds,
        speaker_count,
        speaker_gender,
        speaker_age_range,
        created_at,
        dialects ( name, code ),
        nft_records ( token_id, nft_type )
      `, { count: 'exact' })
      .in('status', ['minted', 'sellable'])
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1)

    // ── Apply filters ─────────────────────────────────────────────────────
    if (dialectsParam) {
      const codes = dialectsParam.split(',').map((c) => c.trim()).filter(Boolean)
      if (codes.length > 0) {
        // Resolve codes → IDs
        const { data: dialectRows } = await admin
          .from('dialects')
          .select('id')
          .in('code', codes)
        const dialectIds = (dialectRows ?? []).map((d) => d.id)
        if (dialectIds.length > 0) {
          query = query.in('dialect_id', dialectIds)
        }
      }
    }

    if (genderParam) {
      const genders = genderParam.split(',').map((g) => g.trim()).filter(Boolean)
      if (genders.length > 0) query = query.in('speaker_gender', genders)
    }

    if (ageParam) {
      const ages = ageParam.split(',').map((a) => a.trim()).filter(Boolean)
      if (ages.length > 0) query = query.in('speaker_age_range', ages)
    }

    if (minDur > 0) query = query.gte('duration_seconds', minDur)
    if (maxDur > 0) query = query.lte('duration_seconds', maxDur)
    if (speakerCount > 0) query = query.eq('speaker_count', speakerCount)

    const { data: rows, count, error } = await query

    if (error) {
      console.error('[marketplace/clips] query error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // ── Shape response ────────────────────────────────────────────────────
    const clips: MarketplaceClip[] = (rows ?? []).map((row) => {
      // @ts-ignore — Supabase join typing
      const dialectRaw = row.dialects
      const dialect = Array.isArray(dialectRaw) ? dialectRaw[0] : dialectRaw

      // @ts-ignore
      const nftRows: Array<{ token_id: string; nft_type: string }> = row.nft_records ?? []
      const audioNft = nftRows.find((n) => n.nft_type === 'audio')

      return {
        id: row.id,
        dialectName: dialect?.name ?? 'Unknown',
        dialectCode: dialect?.code ?? 'xx',
        durationSeconds: row.duration_seconds,
        speakerCount: row.speaker_count ?? 1,
        speakerGender: row.speaker_gender ?? 'unknown',
        speakerAge: row.speaker_age_range ?? 'adult',
        audioNftTokenId: audioNft?.token_id ?? null,
        createdAt: row.created_at,
      }
    })

    const response: MarketplaceBrowseResponse = { clips, total: count ?? 0 }
    return NextResponse.json(response)

  } catch (err) {
    console.error('[marketplace/clips] unhandled error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
