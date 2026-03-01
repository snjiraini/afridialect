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
  speakerTurns: number
  speakerGender: string
  tags: string[]
  transcriptionContent: string
  signedAudioUrl: string | null
}

const REJECTION_REASONS: { value: string; label: string }[] = [
  { value: 'verbatim_not_met',       label: 'Not verbatim — words missing or changed' },
  { value: 'wrong_dialect_marking',  label: 'Wrong dialect marking / misidentification' },
  { value: 'incorrect_tags',         label: 'Tags used incorrectly' },
  { value: 'speaker_count_wrong',    label: 'Speaker count does not match audio' },
  { value: 'speaker_turns_wrong',    label: 'Speaker turns incorrectly labelled' },
  { value: 'code_switching_error',   label: 'Code-switching not captured correctly' },
  { value: 'incomplete',             label: 'Transcription is incomplete' },
  { value: 'other',                  label: 'Other (describe in notes)' },
]

/**
 * Client-side Transcript QC form.
 * Reviewer listens to audio, reads the submitted transcription, then approves or rejects.
 */
export default function TranscriptQCForm({
  taskId,
  audioClipId,
  dialectName,
  dialectCode,
  durationSeconds,
  speakerCount,
  speakerTurns,
  speakerGender,
  tags,
  transcriptionContent,
  signedAudioUrl,
}: Props) {
  const router = useRouter()
  const audioRef = useRef<HTMLAudioElement>(null)

  const [isPlaying, setIsPlaying]         = useState(false)
  const [currentTime, setCurrentTime]     = useState(0)
  const [audioDuration, setAudioDuration] = useState(0)
  const [decision, setDecision]           = useState<'approve' | 'reject' | null>(null)
  const [reasons, setReasons]             = useState<string[]>([])
  const [notes, setNotes]                 = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [success, setSuccess]             = useState(false)

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
      const res = await fetch('/api/transcript-qc/submit', {
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
        <h3 className="text-lg font-semibold" style={{ color: 'var(--af-txt)' }}>
          {decision === 'approve' ? 'Transcript Approved' : 'Transcript Rejected'}
        </h3>
        <p className="text-sm mt-2" style={{ color: 'var(--af-muted)' }}>
          {decision === 'approve'
            ? 'The transcript has been approved and queued for translation.'
            : 'The transcript has been rejected and flagged for re-transcription.'}
        </p>
        <p className="text-xs mt-3" style={{ color: 'var(--af-muted)' }}>Returning to queue…</p>
      </div>
    )
  }

  const progressPct = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* ── Clip metadata ─────────────────────────────────────────────── */}
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
          <div>
            <dt style={{ color: 'var(--af-muted)' }}>Speaker turns</dt>
            <dd className="font-medium mt-0.5" style={{ color: 'var(--af-txt)' }}>{speakerTurns}</dd>
          </div>
          {tags.length > 0 && (
            <div className="col-span-2">
              <dt style={{ color: 'var(--af-muted)' }}>Tags</dt>
              <dd className="mt-0.5 flex flex-wrap gap-1">
                {tags.map((tag) => (
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

      {/* ── Audio player ──────────────────────────────────────────────── */}
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
          <p className="text-sm" style={{ color: 'var(--af-muted)' }}>
            Audio preview unavailable.
          </p>
        )}
      </div>

      {/* ── Transcription content ──────────────────────────────────────── */}
      <div className="af-card p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
          Submitted Transcription
        </h2>
        <div
          className="rounded-xl p-4 text-sm font-mono leading-relaxed whitespace-pre-wrap"
          style={{
            background:  'var(--af-surface-raised)',
            color:       'var(--af-txt)',
            minHeight:   '120px',
            border:      '1px solid var(--af-border)',
          }}
        >
          {transcriptionContent}
        </div>
        <p className="text-xs mt-2" style={{ color: 'var(--af-muted)' }}>
          {transcriptionContent.trim().split(/\s+/).length} words
        </p>
      </div>

      {/* ── Decision ──────────────────────────────────────────────────── */}
      <div className="af-card p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
          Your Decision
        </h2>
        <div className="flex gap-3">
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

      {/* ── Rejection reasons ─────────────────────────────────────────── */}
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
                  style={{ background: checked ? 'var(--af-error-soft, #fee2e2)' : 'var(--af-surface-raised)' }}
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
                background:  'var(--af-surface)',
                borderColor: 'var(--af-border)',
                color:       'var(--af-txt)',
              }}
            />
            <p className="text-xs mt-1 text-right" style={{ color: 'var(--af-muted)' }}>{notes.length}/500</p>
          </div>
        </div>
      )}

      {/* ── Error ─────────────────────────────────────────────────────── */}
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
