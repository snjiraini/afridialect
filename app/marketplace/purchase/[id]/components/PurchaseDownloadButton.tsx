'use client'

/**
 * PrepareDatasetButton — client component
 *
 * Streams SSE progress from GET /api/marketplace/download/[id] and shows
 * a live step-by-step build console. On completion triggers the browser
 * download automatically.
 */

import { useState, useRef } from 'react'

interface Props {
  purchaseId: string
  sampleCount: number
}

type BuildStep =
  | 'idle'
  | 'auth_check'
  | 'checking_cache'
  | 'loading_clips'
  | 'fetching_audio'
  | 'building_zip'
  | 'uploading'
  | 'generating_url'
  | 'done'
  | 'error'

interface StepEvent {
  step:          BuildStep
  message:       string
  detail?:       string
  current?:      number
  total?:        number
  downloadUrl?:  string
  sampleCount?:  number
  downloadCount?: number
  error?:        string
}

const STEP_ORDER: BuildStep[] = [
  'auth_check',
  'checking_cache',
  'loading_clips',
  'fetching_audio',
  'building_zip',
  'uploading',
  'generating_url',
  'done',
]

const STEP_LABELS: Record<string, string> = {
  auth_check:     'Auth & ownership check',
  checking_cache: 'Checking for cached package',
  loading_clips:  'Loading clip data',
  fetching_audio: 'Fetching audio from IPFS',
  building_zip:   'Building ZIP archive',
  uploading:      'Uploading to secure storage',
  generating_url: 'Generating download link',
  done:           'Ready',
}

export default function PrepareDatasetButton({ purchaseId, sampleCount }: Props) {
  const [phase,       setPhase]       = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [currentStep, setCurrentStep] = useState<BuildStep>('idle')
  const [stepMsg,     setStepMsg]     = useState('')
  const [stepDtl,     setStepDtl]     = useState('')
  const [audioProgress, setAudioProgress] = useState<{ current: number; total: number } | null>(null)
  const [errorMsg,    setErrorMsg]    = useState<string | null>(null)
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const handlePrepare = async () => {
    if (phase === 'running') return

    setPhase('running')
    setCurrentStep('auth_check')
    setStepMsg('Starting…')
    setStepDtl('')
    setAudioProgress(null)
    setErrorMsg(null)
    setDownloadUrl(null)

    abortRef.current = new AbortController()

    try {
      const response = await fetch(`/api/marketplace/download/${purchaseId}`, {
        signal: abortRef.current.signal,
      })

      if (!response.ok || !response.body) {
        setPhase('error')
        setErrorMsg('Server returned an error. Please try again.')
        return
      }

      const reader  = response.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() ?? ''

        for (const raw of events) {
          const line = raw.trim()
          if (!line.startsWith('data:')) continue
          try {
            const event = JSON.parse(line.slice(5).trim()) as StepEvent
            setCurrentStep(event.step)
            setStepMsg(event.message)
            setStepDtl(event.detail ?? '')

            if (event.current !== undefined && event.total !== undefined) {
              setAudioProgress({ current: event.current, total: event.total })
            }

            if (event.step === 'done' && event.downloadUrl) {
              setDownloadUrl(event.downloadUrl)
              setPhase('done')
              // Auto-trigger browser download
              const a = document.createElement('a')
              a.href     = event.downloadUrl
              a.download = `afridialect-dataset-${purchaseId.slice(0, 8)}.zip`
              document.body.appendChild(a)
              a.click()
              document.body.removeChild(a)
            }

            if (event.step === 'error') {
              setPhase('error')
              setErrorMsg(event.error ?? event.message)
            }
          } catch { /* malformed SSE line */ }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setPhase('error')
        setErrorMsg(err instanceof Error ? err.message : 'Network error')
      }
    }
  }

  const reset = () => {
    abortRef.current?.abort()
    setPhase('idle')
    setCurrentStep('idle')
    setStepMsg('')
    setStepDtl('')
    setAudioProgress(null)
    setErrorMsg(null)
    setDownloadUrl(null)
  }

  const isRunning = phase === 'running'
  const isDone    = phase === 'done'
  const isError   = phase === 'error'

  return (
    <div className="space-y-4">
      {/* ── Trigger button ───────────────────────────────────────── */}
      {phase === 'idle' && (
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handlePrepare() }}
          className="btn-primary text-sm"
          onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
          onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
        >
          🤖 Prepare AI/ML Training Dataset
        </button>
      )}

      {/* ── Progress console ─────────────────────────────────────── */}
      {phase !== 'idle' && (
        <div
          className="rounded-xl p-4"
          style={{
            background:  'var(--af-surface)',
            border:      `1px solid ${isDone ? 'var(--af-success)' : isError ? 'var(--af-danger)' : 'var(--af-line)'}`,
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold" style={{ color: 'var(--af-txt)' }}>
              {isDone  ? '✅ Dataset Ready' :
               isError ? '❌ Build Failed'  :
               '⚙️ Building Dataset…'}
            </p>
            {!isRunning && (
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); reset() }}
                className="text-[11px]"
                style={{ color: 'var(--af-muted)' }}
              >
                {isDone ? 'Build again' : 'Dismiss'}
              </button>
            )}
          </div>

          {/* Step list */}
          <div className="space-y-2 mb-3">
            {STEP_ORDER.filter(s => s !== 'done').map((key) => {
              const currentIdx = STEP_ORDER.indexOf(currentStep)
              const thisIdx    = STEP_ORDER.indexOf(key)
              const completed  = isDone || thisIdx < currentIdx
              const active     = key === currentStep && !isDone && !isError
              const failed     = isError && key === currentStep

              return (
                <div key={key} className="flex items-start gap-2">
                  <span className="text-sm flex-shrink-0 mt-px">
                    {completed ? '✅' : active ? '🔄' : failed ? '❌' : '⬜'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-xs font-medium ${active ? 'animate-pulse' : ''}`}
                      style={{
                        color: active    ? 'var(--af-primary)' :
                               completed ? 'var(--af-txt)'     :
                               failed    ? 'var(--af-danger)'  :
                               'var(--af-muted)',
                      }}
                    >
                      {STEP_LABELS[key]}
                    </p>

                    {/* Active step detail */}
                    {active && (
                      <>
                        {stepMsg && (
                          <p className="text-[11px]" style={{ color: 'var(--af-muted)' }}>{stepMsg}</p>
                        )}
                        {stepDtl && (
                          <p className="text-[11px]" style={{ color: 'var(--af-muted)' }}>{stepDtl}</p>
                        )}
                        {/* Audio progress bar */}
                        {key === 'fetching_audio' && audioProgress && (
                          <div className="mt-1.5">
                            <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--af-muted)' }}>
                              <span>Clip {audioProgress.current} of {audioProgress.total}</span>
                              <span>{Math.round((audioProgress.current / audioProgress.total) * 100)}%</span>
                            </div>
                            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--af-line)' }}>
                              <div
                                className="h-full rounded-full transition-all duration-300"
                                style={{
                                  width:      `${(audioProgress.current / audioProgress.total) * 100}%`,
                                  background: 'var(--af-primary)',
                                }}
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Error message */}
          {isError && errorMsg && (
            <div
              className="text-xs p-2 rounded mb-3"
              style={{ background: 'var(--af-card)', color: 'var(--af-danger)', border: '1px solid var(--af-danger)' }}
            >
              {errorMsg}
            </div>
          )}

          {/* Done — manual download link in case browser blocked auto-download */}
          {isDone && downloadUrl && (
            <a
              href={downloadUrl}
              download={`afridialect-dataset-${purchaseId.slice(0, 8)}.zip`}
              className="btn-primary text-xs block text-center"
              style={{ marginTop: 8 }}
            >
              ⬇️ Download ZIP ({sampleCount} sample{sampleCount !== 1 ? 's' : ''})
            </a>
          )}

          {/* Retry on error */}
          {isError && (
            <button
              type="button"
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); reset(); setTimeout(handlePrepare, 50) }}
              className="btn-primary text-xs w-full"
              style={{ marginTop: 8 }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
            >
              🔄 Retry
            </button>
          )}
        </div>
      )}
    </div>
  )
}
