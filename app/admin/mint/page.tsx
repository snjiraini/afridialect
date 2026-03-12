/**
 * Admin NFT Minting Queue — /admin/mint
 *
 * Shows all clips in `mint_ready` status.
 * Admin can trigger minting for each clip individually.
 * Also shows recently minted clips.
 */
export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/layouts/Topbar'
import MintQueueClient from './MintQueueClient'

export default async function AdminMintPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const admin = await createAdminClient()

  // Require admin role
  const { data: roleRow } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'admin')
    .single()

  if (!roleRow) {
    return (
      <>
        <Topbar title="NFT Minting" subtitle="Admin-only — mint NFTs for approved clips" />
        <div className="container-modern py-8">
          <div
            className="af-card p-6 border-l-4"
            style={{ borderColor: 'var(--af-danger)' }}
          >
            <h3 className="font-semibold mb-1" style={{ color: 'var(--af-txt)' }}>
              Access Denied
            </h3>
            <p className="text-sm" style={{ color: 'var(--af-muted)' }}>
              You need the <strong>admin</strong> role to access this page.
            </p>
          </div>
        </div>
      </>
    )
  }

  // ── Fetch mint_ready clips with contributor info ───────────────────────
  const { data: rawClips } = await admin
    .from('audio_clips')
    .select(`
      id,
      status,
      duration_seconds,
      created_at,
      uploader_id,
      dialects ( name, code )
    `)
    .eq('status', 'mint_ready')
    .order('created_at', { ascending: true })
    .limit(100)

  // Fetch transcriptions (for transcriber_id)
  const clipIds = (rawClips ?? []).map((c) => c.id)

  const { data: transcriptions } = clipIds.length
    ? await admin
        .from('transcriptions')
        .select('audio_clip_id, transcriber_id')
        .in('audio_clip_id', clipIds)
    : { data: [] }

  const { data: translations } = clipIds.length
    ? await admin
        .from('translations')
        .select('audio_clip_id, translator_id')
        .in('audio_clip_id', clipIds)
    : { data: [] }

  // Build maps for lookups
  const transcriptionMap: Record<string, string> = {}
  for (const t of transcriptions ?? []) {
    transcriptionMap[t.audio_clip_id] = t.transcriber_id
  }

  const translationMap: Record<string, string> = {}
  for (const t of translations ?? []) {
    translationMap[t.audio_clip_id] = t.translator_id
  }

  // Collect all unique contributor IDs
  const allContributorIds = new Set<string>()
  for (const c of rawClips ?? []) {
    allContributorIds.add(c.uploader_id)
    const transId = transcriptionMap[c.id]
    const translaId = translationMap[c.id]
    if (transId) allContributorIds.add(transId)
    if (translaId) allContributorIds.add(translaId)
  }

  const { data: profiles } = allContributorIds.size
    ? await admin
        .from('profiles')
        .select('id, email, full_name, hedera_account_id')
        .in('id', [...allContributorIds])
    : { data: [] }

  const profileMap: Record<string, { name: string; hasAccount: boolean }> = {}
  for (const p of profiles ?? []) {
    profileMap[p.id] = {
      name: p.full_name ?? p.email ?? p.id,
      hasAccount: !!p.hedera_account_id,
    }
  }

  // Shape the clips for the client component
  const clips = (rawClips ?? []).map((c) => {
    // @ts-ignore — Supabase join typing
    const dialectRaw = c.dialects
    const dialect = Array.isArray(dialectRaw) ? dialectRaw[0] : dialectRaw

    const transId = transcriptionMap[c.id] ?? ''
    const translaId = translationMap[c.id] ?? ''

    return {
      id: c.id,
      status: c.status,
      duration_seconds: c.duration_seconds,
      created_at: c.created_at,
      dialectName: dialect?.name ?? 'Unknown',
      uploaderName: profileMap[c.uploader_id]?.name ?? c.uploader_id,
      transcriberName: profileMap[transId]?.name ?? (transId ? transId : '(none)'),
      translatorName: profileMap[translaId]?.name ?? (translaId ? translaId : '(none)'),
      uploaderHasAccount: profileMap[c.uploader_id]?.hasAccount ?? false,
      transcriberHasAccount: profileMap[transId]?.hasAccount ?? false,
      translatorHasAccount: profileMap[translaId]?.hasAccount ?? false,
    }
  })

  // ── Fetch recently minted clips ────────────────────────────────────────
  const { data: recentlyMinted } = await admin
    .from('nft_records')
    .select(`
      id,
      nft_type,
      token_id,
      minted_at,
      audio_clip_id,
      audio_clips ( dialects ( name ) )
    `)
    .order('minted_at', { ascending: false })
    .limit(30)

  // Group by clip id — show 3 tokens per clip
  const mintedByClip: Record<string, { dialectName: string; mintedAt: string; tokens: { type: string; tokenId: string }[] }> = {}
  for (const r of recentlyMinted ?? []) {
    if (!mintedByClip[r.audio_clip_id]) {
      // @ts-ignore
      const clipDialect = Array.isArray(r.audio_clips?.dialects)
        // @ts-ignore
        ? r.audio_clips.dialects[0]
        // @ts-ignore
        : r.audio_clips?.dialects
      mintedByClip[r.audio_clip_id] = {
        dialectName: clipDialect?.name ?? 'Unknown',
        mintedAt: r.minted_at,
        tokens: [],
      }
    }
    mintedByClip[r.audio_clip_id].tokens.push({ type: r.nft_type, tokenId: r.token_id })
  }

  const recentMintedClips = Object.entries(mintedByClip).slice(0, 10)

  return (
    <>
      <Topbar
        title="NFT Minting Queue"
        subtitle="Mint NFTs for all translation-QC approved clips"
      />
      <div className="container-modern py-8">
        {/* Back to admin link */}
        <div className="mb-6">
          <Link
            href="/admin"
            className="text-sm flex items-center gap-1.5 w-fit"
            style={{ color: 'var(--af-primary)' }}
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z"
                clipRule="evenodd"
              />
            </svg>
            Back to Admin
          </Link>
        </div>

        {/* Stats bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
          {(
            [
              { label: 'Awaiting Mint', value: clips.length, icon: '⬡' },
              {
                label: 'Ready to Mint',
                value: clips.filter(
                  (c) =>
                    c.uploaderHasAccount &&
                    c.transcriberHasAccount &&
                    c.translatorHasAccount
                ).length,
                icon: '✅',
              },
              {
                label: 'Blocked (missing accounts)',
                value: clips.filter(
                  (c) =>
                    !c.uploaderHasAccount ||
                    !c.transcriberHasAccount ||
                    !c.translatorHasAccount
                ).length,
                icon: '⚠️',
              },
              {
                label: 'Recently Minted (clips)',
                value: recentMintedClips.length,
                icon: '🪙',
              },
            ] as { label: string; value: number; icon: string }[]
          ).map((s) => (
            <div key={s.label} className="af-card p-5">
              <div className="text-2xl mb-2">{s.icon}</div>
              <div
                className="text-xl font-bold mb-1"
                style={{ color: 'var(--af-txt)' }}
              >
                {s.value}
              </div>
              <div className="text-xs" style={{ color: 'var(--af-muted)' }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* Info card */}
        <div
          className="af-card p-5 mb-8 text-sm"
          style={{ borderLeft: '4px solid var(--af-primary)' }}
        >
          <h3
            className="font-semibold mb-2"
            style={{ color: 'var(--af-txt)' }}
          >
            How minting works
          </h3>
          <ul
            className="space-y-1 text-sm list-disc list-inside"
            style={{ color: 'var(--af-muted)' }}
          >
            <li>
              Each clip gets <strong>3 HTS token collections</strong> — audio, transcript,
              translation.
            </li>
            <li>
              <strong>300 NFTs</strong> are minted per collection and transferred to the
              contributor's Hedera account.
            </li>
            <li>
              Audio is pinned to <strong>IPFS via Pinata</strong> before minting.
            </li>
            <li>All three contributors must have Hedera accounts before minting can proceed.</li>
            <li>Minting is irreversible — only trigger for fully approved clips.</li>
          </ul>
        </div>

        {/* Queue */}
        <h2
          className="text-base font-semibold mb-4"
          style={{ color: 'var(--af-txt)' }}
        >
          Mint-Ready Queue ({clips.length})
        </h2>
        <MintQueueClient clips={clips} />

        {/* Recently minted */}
        {recentMintedClips.length > 0 && (
          <div className="mt-10">
            <h2
              className="text-base font-semibold mb-4"
              style={{ color: 'var(--af-txt)' }}
            >
              Recently Minted
            </h2>
            <div className="space-y-3">
              {recentMintedClips.map(([clipId, info]) => (
                <div key={clipId} className="af-card p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: 'var(--af-primary-light)',
                        color: 'var(--af-primary)',
                      }}
                    >
                      {info.dialectName}
                    </span>
                    <span
                      className="text-xs font-mono"
                      style={{ color: 'var(--af-muted)' }}
                    >
                      {clipId}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--af-muted)' }}>
                      ·{' '}
                      {new Date(info.mintedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {info.tokens.map((t) => (
                      <a
                        key={t.type}
                        href={`https://hashscan.io/testnet/token/${t.tokenId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs underline font-mono"
                        style={{ color: 'var(--af-primary)' }}
                      >
                        {t.type}: {t.tokenId}
                      </a>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </>
  )
}
