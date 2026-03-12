export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/layouts/Topbar'

/**
 * Reviewer / QC queue.
 * Shows audio_qc, transcript_qc, and translation_qc available tasks.
 * Excludes tasks for clips the reviewer uploaded (one-task-per-item).
 */
export default async function ReviewerPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const admin = await createAdminClient()

  // Verify reviewer role
  const { data: role } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'reviewer')
    .single()

  if (!role) {
    return (
      <>
        <Topbar title="Review / QC" subtitle="Quality-check submitted audio clips and transcripts" />
        <div className="container-modern py-8">
          <div className="af-card p-6 border-l-4" style={{ borderColor: 'var(--af-warning)' }}>
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 mt-0.5 shrink-0" style={{ color: 'var(--af-warning)' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--af-txt)' }}>Access Denied</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--af-muted)' }}>
                  You need the <strong>reviewer</strong> role to access this page. Please contact an administrator.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Fetch all available audio_qc, transcript_qc, and translation_qc tasks
  const { data: allTasks } = await admin
    .from('tasks')
    .select(`
      id,
      task_type,
      audio_clip_id,
      status,
      created_at,
      audio_clips (
        id,
        duration_seconds,
        speaker_count,
        speaker_gender,
        uploader_id,
        dialects ( name, code )
      )
    `)
    .in('task_type', ['audio_qc', 'transcript_qc', 'translation_qc'])
    .eq('status', 'available')
    .order('created_at', { ascending: true })
    .limit(100)

  // Filter out clips uploaded by the current reviewer (one-task-per-item)
  const filtered = (allTasks ?? []).filter((t) => {
    // @ts-ignore
    const clip = Array.isArray(t.audio_clips) ? t.audio_clips[0] : t.audio_clips
    return clip?.uploader_id !== user.id
  })

  const audioQCTasks       = filtered.filter((t) => t.task_type === 'audio_qc')
  const transcriptQCTasks  = filtered.filter((t) => t.task_type === 'transcript_qc')
  const translationQCTasks = filtered.filter((t) => t.task_type === 'translation_qc')

  function renderTask(task: typeof filtered[number]) {
    // @ts-ignore
    const clip = Array.isArray(task.audio_clips) ? task.audio_clips[0] : task.audio_clips
    // @ts-ignore
    const dialect = Array.isArray(clip?.dialects) ? clip.dialects[0] : clip?.dialects

    const durationSec = clip?.duration_seconds ?? 0
    const durationMin = Math.floor(durationSec / 60)
    const durationRemSec = Math.round(durationSec % 60)
    const durationLabel = durationMin > 0 ? `${durationMin}m ${durationRemSec}s` : `${durationRemSec}s`

    const queuedAt = new Date(task.created_at).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    })

    const isTranscriptQC  = task.task_type === 'transcript_qc'
    const isTranslationQC = task.task_type === 'translation_qc'

    return (
      <div key={task.id} className="af-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              {isTranscriptQC && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                  style={{ background: 'rgba(38,198,218,0.15)', color: '#26c6da' }}
                >
                  Transcript QC
                </span>
              )}
              {isTranslationQC && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold"
                  style={{ background: 'rgba(245,181,93,0.15)', color: '#f5b55d' }}
                >
                  Translation QC
                </span>
              )}
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{ background: 'var(--af-accent-soft)', color: 'var(--af-primary)' }}
              >
                {dialect?.name ?? 'Unknown dialect'}
              </span>
              <span
                className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                style={{ background: 'var(--af-surface-raised)', color: 'var(--af-muted)' }}
              >
                {durationLabel}
              </span>
              {clip?.speaker_count && clip.speaker_count > 1 && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium"
                  style={{ background: 'var(--af-surface-raised)', color: 'var(--af-muted)' }}
                >
                  {clip.speaker_count} speakers
                </span>
              )}
              {clip?.speaker_gender && clip.speaker_gender !== 'unknown' && (
                <span
                  className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium capitalize"
                  style={{ background: 'var(--af-surface-raised)', color: 'var(--af-muted)' }}
                >
                  {clip.speaker_gender}
                </span>
              )}
            </div>
            <p className="text-xs" style={{ color: 'var(--af-muted)' }}>
              Queued {queuedAt} · Task {task.id.slice(0, 8)}
            </p>
          </div>
          <Link
            href={`/reviewer/${task.id}`}
            className="btn-primary text-sm px-4 py-2 rounded-lg font-medium transition-all"
            style={{ flexShrink: 0 }}
          >
            Review
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <Topbar title="Review / QC" subtitle="Quality-check submitted audio clips and transcripts" />
      <div className="container-modern py-8 space-y-6">

        {/* Header stats */}
        <div className="af-card p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--af-txt)' }}>
                QC Queue
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--af-muted)' }}>
                Review audio clips, transcripts, and translations to advance items through the pipeline.
              </p>
            </div>
            <div className="flex gap-3 flex-wrap">
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                style={{ background: 'var(--af-accent-soft)', color: 'var(--af-primary)' }}
              >
                {audioQCTasks.length} audio QC
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                style={{ background: 'rgba(38,198,218,0.15)', color: '#26c6da' }}
              >
                {transcriptQCTasks.length} transcript QC
              </span>
              <span
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
                style={{ background: 'rgba(245,181,93,0.15)', color: '#f5b55d' }}
              >
                {translationQCTasks.length} translation QC
              </span>
              <Link
                href="/reviewer/analytics"
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium border transition-all"
                style={{ borderColor: 'var(--af-border)', color: 'var(--af-muted)' }}
              >
                📊 Analytics
              </Link>
            </div>
          </div>
        </div>

        {/* Guidelines */}
        <div className="grid md:grid-cols-3 gap-4">
          <div className="af-card p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--af-txt)' }}>
              🎙️ Audio QC Checklist
            </h3>
            <ul className="space-y-1.5 text-sm" style={{ color: 'var(--af-muted)' }}>
              <li className="flex items-start gap-2"><span style={{ color: 'var(--af-success)' }}>✓</span> Clear audio, minimal background noise</li>
              <li className="flex items-start gap-2"><span style={{ color: 'var(--af-success)' }}>✓</span> Correct dialect as declared</li>
              <li className="flex items-start gap-2"><span style={{ color: 'var(--af-success)' }}>✓</span> Duration 30–40 seconds</li>
              <li className="flex items-start gap-2"><span style={{ color: 'var(--af-success)' }}>✓</span> No offensive or harmful content</li>
              <li className="flex items-start gap-2"><span style={{ color: 'var(--af-success)' }}>✓</span> Speech is audible and transcribable</li>
            </ul>
          </div>
          <div className="af-card p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--af-txt)' }}>
              📝 Transcript QC Checklist
            </h3>
            <ul className="space-y-1.5 text-sm" style={{ color: 'var(--af-muted)' }}>
              <li className="flex items-start gap-2"><span style={{ color: 'var(--af-success)' }}>✓</span> Verbatim fidelity — every word captured</li>
              <li className="flex items-start gap-2"><span style={{ color: 'var(--af-success)' }}>✓</span> Correct dialect marking and code-switching</li>
              <li className="flex items-start gap-2"><span style={{ color: 'var(--af-success)' }}>✓</span> Tags used correctly ([laughter], [silence], etc.)</li>
              <li className="flex items-start gap-2"><span style={{ color: 'var(--af-success)' }}>✓</span> Speaker turns correctly labelled</li>
              <li className="flex items-start gap-2"><span style={{ color: 'var(--af-success)' }}>✓</span> Speaker count matches audio</li>
            </ul>
          </div>
          <div className="af-card p-5">
            <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--af-txt)' }}>
              🌍 Translation QC Checklist
            </h3>
            <ul className="space-y-1.5 text-sm" style={{ color: 'var(--af-muted)' }}>
              <li className="flex items-start gap-2"><span style={{ color: 'var(--af-success)' }}>✓</span> Meaning preserved from dialect source</li>
              <li className="flex items-start gap-2"><span style={{ color: 'var(--af-success)' }}>✓</span> Translation is complete, no sections missing</li>
              <li className="flex items-start gap-2"><span style={{ color: 'var(--af-success)' }}>✓</span> Natural, grammatically correct English</li>
              <li className="flex items-start gap-2"><span style={{ color: 'var(--af-success)' }}>✓</span> Speaker turns preserved correctly</li>
              <li className="flex items-start gap-2"><span style={{ color: 'var(--af-success)' }}>✓</span> Code-switching appropriately handled</li>
            </ul>
          </div>
        </div>

        {/* Translation QC section — highest pipeline priority */}
        {translationQCTasks.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 px-1" style={{ color: 'var(--af-txt)' }}>
              🌍 Translation QC ({translationQCTasks.length})
            </h3>
            <div className="space-y-3">
              {translationQCTasks.map(renderTask)}
            </div>
          </div>
        )}

        {/* Transcript QC section */}
        {transcriptQCTasks.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 px-1" style={{ color: 'var(--af-txt)' }}>
              📝 Transcript QC ({transcriptQCTasks.length})
            </h3>
            <div className="space-y-3">
              {transcriptQCTasks.map(renderTask)}
            </div>
          </div>
        )}

        {/* Audio QC section */}
        {audioQCTasks.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3 px-1" style={{ color: 'var(--af-txt)' }}>
              🎙️ Audio QC ({audioQCTasks.length})
            </h3>
            <div className="space-y-3">
              {audioQCTasks.map(renderTask)}
            </div>
          </div>
        )}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="af-card p-12 text-center">
            <svg className="mx-auto h-12 w-12 mb-4" style={{ color: 'var(--af-muted)' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium" style={{ color: 'var(--af-txt)' }}>Queue is empty</h3>
            <p className="text-sm mt-2" style={{ color: 'var(--af-muted)' }}>
              No items are waiting for QC review right now. Check back later.
            </p>
          </div>
        )}
      </div>
    </>
  )
}
