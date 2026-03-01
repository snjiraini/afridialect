import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Topbar from '@/components/layouts/Topbar'
import AudioQCForm from './components/AudioQCForm'
import TranscriptQCForm from './components/TranscriptQCForm'

interface Props {
  params: Promise<{ taskId: string }>
}

/**
 * Reviewer task detail page.
 * Handles both audio_qc and transcript_qc task types.
 * Routes to the correct form component based on task_type.
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

  // Fetch the task — accepts audio_qc OR transcript_qc
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
    .in('task_type', ['audio_qc', 'transcript_qc'])
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

  // @ts-ignore
  const description: string = clip.metadata?.description ?? ''

  // For transcript_qc: fetch the submitted transcription
  let transcriptionContent: string | null = null
  let transcriptionTags: string[] = []
  let transcriptionSpeakerCount: number = clip.speaker_count ?? 1
  let transcriptionSpeakerTurns: number = 1

  if (task.task_type === 'transcript_qc') {
    const { data: transcription } = await supabase
      .from('transcriptions')
      .select('content, tags, speaker_count, speaker_turns')
      .eq('audio_clip_id', task.audio_clip_id)
      .maybeSingle()

    transcriptionContent = transcription?.content ?? null
    transcriptionTags = transcription?.tags ?? []
    transcriptionSpeakerCount = transcription?.speaker_count ?? clip.speaker_count ?? 1
    transcriptionSpeakerTurns = transcription?.speaker_turns ?? 1

    // If no transcription found, this task is misconfigured — redirect
    if (!transcriptionContent) {
      redirect('/reviewer')
    }
  }

  const isTranscriptQC = task.task_type === 'transcript_qc'

  return (
    <>
      <Topbar
        title={isTranscriptQC ? 'Transcript QC' : 'Audio QC'}
        subtitle={`Reviewing: ${dialect?.name ?? 'Unknown dialect'} · ${taskId.slice(0, 8)}`}
      />
      <div className="container-modern py-8">
        {isTranscriptQC ? (
          <TranscriptQCForm
            taskId={task.id}
            audioClipId={clip.id}
            dialectName={dialect?.name ?? 'Unknown'}
            dialectCode={dialect?.code ?? ''}
            durationSeconds={clip.duration_seconds}
            speakerCount={transcriptionSpeakerCount}
            speakerTurns={transcriptionSpeakerTurns}
            speakerGender={clip.speaker_gender ?? 'unknown'}
            tags={transcriptionTags}
            transcriptionContent={transcriptionContent!}
            signedAudioUrl={signedAudioUrl}
          />
        ) : (
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
        )}
      </div>
    </>
  )
}
