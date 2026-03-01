import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Topbar from '@/components/layouts/Topbar'
import AudioQCForm from './components/AudioQCForm'

interface Props {
  params: Promise<{ taskId: string }>
}

/**
 * Audio QC review detail page.
 * Fetches the task + clip, signs the audio URL, then renders the client-side form.
 */
export default async function ReviewerTaskPage({ params }: Props) {
  const { taskId } = await params

  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  // Verify reviewer role
  const { data: role } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .eq('role', 'reviewer')
    .single()

  if (!role) {
    redirect('/reviewer')
  }

  // Fetch the task with full clip + dialect info
  const { data: task, error } = await supabase
    .from('tasks')
    .select(`
      id,
      task_type,
      status,
      created_at,
      audio_clip_id,
      audio_clips (
        id,
        audio_url,
        duration_seconds,
        speaker_count,
        speaker_gender,
        speaker_age_range,
        uploader_id,
        metadata,
        dialects ( name, code )
      )
    `)
    .eq('id', taskId)
    .eq('task_type', 'audio_qc')
    .single()

  if (error || !task) {
    notFound()
  }

  // Supabase returns joined 1:1 relations as object or array — normalise
  // @ts-ignore
  const clipRaw = task.audio_clips
  const clip = Array.isArray(clipRaw) ? clipRaw[0] : clipRaw

  if (!clip) {
    notFound()
  }

  // Enforce: reviewer cannot QC their own upload
  if (clip.uploader_id === session.user.id) {
    redirect('/reviewer')
  }

  // Task must still be open
  if (!['available', 'claimed'].includes(task.status)) {
    redirect('/reviewer')
  }

  // @ts-ignore
  const dialectRaw = clip.dialects
  const dialect = Array.isArray(dialectRaw) ? dialectRaw[0] : dialectRaw

  // Generate a signed URL for private bucket playback (1 hour TTL)
  let signedAudioUrl: string | null = null
  if (clip.audio_url) {
    // Extract the storage path from the full public URL
    const urlParts = clip.audio_url.split('/audio-staging/')
    const storagePath = urlParts[1] ?? ''

    if (storagePath) {
      const { data: signed } = await supabase.storage
        .from('audio-staging')
        .createSignedUrl(storagePath, 3600)
      signedAudioUrl = signed?.signedUrl ?? null
    }
  }

  // @ts-ignore
  const description: string = clip.metadata?.description ?? ''

  return (
    <>
      <Topbar
        title="Audio QC"
        subtitle={`Reviewing: ${dialect?.name ?? 'Unknown dialect'} · ${taskId.slice(0, 8)}`}
      />
      <div className="container-modern py-8">
        <AudioQCForm
          taskId={task.id}
          audioClipId={clip.id}
          dialectName={dialect?.name ?? 'Unknown'}
          dialectCode={dialect?.code ?? ''}
          durationSeconds={clip.duration_seconds}
          speakerCount={clip.speaker_count ?? 1}
          speakerGender={clip.speaker_gender ?? 'unknown'}
          speakerAgeRange={clip.speaker_age_range ?? 'adult'}
          description={description}
          signedAudioUrl={signedAudioUrl}
        />
      </div>
    </>
  )
}
