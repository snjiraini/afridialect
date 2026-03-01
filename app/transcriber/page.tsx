import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import Topbar from '@/components/layouts/Topbar'

/**
 * Transcriber queue page.
 * Lists all available transcription tasks.
 * Enforces: transcriber cannot transcribe their own upload (one-task-per-item).
 */
export default async function TranscriberPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  // Verify transcriber role
  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .eq('role', 'transcriber')
    .single()

  if (!role) {
    return (
      <>
        <Topbar title="Transcribe" subtitle="Convert dialect audio to text" />
        <div className="container-modern py-8">
          <div className="af-card p-6 border-l-4" style={{ borderColor: 'var(--af-warning)' }}>
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 mt-0.5 shrink-0" style={{ color: 'var(--af-warning)' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--af-txt)' }}>Access Denied</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--af-muted)' }}>
                  You need the <strong>transcriber</strong> role to access this page. Please contact an administrator.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  // Fetch available transcription tasks (not yet claimed by anyone)
  const { data: availableTasks } = await supabase
    .from('tasks')
    .select(`
      id,
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
    .eq('task_type', 'transcription')
    .eq('status', 'available')
    .order('created_at', { ascending: true })
    .limit(50)

  // Fetch this user's currently claimed task (if any)
  const { data: claimedTask } = await supabase
    .from('tasks')
    .select(`
      id,
      audio_clip_id,
      expires_at,
      claimed_at,
      audio_clips (
        id,
        duration_seconds,
        speaker_count,
        speaker_gender,
        dialects ( name, code )
      )
    `)
    .eq('task_type', 'transcription')
    .eq('status', 'claimed')
    .eq('claimed_by', session.user.id)
    .maybeSingle()

  // Filter out clips uploaded by the current user (one-task-per-item rule)
  const filtered = (availableTasks ?? []).filter((t) => {
    // @ts-ignore
    const clip = Array.isArray(t.audio_clips) ? t.audio_clips[0] : t.audio_clips
    return clip?.uploader_id !== session.user.id
  })

  const formatExpiry = (expiresAt: string | null) => {
    if (!expiresAt) return null
    const diff = new Date(expiresAt).getTime() - Date.now()
    if (diff <= 0) return 'Expired'
    const hours = Math.floor(diff / 3600000)
    const mins = Math.floor((diff % 3600000) / 60000)
    return hours > 0 ? `${hours}h ${mins}m remaining` : `${mins}m remaining`
  }

  return (
    <>
      <Topbar title="Transcribe" subtitle="Convert dialect audio recordings to text" />
      <div className="container-modern py-8 space-y-6">

        {/* Header */}
        <div className="af-card p-6">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-xl font-semibold" style={{ color: 'var(--af-txt)' }}>
                Transcription Queue
              </h2>
              <p className="text-sm mt-1" style={{ color: 'var(--af-muted)' }}>
                Claim a task to lock it for 24 hours and write a verbatim transcription.
              </p>
            </div>
            <span
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium"
              style={{ background: 'var(--af-accent-soft)', color: 'var(--af-primary)' }}
            >
              {filtered.length} {filtered.length === 1 ? 'clip' : 'clips'} available
            </span>
          </div>
        </div>

        {/* Active claim banner */}
        {claimedTask && (() => {
          // @ts-ignore
          const clip = Array.isArray(claimedTask.audio_clips) ? claimedTask.audio_clips[0] : claimedTask.audio_clips
          // @ts-ignore
          const dialect = Array.isArray(clip?.dialects) ? clip.dialects[0] : clip?.dialects
          const timeLeft = formatExpiry(claimedTask.expires_at)
          return (
            <div className="af-card p-5 border-l-4" style={{ borderColor: 'var(--af-primary)' }}>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--af-txt)' }}>
                    📝 You have an active task
                  </p>
                  <p className="text-xs mt-1" style={{ color: 'var(--af-muted)' }}>
                    {dialect?.name ?? 'Unknown dialect'} · {timeLeft ?? 'No expiry set'}
                  </p>
                </div>
                <Link
                  href={`/transcriber/${claimedTask.id}`}
                  className="btn-primary text-sm px-4 py-2 rounded-lg font-medium"
                >
                  Continue Transcribing
                </Link>
              </div>
            </div>
          )
        })()}

        {/* Guidelines */}
        <div className="af-card p-5">
          <h3 className="text-sm font-semibold mb-3" style={{ color: 'var(--af-txt)' }}>
            Transcription Guidelines
          </h3>
          <ul className="space-y-1.5 text-sm" style={{ color: 'var(--af-muted)' }}>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--af-success)' }}>✓</span>
              Write a verbatim transcription — capture every word exactly as spoken
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--af-success)' }}>✓</span>
              Use tags for non-speech: [laughter], [silence], [noise], [inaudible]
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--af-success)' }}>✓</span>
              Mark speaker turns with a new line prefixed by "S1:", "S2:", etc.
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--af-success)' }}>✓</span>
              Note code-switching inline (e.g. English words within Kikuyu)
            </li>
            <li className="flex items-start gap-2">
              <span style={{ color: 'var(--af-success)' }}>✓</span>
              You have 24 hours after claiming before the task is automatically released
            </li>
          </ul>
        </div>

        {/* Task list */}
        {filtered.length === 0 ? (
          <div className="af-card p-12 text-center">
            <svg className="mx-auto h-12 w-12 mb-4" style={{ color: 'var(--af-muted)' }} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium" style={{ color: 'var(--af-txt)' }}>Queue is empty</h3>
            <p className="text-sm mt-2" style={{ color: 'var(--af-muted)' }}>
              No transcription tasks are available right now. Check back later.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((task) => {
              // @ts-ignore
              const clip = Array.isArray(task.audio_clips) ? task.audio_clips[0] : task.audio_clips
              // @ts-ignore
              const dialect = Array.isArray(clip?.dialects) ? clip.dialects[0] : clip?.dialects

              const durationSec = clip?.duration_seconds ?? 0
              const durationMin = Math.floor(durationSec / 60)
              const durationRemSec = Math.round(durationSec % 60)
              const durationLabel = durationMin > 0
                ? `${durationMin}m ${durationRemSec}s`
                : `${durationRemSec}s`

              const queuedAt = new Date(task.created_at).toLocaleDateString('en-US', {
                month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
              })

              return (
                <div key={task.id} className="af-card p-5">
                  <div className="flex items-center justify-between flex-wrap gap-4">
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
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
                        Available since {queuedAt} · Task {task.id.slice(0, 8)}
                      </p>
                    </div>
                    <Link
                      href={`/transcriber/${task.id}`}
                      className="btn-primary text-sm px-4 py-2 rounded-lg font-medium transition-all"
                      style={{ flexShrink: 0 }}
                    >
                      Claim &amp; Transcribe
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}
