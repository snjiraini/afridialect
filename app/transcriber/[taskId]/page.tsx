import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Topbar from '@/components/layouts/Topbar'
import TranscriptionForm from './components/TranscriptionForm'

interface Props {
  params: Promise<{ taskId: string }>
}

/**
 * Transcription task detail page.
 * Fetches the task + clip, signs the audio URL, then renders the client-side editor.
 */
export default async function TranscriberTaskPage({ params }: Props) {
  const { taskId } = await params

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
    redirect('/transcriber')
  }

  // Fetch the task with full clip + dialect info
  const { data: task, error } = await supabase
    .from('tasks')
    .select(`
      id,
      task_type,
      status,
      claimed_by,
      claimed_at,
      expires_at,
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
    .eq('task_type', 'transcription')
    .single()

  if (error || !task) {
    notFound()
  }

  // @ts-ignore
  const clipRaw = task.audio_clips
  const clip = Array.isArray(clipRaw) ? clipRaw[0] : clipRaw

  if (!clip) {
    notFound()
  }

  // Enforce: transcriber cannot transcribe their own upload
  if (clip.uploader_id === session.user.id) {
    redirect('/transcriber')
  }

  // Task must be available or already claimed by this user
  if (!['available', 'claimed'].includes(task.status)) {
    redirect('/transcriber')
  }

  // If claimed by someone else, redirect
  if (task.status === 'claimed' && task.claimed_by !== session.user.id) {
    redirect('/transcriber')
  }

  // @ts-ignore
  const dialectRaw = clip.dialects
  const dialect = Array.isArray(dialectRaw) ? dialectRaw[0] : dialectRaw

  // Generate a signed URL for private bucket playback (2 hour TTL)
  let signedAudioUrl: string | null = null
  if (clip.audio_url) {
    const urlParts = clip.audio_url.split('/audio-staging/')
    const storagePath = urlParts[1] ?? ''
    if (storagePath) {
      const { data: signed } = await supabase.storage
        .from('audio-staging')
        .createSignedUrl(storagePath, 7200)
      signedAudioUrl = signed?.signedUrl ?? null
    }
  }

  // Fetch existing transcription draft if this user already started
  const { data: existingTranscription } = await supabase
    .from('transcriptions')
    .select('content, speaker_count, speaker_turns, tags')
    .eq('audio_clip_id', task.audio_clip_id)
    .eq('transcriber_id', session.user.id)
    .maybeSingle()

  const description = (clip.metadata as Record<string, string>)?.description ?? ''

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
      <Topbar
        title="Transcribe"
        subtitle={`${dialect?.name ?? 'Audio'} — Task ${taskId.slice(0, 8)}`}
      />
      <div className="container-modern py-8">
        <TranscriptionForm
          taskId={task.id}
          audioClipId={task.audio_clip_id}
          dialectName={dialect?.name ?? 'Unknown'}
          dialectCode={dialect?.code ?? ''}
          durationSeconds={clip.duration_seconds ?? 0}
          speakerCount={clip.speaker_count ?? 1}
          speakerGender={clip.speaker_gender ?? 'unknown'}
          speakerAgeRange={clip.speaker_age_range ?? 'unknown'}
          description={description}
          signedAudioUrl={signedAudioUrl}
          alreadyClaimed={task.status === 'claimed' && task.claimed_by === session.user.id}
          expiresAt={task.expires_at ?? null}
          expiryLabel={formatExpiry(task.expires_at)}
          initialContent={existingTranscription?.content ?? ''}
          initialSpeakerCount={existingTranscription?.speaker_count ?? clip.speaker_count ?? 1}
          initialSpeakerTurns={existingTranscription?.speaker_turns ?? 1}
          initialTags={existingTranscription?.tags ?? []}
        />
      </div>
    </>
  )
}
