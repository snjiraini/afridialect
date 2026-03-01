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
  transcriptionContent: string
  translationContent: string
  signedAudioUrl: string | null
}

const REJECTION_REASONS: { value: string; label: string }[] = [
  { value: 'meaning_not_preserved',   label: 'Meaning not preserved — translation changes the message' },
  { value: 'incomplete',              label: 'Translation is incomplete or truncated' },
  { value: 'wrong_language',          label: 'Not translated into English' },
  { value: 'literal_to_a_fault',      label: 'Too literal — unnatural English' },
  { value: 'speaker_turns_wrong',     label: 'Speaker turns not maintained' },
  { value: 'code_switching_error',    label: 'Code-switching segments mis-handled' },
  { value: 'inconsistent',            label: 'Inconsistent terminology or style' },
  { value: 'other',                   label: 'Other (describe in notes)' },
]

/**
 * Client-side Translation QC form.
 * Reviewer listens to audio, reads the transcription, reads the English translation,
 * then approves or rejects the translation.
 *
 * On approve  → clip advances to mint_ready (POST /api/translation-qc/submit)
 * On reject   → clip returns for re-translation
 */
export default function TranslationQCForm({
  taskId,
  dialectName,
  durationSeconds,
  speakerCount,
  speakerTurns,
  speakerGender,
  transcriptionContent,
  translationContent,
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
      const res = await fetch('/api/translation-qc/submit', {
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
          {decision === 'approve' ? 'Translation Approved' : 'Translation Rejected'}
        </h3>
        <p className="text-sm mt-2" style={{ color: 'var(--af-muted)' }}>
          {decision === 'approve'
            ? 'The translation has been approved. This clip is now ready for minting.'
            : 'The translation has been rejected and returned for re-translation.'}
        </p>
        <p className="text-xs mt-3" style={{ color: 'var(--af-muted)' }}>Returning to queue…</p>
      </div>
    )
  }

  const progressPct = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0
  const transcriptionWordCount = transcriptionContent.trim().split(/\s+/).length
  const translationWordCount   = translationContent.trim().split(/\s+/).length

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* ── Clip metadata ─────────────────────────────────────────────── */}
      <div className="af-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
            style={{ background: '#fef3c7', color: '#d97706' }}
          >
            Translation QC
          </span>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--af-txt)' }}>
            Clip Details
          </h2>
        </div>
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
        </dl>
      </div>

      {/* ── Audio player ──────────────────────────────────────────────── */}
      <div className="af-card p-6">
        <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
          Listen to Audio
        </h2>
        {signedAudioUrl ? (
          <>
            <audio ref={audioRef} src={signedAudioUrl} preload="metadata" className="hidden" />
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
            Audio preview unavailable. The signed URL could not be generated.
          </p>
        )}
      </div>

      {/* ── Side-by-side: Transcription + Translation ─────────────────── */}
      <div className="grid md:grid-cols-2 gap-4">

        {/* Transcription (source) */}
        <div className="af-card p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--af-txt)' }}>
              {dialectName} Transcription
            </h2>
            <span className="text-xs" style={{ color: 'var(--af-muted)' }}>
              {transcriptionWordCount} words
            </span>
          </div>
          <div
            className="rounded-lg p-4 text-sm font-mono leading-relaxed whitespace-pre-wrap"
            style={{
              background:  'var(--af-surface-raised)',
              color:       'var(--af-txt)',
              minHeight:   '160px',
            }}
          >
            {transcriptionContent}
          </div>
        </div>

        {/* Translation (to review) */}
        <div className="af-card p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold" style={{ color: 'var(--af-txt)' }}>
              English Translation
            </h2>
            <span className="text-xs" style={{ color: 'var(--af-muted)' }}>
              {translationWordCount} words
            </span>
          </div>
          <div
            className="rounded-lg p-4 text-sm leading-relaxed whitespace-pre-wrap"
            style={{
              background:  'var(--af-surface-raised)',
              color:       'var(--af-txt)',
              minHeight:   '160px',
            }}
          >
            {translationContent}
          </div>
        </div>
      </div>

      {/* ── QC Checklist reminder ─────────────────────────────────────── */}
      <div className="af-card p-5">
        <h2 className="text-sm font-semibold mb-3" style={{ color: 'var(--af-txt)' }}>
          Translation QC Checklist
        </h2>
        <ul className="space-y-1.5 text-sm" style={{ color: 'var(--af-muted)' }}>
          <li className="flex items-start gap-2">
            <span style={{ color: 'var(--af-primary)' }}>•</span>
            Does the English translation convey the same meaning as the dialect transcription?
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: 'var(--af-primary)' }}>•</span>
            Is the translation complete — no sections missing?
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: 'var(--af-primary)' }}>•</span>
            Are speaker turns preserved and correctly mapped?
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: 'var(--af-primary)' }}>•</span>
            Is the English natural and grammatically correct?
          </li>
          <li className="flex items-start gap-2">
            <span style={{ color: 'var(--af-primary)' }}>•</span>
            Is code-switching appropriately handled?
          </li>
        </ul>
      </div>

      {/* ── Decision ─────────────────────────────────────────────────── */}
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
            <p className="text-xs mt-1 text-right" style={{ color: 'var(--af-muted)' }}>
              {notes.length}/500
            </p>
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
