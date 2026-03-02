'use client'

import { useState } from 'react'

interface Clip {
  id: string
  status: string
  duration_seconds: number
  created_at: string
  dialectName: string
  uploaderName: string
  transcriberName: string
  translatorName: string
  uploaderHasAccount: boolean
  transcriberHasAccount: boolean
  translatorHasAccount: boolean
}

interface MintResult {
  success?: boolean
  warning?: string
  error?: string
  audioCid?: string
  audioToken?: { tokenId: string; serialNumbers: number[] }
  transcriptToken?: { tokenId: string; serialNumbers: number[] }
  translationToken?: { tokenId: string; serialNumbers: number[] }
}

interface Props {
  clips: Clip[]
}

export default function MintQueueClient({ clips }: Props) {
  const [minting, setMinting] = useState<string | null>(null)
  const [results, setResults] = useState<Record<string, MintResult>>({})
  const [mintedIds, setMintedIds] = useState<Set<string>>(new Set())

  async function handleMint(clipId: string) {
    setMinting(clipId)
    setResults((prev) => {
      const next = { ...prev }
      delete next[clipId]
      return next
    })

    try {
      const response = await fetch('/api/hedera/mint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clipId }),
      })

      const data: MintResult = await response.json()
      setResults((prev) => ({ ...prev, [clipId]: data }))

      if (data.success) {
        setMintedIds((prev) => new Set([...prev, clipId]))
      }
    } catch (err) {
      setResults((prev) => ({
        ...prev,
        [clipId]: { error: err instanceof Error ? err.message : 'Network error' },
      }))
    } finally {
      setMinting(null)
    }
  }

  const visibleClips = clips.filter((c) => !mintedIds.has(c.id))

  if (visibleClips.length === 0) {
    return (
      <div
        className="af-card p-10 text-center"
        style={{ color: 'var(--af-muted)' }}
      >
        <div className="text-4xl mb-3">🎉</div>
        <p className="font-semibold" style={{ color: 'var(--af-txt)' }}>
          No clips awaiting minting
        </p>
        <p className="text-sm mt-1">All mint-ready clips have been processed.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {visibleClips.map((clip) => {
        const result = results[clip.id]
        const isMinting = minting === clip.id
        const canMint =
          clip.uploaderHasAccount &&
          clip.transcriberHasAccount &&
          clip.translatorHasAccount

        const durationMin = Math.floor(clip.duration_seconds / 60)
        const durationSec = Math.round(clip.duration_seconds % 60)
        const durationLabel =
          durationMin > 0 ? `${durationMin}m ${durationSec}s` : `${durationSec}s`

        const queuedAt = new Date(clip.created_at).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        })

        return (
          <div key={clip.id} className="af-card p-5">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              {/* Left: clip info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: 'var(--af-primary-light)', color: 'var(--af-primary)' }}
                  >
                    {clip.dialectName}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--af-muted)' }}>
                    {durationLabel}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--af-muted)' }}>
                    · {queuedAt}
                  </span>
                </div>

                <p
                  className="text-xs font-mono truncate mb-3"
                  style={{ color: 'var(--af-muted)' }}
                >
                  {clip.id}
                </p>

                {/* Contributor row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                  {(
                    [
                      {
                        label: '🎙️ Uploader',
                        name: clip.uploaderName,
                        hasAccount: clip.uploaderHasAccount,
                      },
                      {
                        label: '📝 Transcriber',
                        name: clip.transcriberName,
                        hasAccount: clip.transcriberHasAccount,
                      },
                      {
                        label: '🌐 Translator',
                        name: clip.translatorName,
                        hasAccount: clip.translatorHasAccount,
                      },
                    ] as { label: string; name: string; hasAccount: boolean }[]
                  ).map((c) => (
                    <div
                      key={c.label}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-lg"
                      style={{ background: 'var(--af-search-bg)' }}
                    >
                      <span>{c.label}:</span>
                      <span
                        className="font-medium truncate"
                        style={{ color: 'var(--af-txt)' }}
                      >
                        {c.name}
                      </span>
                      <span
                        title={c.hasAccount ? 'Has Hedera account' : 'Missing Hedera account'}
                      >
                        {c.hasAccount ? '✅' : '⚠️'}
                      </span>
                    </div>
                  ))}
                </div>

                {!canMint && (
                  <p
                    className="text-xs mt-2"
                    style={{ color: 'var(--af-warning)' }}
                  >
                    ⚠️ One or more contributors are missing a Hedera account. Minting is
                    blocked until all contributors have accounts.
                  </p>
                )}
              </div>

              {/* Right: mint button */}
              <div className="flex flex-col items-end gap-2 shrink-0">
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    handleMint(clip.id)
                  }}
                  disabled={isMinting || !canMint}
                  className="btn-primary text-sm px-5 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  onMouseEnter={(e) => {
                    if (!isMinting && canMint)
                      e.currentTarget.style.transform = 'translateY(-2px)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = ''
                  }}
                >
                  {isMinting ? (
                    <span className="flex items-center gap-2">
                      <svg
                        className="animate-spin h-3.5 w-3.5"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        />
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8v8H4z"
                        />
                      </svg>
                      Minting…
                    </span>
                  ) : (
                    '⬡ Mint NFTs'
                  )}
                </button>
              </div>
            </div>

            {/* Result block */}
            {result && (
              <div
                className="mt-4 rounded-xl p-4 text-xs"
                style={{
                  background: result.success
                    ? '#f0fdf4'
                    : result.warning
                    ? '#fffbeb'
                    : '#fef2f2',
                  color: result.success
                    ? '#166534'
                    : result.warning
                    ? '#92400e'
                    : '#991b1b',
                }}
              >
                {result.success && (
                  <>
                    <p className="font-semibold mb-2">✅ Minted successfully!</p>
                    <p>
                      Audio token:{' '}
                      <a
                        href={`https://hashscan.io/testnet/token/${result.audioToken?.tokenId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-mono"
                      >
                        {result.audioToken?.tokenId}
                      </a>{' '}
                      ({result.audioToken?.serialNumbers?.length ?? 0} serials)
                    </p>
                    <p>
                      Transcript token:{' '}
                      <a
                        href={`https://hashscan.io/testnet/token/${result.transcriptToken?.tokenId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-mono"
                      >
                        {result.transcriptToken?.tokenId}
                      </a>{' '}
                      ({result.transcriptToken?.serialNumbers?.length ?? 0} serials)
                    </p>
                    <p>
                      Translation token:{' '}
                      <a
                        href={`https://hashscan.io/testnet/token/${result.translationToken?.tokenId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-mono"
                      >
                        {result.translationToken?.tokenId}
                      </a>{' '}
                      ({result.translationToken?.serialNumbers?.length ?? 0} serials)
                    </p>
                    <p className="mt-1">
                      Audio IPFS:{' '}
                      <a
                        href={`https://ipfs.io/ipfs/${result.audioCid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline font-mono"
                      >
                        {result.audioCid}
                      </a>
                    </p>
                  </>
                )}
                {result.warning && (
                  <p>
                    ⚠️ {result.warning}
                  </p>
                )}
                {result.error && (
                  <p>
                    ❌ {result.error}
                  </p>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
