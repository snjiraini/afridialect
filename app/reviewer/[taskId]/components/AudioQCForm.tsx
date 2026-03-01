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
}

const REJECTION_REASONS: { value: string; label: string }[] = [
  { value: 'background_noise',            label: 'Excessive background noise' },
  { value: 'too_short',                   label: 'Recording too short (< 30 s)' },
  { value: 'clipping_distortion',         label: 'Audio clipping / distortion' },
  { value: 'wrong_dialect',              label: 'Wrong dialect submitted' },
  { value: 'multiple_speakers_unlabelled', label: 'Multiple speakers, unlabelled' },
  { value: 'inaudible_content',           label: 'Content is inaudible' },
  { value: 'offensive_content',           label: 'Offensive / harmful content' },
  { value: 'not_speech',                  label: 'Not speech (music, noise, etc.)' },
  { value: 'poor_recording_quality',      label: 'Poor overall recording quality' },
  { value: 'other',                       label: 'Other (describe in notes)' },
]

/**
 * Client-side Audio QC form.
 * Reviewer listens to the clip, selects approve or reject, and submits.
 */
export default function AudioQCForm({
  taskId,
  dialectName,
  dialectCode,
  durationSeconds,
  speakerCount,
  speakerGender,
  speakerAgeRange,
  description,
  signedAudioUrl,
}: Props) {
  const router = useRouter()
  const audioRef = useRef<HTMLAudioElement>(null)

  const [isPlaying, setIsPlaying]     = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [decision, setDecision]       = useState<'approve' | 'reject' | null>(null)
  const [reasons, setReasons]         = useState<string[]>([])
  const [notes, setNotes]             = useState('')
  const [submitting, setSubmitting]   = useState(false)
  const [error, setError]             = useState<string | null>(null)
  const [success, setSuccess]         = useState(false)

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

  function toggleReason(value: string) {
    setReasons((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]
    )
  }

  async function handleSubmit() {
    if (!decision) return
    if (decision === 'reject' && reasons.length === 0) {
      setError('Please select at least one rejection reason.')
      return
    }
    setSubmitting(true)
    setError(null)

    try {
      const res = await fetch('/api/audio-qc/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId, decision, reasons, notes }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Submission failed. Please try again.')
        return
      }
      setSuccess(true)
      setTimeout(() => router.push('/reviewer'), 1800)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Success screen ───────────────────────────────────────────────────── */
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
        <h3 className="text-lg font-semibold" style={{ color: 'var(--af-txt)' }}>
          {decision === 'approve' ? 'Clip Approved' : 'Clip Rejected'}
        </h3>
        <p className="text-sm mt-2" style={{ color: 'var(--af-muted)' }}>
          {decision === 'approve'
            ? 'The clip has been queued for transcription.'
            : 'The clip has been rejected and removed from the pipeline.'}
        </p>
        <p className="text-xs mt-3" style={{ color: 'var(--af-muted)' }}>Returning to queue…</p>
      </div>
    )
  }

  const progressPct = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* ── Clip metadata ────────────────────────────────────────────── */}
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
              {speakerCount} · {speakerGender} · {speakerAgeRange}
            </dd>
          </div>
          <div>
            <dt style={{ color: 'var(--af-muted)' }}>Code</dt>
            <dd className="font-medium mt-0.5 uppercase" style={{ color: 'var(--af-txt)' }}>{dialectCode}</dd>
          </div>
          {description && (
            <div className="col-span-2">
              <dt style={{ color: 'var(--af-muted)' }}>Description</dt>
              <dd className="mt-0.5" style={{ color: 'var(--af-txt)' }}>{description}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* ── Audio player ─────────────────────────────────────────────── */}
      <div className="af-card p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
          Audio Playback
        </h2>

        {signedAudioUrl ? (
          <>
            {/* Hidden HTML5 audio element */}
            <audio ref={audioRef} src={signedAudioUrl} preload="metadata" />

            {/* Play / Pause button */}
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

              {/* Scrubber + time */}
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
          <p className="text-sm" style={{ color: 'var(--af-muted)' }}>
            Audio preview is unavailable. The signed URL could not be generated.
          </p>
        )}
      </div>

      {/* ── Decision ─────────────────────────────────────────────────── */}
      <div className="af-card p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
          Your Decision
        </h2>

        <div className="flex gap-3">
          {/* Approve button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDecision('approve')
              setReasons([])
            }}
            disabled={submitting}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold border-2 transition-all"
            style={{
              borderColor: decision === 'approve' ? 'var(--af-success)' : 'var(--af-border)',
              background:  decision === 'approve' ? 'var(--af-success-soft, #d1fae5)' : 'transparent',
              color:       decision === 'approve' ? 'var(--af-success)' : 'var(--af-muted)',
            }}
          >
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
            </svg>
            Approve
          </button>

          {/* Reject button */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setDecision('reject')
            }}
            disabled={submitting}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold border-2 transition-all"
            style={{
              borderColor: decision === 'reject' ? 'var(--af-error)' : 'var(--af-border)',
              background:  decision === 'reject' ? 'var(--af-error-soft, #fee2e2)' : 'transparent',
              color:       decision === 'reject' ? 'var(--af-error)' : 'var(--af-muted)',
            }}
          >
            <svg className="h-4 w-4" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
            </svg>
            Reject
          </button>
        </div>
      </div>

      {/* ── Rejection reasons (only when rejecting) ───────────────────── */}
      {decision === 'reject' && (
        <div className="af-card p-6">
          <h2 className="text-lg font-semibold mb-1" style={{ color: 'var(--af-txt)' }}>
            Rejection Reasons <span style={{ color: 'var(--af-error)' }}>*</span>
          </h2>
          <p className="text-xs mb-4" style={{ color: 'var(--af-muted)' }}>
            Select all that apply.
          </p>

          <div className="space-y-2">
            {REJECTION_REASONS.map(({ value, label }) => {
              const checked = reasons.includes(value)
              return (
                <label
                  key={value}
                  className="flex items-center gap-3 cursor-pointer rounded-lg p-3 transition-colors"
                  style={{
                    background: checked ? 'var(--af-error-soft, #fee2e2)' : 'var(--af-surface-raised)',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleReason(value)}
                    className="h-4 w-4 rounded"
                    style={{ accentColor: 'var(--af-error)' }}
                  />
                  <span className="text-sm" style={{ color: 'var(--af-txt)' }}>{label}</span>
                </label>
              )
            })}
          </div>

          {/* Notes field */}
          <div className="mt-5">
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--af-txt)' }}>
              Additional notes <span style={{ color: 'var(--af-muted)' }}>(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Describe the specific issue if needed…"
              rows={3}
              maxLength={500}
              className="w-full rounded-xl px-3 py-2 text-sm resize-none border focus:outline-none focus:ring-2 transition-all"
              style={{
                background:   'var(--af-surface)',
                borderColor:  'var(--af-border)',
                color:        'var(--af-txt)',
              }}
            />
            <p className="text-xs mt-1 text-right" style={{ color: 'var(--af-muted)' }}>
              {notes.length}/500
            </p>
          </div>
        </div>
      )}

      {/* ── Error message ─────────────────────────────────────────────── */}
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

      {/* ── Actions ───────────────────────────────────────────────────── */}
      <div className="flex gap-3">
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            e.stopPropagation()
            router.push('/reviewer')
          }}
          disabled={submitting}
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
          className="px-5 py-2.5 rounded-xl text-sm font-medium border transition-all"
          style={{
            borderColor: 'var(--af-border)',
            color:       'var(--af-muted)',
            background:  'transparent',
          }}
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
          disabled={submitting || !decision || (decision === 'reject' && reasons.length === 0)}
          onMouseEnter={(e) => {
            if (!submitting && decision) e.currentTarget.style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
          className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: submitting || !decision || (decision === 'reject' && reasons.length === 0)
              ? 'var(--af-border)'
              : decision === 'reject' ? 'var(--af-error)' : 'var(--af-primary)',
            color: submitting || !decision || (decision === 'reject' && reasons.length === 0)
              ? 'var(--af-muted)'
              : '#fff',
            cursor: submitting || !decision || (decision === 'reject' && reasons.length === 0)
              ? 'not-allowed'
              : 'pointer',
          }}
        >
          {submitting
            ? 'Submitting…'
            : decision === 'approve'
              ? 'Confirm Approval'
              : decision === 'reject'
                ? 'Confirm Rejection'
                : 'Select a Decision'}
        </button>
      </div>
    </div>
  )
}
