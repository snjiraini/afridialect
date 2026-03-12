'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  taskId: string
  audioClipId: string
  dialectName: string
  dialectCode: string
  durationSeconds: number
  speakerCount: number
  speakerGender: string
  speakerAgeRange: string
  description: string
  signedAudioUrl: string | null
  alreadyClaimed: boolean
  expiresAt: string | null
  expiryLabel: string | null
  initialContent: string
  initialSpeakerCount: number
  initialSpeakerTurns: number
  initialTags: string[]
}

const AVAILABLE_TAGS = [
  { value: '[laughter]',  label: '[laughter]' },
  { value: '[silence]',   label: '[silence]' },
  { value: '[noise]',     label: '[noise]' },
  { value: '[inaudible]', label: '[inaudible]' },
  { value: '[breath]',    label: '[breath]' },
  { value: '[music]',     label: '[music]' },
]

/**
 * Client-side Transcription editor.
 * Step 1: Claim the task (locks it for 24 h).
 * Step 2: Write the verbatim transcription, then submit.
 */
export default function TranscriptionForm({
  taskId,
  audioClipId,
  dialectName,
  dialectCode,
  durationSeconds,
  speakerCount,
  speakerGender,
  speakerAgeRange,
  description,
  signedAudioUrl,
  alreadyClaimed,
  expiresAt,
  expiryLabel,
  initialContent,
  initialSpeakerCount,
  initialSpeakerTurns,
  initialTags,
}: Props) {
  const router = useRouter()
  const audioRef = useRef<HTMLAudioElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [claimed, setClaimed]           = useState(alreadyClaimed)
  const [claiming, setClaiming]         = useState(false)
  const [content, setContent]           = useState(initialContent)
  const [spkCount, setSpkCount]         = useState(initialSpeakerCount)
  const [spkTurns, setSpkTurns]         = useState(initialSpeakerTurns)
  const [usedTags, setUsedTags]         = useState<string[]>(initialTags)
  const [isPlaying, setIsPlaying]       = useState(false)
  const [currentTime, setCurrentTime]   = useState(0)
  const [audioDuration, setAudioDuration] = useState(durationSeconds)
  const [submitting, setSubmitting]     = useState(false)
  const [error, setError]               = useState<string | null>(null)
  const [success, setSuccess]           = useState(false)

  /* ── Audio event listeners ────────────────────────────────────────────── */
  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime  = () => setCurrentTime(el.currentTime)
    const onMeta  = () => setAudioDuration(el.duration || durationSeconds)
    const onEnded = () => setIsPlaying(false)
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('ended', onEnded)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('ended', onEnded)
    }
  }, [durationSeconds])

  /* ── Helpers ──────────────────────────────────────────────────────────── */
  function formatTime(secs: number): string {
    const m = Math.floor(secs / 60)
    const s = Math.floor(secs % 60)
    return `${m}:${s.toString().padStart(2, '0')}`
  }

  function togglePlay() {
    const el = audioRef.current
    if (!el) return
    if (isPlaying) { el.pause() } else { el.play() }
    setIsPlaying(!isPlaying)
  }

  function seekTo(e: React.MouseEvent<HTMLDivElement>) {
    const el = audioRef.current
    if (!el || !audioDuration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    el.currentTime = ratio * audioDuration
  }

  function insertTag(tag: string) {
    const el = textareaRef.current
    if (!el) {
      setContent((prev) => prev + ' ' + tag)
      return
    }
    const start = el.selectionStart
    const end   = el.selectionEnd
    const next  = content.slice(0, start) + ' ' + tag + ' ' + content.slice(end)
    setContent(next)
    // Keep used tags list in sync
    if (!usedTags.includes(tag)) setUsedTags((prev) => [...prev, tag])
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + tag.length + 2, start + tag.length + 2)
    }, 0)
  }

  /* ── Claim ────────────────────────────────────────────────────────────── */
  async function handleClaim() {
    setClaiming(true)
    setError(null)
    try {
      const res = await fetch('/api/transcription/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to claim task')
        return
      }
      setClaimed(true)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setClaiming(false)
    }
  }

  /* ── Submit ───────────────────────────────────────────────────────────── */
  async function handleSubmit() {
    setError(null)
    if (!content.trim()) {
      setError('Transcription content cannot be empty.')
      return
    }
    if (content.trim().length < 10) {
      setError('Transcription is too short. Please provide a complete verbatim transcription.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/transcription/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          audioClipId,
          content: content.trim(),
          speakerCount: spkCount,
          speakerTurns: spkTurns,
          tags: usedTags,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Submission failed')
        return
      }
      setSuccess(true)
      setTimeout(() => router.push('/transcriber'), 2000)
    } catch {
      setError('Network error — please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Success state ────────────────────────────────────────────────────── */
  if (success) {
    return (
      <div className="af-card p-12 text-center max-w-lg mx-auto">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--af-txt)' }}>
          Transcription Submitted!
        </h2>
        <p className="text-sm" style={{ color: 'var(--af-muted)' }}>
          Your transcription has been submitted for QC review. Redirecting to the queue…
        </p>
      </div>
    )
  }

  const progressPercent = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0

  return (
    <div className="space-y-6">

      {/* Clip metadata */}
      <div className="af-card p-5">
        <div className="flex items-center gap-3 flex-wrap">
          <span
            className="inline-flex items-center px-2.5 py-1 rounded text-xs font-semibold"
            style={{ background: 'var(--af-accent-soft)', color: 'var(--af-primary)' }}
          >
            {dialectName} {dialectCode ? `(${dialectCode})` : ''}
          </span>
          <span
            className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium"
            style={{ background: 'var(--af-surface-raised)', color: 'var(--af-muted)' }}
          >
            {Math.floor(durationSeconds / 60) > 0
              ? `${Math.floor(durationSeconds / 60)}m ${Math.round(durationSeconds % 60)}s`
              : `${Math.round(durationSeconds)}s`}
          </span>
          {speakerCount > 1 && (
            <span
              className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium"
              style={{ background: 'var(--af-surface-raised)', color: 'var(--af-muted)' }}
            >
              {speakerCount} speakers
            </span>
          )}
          {speakerGender && speakerGender !== 'unknown' && (
            <span
              className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium capitalize"
              style={{ background: 'var(--af-surface-raised)', color: 'var(--af-muted)' }}
            >
              {speakerGender}
            </span>
          )}
          {claimed && expiryLabel && (
            <span
              className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium ml-auto"
              style={{ background: 'rgba(245,181,93,0.15)', color: '#f5b55d' }}
            >
              ⏱ {expiryLabel}
            </span>
          )}
        </div>
        {description && (
          <p className="text-sm mt-3" style={{ color: 'var(--af-muted)' }}>
            {description}
          </p>
        )}
      </div>

      {/* Audio player */}
      <div className="af-card p-5">
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
          Audio Playback
        </h3>

        {signedAudioUrl ? (
          <>
            {/* Hidden native audio element */}
            <audio ref={audioRef} src={signedAudioUrl} preload="metadata" />

            {/* Custom player */}
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); togglePlay() }}
                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 transition-opacity hover:opacity-80"
                style={{ background: 'var(--af-primary)' }}
                aria-label={isPlaying ? 'Pause' : 'Play'}
              >
                {isPlaying ? (
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
                  </svg>
                )}
              </button>

              <div className="flex-1 space-y-1">
                {/* Seek bar */}
                <div
                  className="h-2 rounded-full cursor-pointer overflow-hidden"
                  style={{ background: 'var(--af-line)' }}
                  onClick={seekTo}
                >
                  <div
                    className="h-full rounded-full transition-all duration-100"
                    style={{ width: `${progressPercent}%`, background: 'var(--af-primary)' }}
                  />
                </div>
                <div className="flex justify-between text-xs" style={{ color: 'var(--af-muted)' }}>
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(audioDuration)}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="rounded-lg p-4 text-center text-sm" style={{ background: 'var(--af-line)', color: 'var(--af-muted)' }}>
            Audio playback unavailable — the signed URL could not be generated.
          </div>
        )}
      </div>

      {/* Claim gate */}
      {!claimed ? (
        <div className="af-card p-6 text-center">
          <p className="text-sm mb-4" style={{ color: 'var(--af-muted)' }}>
            Claim this task to lock it for <strong>24 hours</strong> and start transcribing.
            The task will be automatically released if not submitted in time.
          </p>
          {error && (
            <p className="text-sm mb-3" style={{ color: 'var(--af-danger)' }}>{error}</p>
          )}
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleClaim() }}
            disabled={claiming}
            className="btn-primary px-6 py-2.5 rounded-lg font-medium text-sm disabled:opacity-60"
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
          >
            {claiming ? 'Claiming…' : '📝 Claim This Task'}
          </button>
        </div>
      ) : (
        <>
          {/* Transcription editor */}
          <div className="af-card p-5">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <h3 className="text-sm font-semibold" style={{ color: 'var(--af-txt)' }}>
                Verbatim Transcription
              </h3>
              <span className="text-xs" style={{ color: 'var(--af-muted)' }}>
                {content.length} characters
              </span>
            </div>

            {/* Tag insertion shortcuts */}
            <div className="flex flex-wrap gap-2 mb-3">
              {AVAILABLE_TAGS.map((tag) => (
                <button
                  key={tag.value}
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); insertTag(tag.value) }}
                  className="px-2 py-0.5 rounded text-xs font-mono transition-opacity hover:opacity-70"
                  style={{ background: 'var(--af-accent-soft)', color: 'var(--af-primary)' }}
                  title={`Insert ${tag.value}`}
                >
                  {tag.label}
                </button>
              ))}
            </div>

            <textarea
              ref={textareaRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={10}
              placeholder={`Write a verbatim transcription in ${dialectName}.\n\nFor multiple speakers, use:\nS1: First speaker text\nS2: Second speaker text\n\nInsert tags using the buttons above for [laughter], [silence], etc.`}
              className="w-full rounded-lg p-3 text-sm font-mono resize-y focus:outline-none"
              style={{
                background: 'var(--af-search-bg)',
                color: 'var(--af-txt)',
                border: '1px solid var(--af-line)',
                minHeight: '200px',
              }}
            />
          </div>

          {/* Speaker metadata */}
          <div className="af-card p-5">
            <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
              Speaker Details
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--af-muted)' }}>
                  Speaker count
                </label>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={spkCount}
                  onChange={(e) => setSpkCount(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{
                    background: 'var(--af-search-bg)',
                    color: 'var(--af-txt)',
                    border: '1px solid var(--af-line)',
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--af-muted)' }}>
                  Speaker turns
                </label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={spkTurns}
                  onChange={(e) => setSpkTurns(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
                  style={{
                    background: 'var(--af-search-bg)',
                    color: 'var(--af-txt)',
                    border: '1px solid var(--af-line)',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="af-card p-4 border-l-4"
              style={{ borderColor: 'var(--af-danger)' }}
            >
              <p className="text-sm" style={{ color: 'var(--af-danger)' }}>{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="af-card p-5 flex items-center justify-between flex-wrap gap-4">
            <p className="text-xs" style={{ color: 'var(--af-muted)' }}>
              Once submitted, your transcription goes to a QC reviewer.
            </p>
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleSubmit() }}
              disabled={submitting || !content.trim()}
              className="btn-primary px-6 py-2.5 rounded-lg font-medium text-sm disabled:opacity-60 transition-all"
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
            >
              {submitting ? 'Submitting…' : 'Submit Transcription →'}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
