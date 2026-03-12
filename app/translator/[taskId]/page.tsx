export const dynamic = 'force-dynamic'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect, notFound } from 'next/navigation'
import Topbar from '@/components/layouts/Topbar'
import TranslationForm from './components/TranslationForm'

interface Props {
  params: Promise<{ taskId: string }>
}

/**
 * Translation task detail page.
 * Fetches the task + clip + approved transcription, signs the audio URL,
 * then renders the client-side translation editor.
 */
export default async function TranslatorTaskPage({ params }: Props) {
  const { taskId } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/auth/login')
  }

  const admin = await createAdminClient()

  // Verify translator role
  const { data: role } = await admin
    .from('user_roles')
    .select('role')
    .eq('user_id', user.id)
    .eq('role', 'translator')
    .single()

  if (!role) {
    redirect('/translator')
  }

  // Fetch the task with full clip + dialect info
  const { data: task, error } = await admin
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
        uploader_id,
        dialects ( name, code )
      )
    `)
    .eq('id', taskId)
    .eq('task_type', 'translation')
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

  // Enforce: translator cannot translate their own upload
  if (clip.uploader_id === user.id) {
    redirect('/translator')
  }

  // Enforce: translator cannot translate a clip they transcribed
  const { data: ownTranscription } = await admin
    .from('transcriptions')
    .select('transcriber_id')
    .eq('audio_clip_id', task.audio_clip_id)
    .eq('transcriber_id', user.id)
    .maybeSingle()

  if (ownTranscription) {
    redirect('/translator')
  }

  // Task must be available or already claimed by this user
  if (!['available', 'claimed'].includes(task.status)) {
    redirect('/translator')
  }

  // If claimed by someone else, redirect
  if (task.status === 'claimed' && task.claimed_by !== user.id) {
    redirect('/translator')
  }

  // @ts-ignore
  const dialectRaw = clip.dialects
  const dialect = Array.isArray(dialectRaw) ? dialectRaw[0] : dialectRaw

  // Generate a signed URL for private bucket playback (2 hour TTL).
  // Must use admin client — translators have no storage SELECT RLS policy.
  let signedAudioUrl: string | null = null
  if (clip.audio_url) {
    const urlParts = clip.audio_url.split('/audio-staging/')
    const storagePath = urlParts[1] ?? ''
    if (storagePath) {
      const { data: signed, error: signError } = await admin.storage
        .from('audio-staging')
        .createSignedUrl(storagePath, 7200)
      if (signError) {
        console.error('[translator/taskId] createSignedUrl error:', signError)
      }
      signedAudioUrl = signed?.signedUrl ?? null
    }
  }

  // Fetch the approved transcription (source text for translation)
  const { data: transcription } = await admin
    .from('transcriptions')
    .select('content, speaker_count, speaker_turns, tags')
    .eq('audio_clip_id', task.audio_clip_id)
    .maybeSingle()

  // Fetch existing translation draft if this user already started
  const { data: existingTranslation } = await admin
    .from('translations')
    .select('content, speaker_turns')
    .eq('audio_clip_id', task.audio_clip_id)
    .eq('translator_id', user.id)
    .maybeSingle()

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
        title="Translate"
        subtitle={`${dialect?.name ?? 'Audio'} — Task ${taskId.slice(0, 8)}`}
      />
      <div className="container-modern py-8">
        <TranslationForm
          taskId={task.id}
          audioClipId={task.audio_clip_id}
          dialectName={dialect?.name ?? 'Unknown'}
          dialectCode={dialect?.code ?? ''}
          durationSeconds={clip.duration_seconds ?? 0}
          speakerCount={transcription?.speaker_count ?? clip.speaker_count ?? 1}
          speakerGender={clip.speaker_gender ?? 'unknown'}
          transcriptionContent={transcription?.content ?? ''}
          transcriptionTags={transcription?.tags ?? []}
          signedAudioUrl={signedAudioUrl}
          alreadyClaimed={task.status === 'claimed' && task.claimed_by === user.id}
          expiresAt={task.expires_at ?? null}
          expiryLabel={formatExpiry(task.expires_at)}
          initialContent={existingTranslation?.content ?? ''}
          initialSpeakerTurns={existingTranslation?.speaker_turns ?? transcription?.speaker_turns ?? 1}
        />
      </div>
    </>
  )
}
