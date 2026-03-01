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
  transcriptionContent: string
  transcriptionTags: string[]
  signedAudioUrl: string | null
  alreadyClaimed: boolean
  expiresAt: string | null
  expiryLabel: string | null
  initialContent: string
  initialSpeakerTurns: number
}

/**
 * Client-side Translation editor.
 * Step 1: Claim the task (locks it for 24 h).
 * Step 2: Read the source transcription, listen to audio, write the English translation.
 * Step 3: Submit.
 */
export default function TranslationForm({
  taskId,
  audioClipId,
  dialectName,
  dialectCode,
  durationSeconds,
  speakerCount,
  speakerGender,
  transcriptionContent,
  transcriptionTags,
  signedAudioUrl,
  alreadyClaimed,
  expiresAt,
  expiryLabel,
  initialContent,
  initialSpeakerTurns,
}: Props) {
  const router = useRouter()
  const audioRef = useRef<HTMLAudioElement>(null)

  const [claimed, setClaimed]               = useState(alreadyClaimed)
  const [claiming, setClaiming]             = useState(false)
  const [content, setContent]               = useState(initialContent)
  const [spkTurns, setSpkTurns]             = useState(initialSpeakerTurns)
  const [isPlaying, setIsPlaying]           = useState(false)
  const [currentTime, setCurrentTime]       = useState(0)
  const [audioDuration, setAudioDuration]   = useState(durationSeconds)
  const [submitting, setSubmitting]         = useState(false)
  const [error, setError]                   = useState<string | null>(null)
  const [success, setSuccess]               = useState(false)

  /* ── Audio event listeners ─────────────────────────────────────────── */
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

  /* ── Helpers ───────────────────────────────────────────────────────── */
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

  async function handleClaim() {
    setClaiming(true)
    setError(null)
    try {
      const res = await fetch('/api/translation/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to claim task. Please try again.')
        return
      }
      setClaimed(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setClaiming(false)
    }
  }

  async function handleSubmit() {
    if (content.trim().length < 10) {
      setError('Translation is too short. Please provide a complete English translation.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/translation/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          audioClipId,
          content: content.trim(),
          speakerTurns: spkTurns,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Submission failed. Please try again.')
        return
      }
      setSuccess(true)
      setTimeout(() => router.push('/translator'), 1800)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Success screen ─────────────────────────────────────────────────── */
  if (success) {
    return (
      <div className="af-card p-12 text-center max-w-lg mx-auto">
        <div
          className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
          style={{ background: 'var(--af-success-soft, #d1fae5)' }}
        >
          <svg className="h-8 w-8" style={{ color: 'var(--af-success)' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold" style={{ color: 'var(--af-txt)' }}>Translation Submitted!</h3>
        <p className="text-sm mt-2" style={{ color: 'var(--af-muted)' }}>
          Your translation has been submitted and queued for QC review.
        </p>
        <p className="text-xs mt-3" style={{ color: 'var(--af-muted)' }}>Returning to queue…</p>
      </div>
    )
  }

  const progressPct = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0
  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0

  /* ── Claim gate ─────────────────────────────────────────────────────── */
  if (!claimed) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">

        {/* Task info card */}
        <div className="af-card p-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
            Translation Task
          </h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <div>
              <dt style={{ color: 'var(--af-muted)' }}>Dialect</dt>
              <dd className="font-medium mt-0.5" style={{ color: 'var(--af-txt)' }}>{dialectName}</dd>
            </div>
            <div>
              <dt style={{ color: 'var(--af-muted)' }}>Duration</dt>
              <dd className="font-medium mt-0.5" style={{ color: 'var(--af-txt)' }}>{Math.round(durationSeconds)}s</dd>
            </div>
            <div>
              <dt style={{ color: 'var(--af-muted)' }}>Speakers</dt>
              <dd className="font-medium mt-0.5 capitalize" style={{ color: 'var(--af-txt)' }}>
                {speakerCount} · {speakerGender}
              </dd>
            </div>
            <div>
              <dt style={{ color: 'var(--af-muted)' }}>Code</dt>
              <dd className="font-medium mt-0.5 uppercase" style={{ color: 'var(--af-txt)' }}>{dialectCode}</dd>
            </div>
          </dl>
        </div>

        {/* Source transcription preview */}
        {transcriptionContent && (
          <div className="af-card p-6">
            <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--af-txt)' }}>
              Source Transcription Preview
            </h2>
            <div
              className="rounded-xl p-4 text-sm font-mono leading-relaxed whitespace-pre-wrap line-clamp-6"
              style={{
                background: 'var(--af-surface-raised)',
                color:      'var(--af-muted)',
                border:     '1px solid var(--af-border)',
              }}
            >
              {transcriptionContent.slice(0, 300)}{transcriptionContent.length > 300 ? '…' : ''}
            </div>
          </div>
        )}

        {/* Claim info */}
        <div className="af-card p-6">
          <p className="text-sm" style={{ color: 'var(--af-muted)' }}>
            Claiming this task locks it for <strong style={{ color: 'var(--af-txt)' }}>24 hours</strong>.
            Only you can submit a translation during this period. If the task expires uncompleted,
            it returns to the queue automatically.
          </p>
        </div>

        {error && (
          <div
            className="rounded-xl p-4 text-sm border"
            style={{ background: 'var(--af-error-soft, #fee2e2)', borderColor: 'var(--af-error)', color: 'var(--af-error)' }}
          >
            {error}
          </div>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              router.push('/translator')
            }}
            disabled={claiming}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
            className="px-5 py-2.5 rounded-xl text-sm font-medium border transition-all"
            style={{ borderColor: 'var(--af-border)', color: 'var(--af-muted)', background: 'transparent' }}
          >
            ← Back
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              handleClaim()
            }}
            disabled={claiming}
            onMouseEnter={(e) => { if (!claiming) e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
            className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
            style={{
              background: claiming ? 'var(--af-border)' : 'var(--af-primary)',
              color:      claiming ? 'var(--af-muted)' : '#fff',
              cursor:     claiming ? 'not-allowed' : 'pointer',
            }}
          >
            {claiming ? 'Claiming…' : 'Claim Task — Start Translating'}
          </button>
        </div>
      </div>
    )
  }

  /* ── Translation editor ─────────────────────────────────────────────── */
  return (
    <div className="max-w-2xl mx-auto space-y-6">

      {/* Expiry banner */}
      {expiryLabel && (
        <div
          className="af-card px-5 py-3 flex items-center gap-2 text-sm"
          style={{ borderLeft: '3px solid var(--af-primary)' }}
        >
          <svg className="h-4 w-4 shrink-0" style={{ color: 'var(--af-primary)' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
          </svg>
          <span style={{ color: 'var(--af-muted)' }}>
            Task claimed · <strong style={{ color: 'var(--af-txt)' }}>{expiryLabel}</strong>
          </span>
        </div>
      )}

      {/* Clip metadata */}
      <div className="af-card p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
          Clip Details
        </h2>
        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
          <div>
            <dt style={{ color: 'var(--af-muted)' }}>Dialect</dt>
            <dd className="font-medium mt-0.5" style={{ color: 'var(--af-txt)' }}>{dialectName}</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--af-muted)' }}>Duration</dt>
            <dd className="font-medium mt-0.5" style={{ color: 'var(--af-txt)' }}>{Math.round(durationSeconds)}s</dd>
          </div>
          <div>
            <dt style={{ color: 'var(--af-muted)' }}>Speakers</dt>
            <dd className="font-medium mt-0.5 capitalize" style={{ color: 'var(--af-txt)' }}>
              {speakerCount} · {speakerGender}
            </dd>
          </div>
          {transcriptionTags.length > 0 && (
            <div className="col-span-2">
              <dt style={{ color: 'var(--af-muted)' }}>Tags in source</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1">
                {transcriptionTags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-block px-2 py-0.5 rounded text-xs font-mono"
                    style={{ background: 'var(--af-surface-raised)', color: 'var(--af-txt)' }}
                  >
                    {tag}
                  </span>
                ))}
              </dd>
            </div>
          )}
        </dl>
      </div>

      {/* Audio player */}
      <div className="af-card p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
          Audio Playback
        </h2>
        {signedAudioUrl ? (
          <>
            <audio ref={audioRef} src={signedAudioUrl} preload="metadata" />
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  e.stopPropagation()
                  togglePlay()
                }}
                disabled={submitting}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-transform"
                style={{ background: 'var(--af-primary)', color: '#fff' }}
                aria-label={isPlaying ? 'Pause audio' : 'Play audio'}
              >
                {isPlaying ? (
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M5.75 3a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75A.75.75 0 0 0 7.25 3h-1.5zm6.5 0a.75.75 0 0 0-.75.75v12.5c0 .414.336.75.75.75h1.5a.75.75 0 0 0 .75-.75V3.75a.75.75 0 0 0-.75-.75h-1.5z" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M6.3 2.841A1.5 1.5 0 0 0 4 4.11V15.89a1.5 1.5 0 0 0 2.3 1.269l9.344-5.89a1.5 1.5 0 0 0 0-2.538L6.3 2.84z" />
                  </svg>
                )}
              </button>
              <div className="flex-1">
                <div className="relative h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--af-border)' }}>
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{ width: `${progressPct}%`, background: 'var(--af-primary)' }}
                  />
                </div>
                <div className="flex justify-between text-xs mt-1" style={{ color: 'var(--af-muted)' }}>
                  <span>{formatTime(currentTime)}</span>
                  <span>{formatTime(audioDuration || durationSeconds)}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <p className="text-sm" style={{ color: 'var(--af-muted)' }}>Audio preview unavailable.</p>
        )}
      </div>

      {/* Source transcription (read-only) */}
      <div className="af-card p-6">
        <h2 className="text-lg font-semibold mb-3" style={{ color: 'var(--af-txt)' }}>
          Source Transcription
          <span className="ml-2 text-xs font-normal" style={{ color: 'var(--af-muted)' }}>({dialectName} · read-only)</span>
        </h2>
        {transcriptionContent ? (
          <div
            className="rounded-xl p-4 text-sm font-mono leading-relaxed whitespace-pre-wrap"
            style={{
              background: 'var(--af-surface-raised)',
              color:      'var(--af-txt)',
              minHeight:  '100px',
              border:     '1px solid var(--af-border)',
            }}
          >
            {transcriptionContent}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--af-muted)' }}>
            No transcription found for this clip.
          </p>
        )}
      </div>

      {/* Translation textarea */}
      <div className="af-card p-6">
        <label className="block text-lg font-semibold mb-1" style={{ color: 'var(--af-txt)' }}>
          English Translation <span style={{ color: 'var(--af-error)' }}>*</span>
        </label>
        <p className="text-xs mb-3" style={{ color: 'var(--af-muted)' }}>
          Write a faithful English translation. Preserve speaker labels (S1:, S2:) and non-speech tags.
        </p>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="S1: Type the English translation here…&#10;S2: Continue with additional speaker turns as needed."
          rows={10}
          disabled={submitting}
          className="w-full rounded-xl px-4 py-3 text-sm font-mono leading-relaxed resize-y border focus:outline-none focus:ring-2 transition-all"
          style={{
            background:  'var(--af-surface)',
            borderColor: 'var(--af-border)',
            color:       'var(--af-txt)',
            minHeight:   '200px',
          }}
        />
        <p className="text-xs mt-1 text-right" style={{ color: 'var(--af-muted)' }}>
          {wordCount} {wordCount === 1 ? 'word' : 'words'}
        </p>
      </div>

      {/* Speaker turns */}
      <div className="af-card p-6">
        <label className="block text-sm font-medium mb-2" style={{ color: 'var(--af-txt)' }}>
          Speaker Turns in Translation
        </label>
        <input
          type="number"
          min={1}
          max={50}
          value={spkTurns}
          onChange={(e) => setSpkTurns(Math.max(1, parseInt(e.target.value) || 1))}
          disabled={submitting}
          className="w-32 rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 transition-all"
          style={{
            background:  'var(--af-surface)',
            borderColor: 'var(--af-border)',
            color:       'var(--af-txt)',
          }}
        />
        <p className="text-xs mt-1.5" style={{ color: 'var(--af-muted)' }}>
          Total number of speaker turns in your English translation.
        </p>
      </div>

      {/* Error */}
      {error && (
        <div
          className="rounded-xl p-4 text-sm border"
          style={{
            background:  'var(--af-error-soft, #fee2e2)',
            borderColor: 'var(--af-error)',
            color:       'var(--af-error)',
          }}
        >
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            router.push('/translator')
          }}
          disabled={submitting}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
          className="px-5 py-2.5 rounded-xl text-sm font-medium border transition-all"
          style={{ borderColor: 'var(--af-border)', color: 'var(--af-muted)', background: 'transparent' }}
        >
          ← Back to Queue
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            handleSubmit()
          }}
          disabled={submitting || content.trim().length < 10}
          onMouseEnter={(e) => {
            if (!submitting && content.trim().length >= 10) e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: submitting || content.trim().length < 10
              ? 'var(--af-border)'
              : 'var(--af-primary)',
            color:  submitting || content.trim().length < 10 ? 'var(--af-muted)' : '#fff',
            cursor: submitting || content.trim().length < 10 ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? 'Submitting…' : 'Submit Translation'}
        </button>
      </div>
    </div>
  )
}
