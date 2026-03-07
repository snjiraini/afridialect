import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Submit a completed translation.
 * Upserts the translation record and advances the audio clip to translation_qc.
 * Creates a translation_qc task for reviewers.
 *
 * Body:
 *   taskId        - string
 *   audioClipId   - string
 *   content       - string (English translation text)
 *   speakerTurns  - number
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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
      return NextResponse.json({ error: 'Translator role required' }, { status: 403 })
    }

    const body = await request.json()
    const {
      taskId,
      audioClipId,
      content,
      speakerTurns = 1,
    } = body

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }
    if (!audioClipId) {
      return NextResponse.json({ error: 'audioClipId is required' }, { status: 400 })
    }
    if (!content || typeof content !== 'string' || content.trim().length < 10) {
      return NextResponse.json({ error: 'Translation content is too short or missing' }, { status: 400 })
    }

    // Fetch the task — must be translation type, claimed by this user
    const { data: task, error: fetchError } = await admin
      .from('tasks')
      .select('id, task_type, status, claimed_by, audio_clip_id, expires_at')
      .eq('id', taskId)
      .eq('task_type', 'translation')
      .single()

    if (fetchError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (task.status !== 'claimed') {
      return NextResponse.json({ error: 'Task is not in claimed state' }, { status: 409 })
    }

    if (task.claimed_by !== user.id) {
      return NextResponse.json({ error: 'You have not claimed this task' }, { status: 403 })
    }

    // Check claim has not expired
    if (task.expires_at && new Date(task.expires_at) < new Date()) {
      return NextResponse.json({ error: 'Your claim has expired. The task has been released.' }, { status: 409 })
    }

    // Verify clip belongs to this task and user is not the uploader or transcriber
    const { data: clip, error: clipError } = await admin
      .from('audio_clips')
      .select('id, uploader_id, status')
      .eq('id', task.audio_clip_id)
      .single()

    if (clipError || !clip) {
      return NextResponse.json({ error: 'Audio clip not found' }, { status: 404 })
    }

    if (clip.uploader_id === user.id) {
      return NextResponse.json({ error: 'You cannot translate your own audio clip' }, { status: 403 })
    }

    const { data: ownTranscription } = await admin
      .from('transcriptions')
      .select('transcriber_id')
      .eq('audio_clip_id', task.audio_clip_id)
      .eq('transcriber_id', user.id)
      .maybeSingle()

    if (ownTranscription) {
      return NextResponse.json({ error: 'You cannot translate a clip you transcribed' }, { status: 403 })
    }

    const now = new Date().toISOString()

    // Upsert translation record
    const { error: translationError } = await admin
      .from('translations')
      .upsert(
        {
          audio_clip_id: task.audio_clip_id,
          translator_id: user.id,
          content: content.trim(),
          speaker_turns: speakerTurns,
          updated_at: now,
        },
        { onConflict: 'audio_clip_id' }
      )

    if (translationError) {
      console.error('[translation/submit] Translation upsert error:', translationError)
      return NextResponse.json({ error: 'Failed to save translation' }, { status: 500 })
    }

    // Mark task as submitted
    const { error: taskUpdateError } = await admin
      .from('tasks')
      .update({ status: 'submitted', submitted_at: now, updated_at: now })
      .eq('id', taskId)

    if (taskUpdateError) {
      console.error('[translation/submit] Task update error:', taskUpdateError)
      return NextResponse.json({ error: 'Failed to update task status' }, { status: 500 })
    }

    // Advance clip to translation_qc
    await admin
      .from('audio_clips')
      .update({ status: 'translation_qc', updated_at: now })
      .eq('id', task.audio_clip_id)

    // Create translation_qc task for reviewer queue
    const { error: qcTaskError } = await admin
      .from('tasks')
      .insert({
        audio_clip_id: task.audio_clip_id,
        task_type: 'translation_qc',
        status: 'available',
      })

    if (qcTaskError) {
      console.error('[translation/submit] translation_qc task creation failed:', qcTaskError)
    }

    // Audit log
    await admin.from('audit_logs').insert({
      user_id: user.id,
      action: 'submit_translation',
      resource_type: 'task',
      resource_id: taskId,
      details: {
        audio_clip_id: task.audio_clip_id,
        word_count: content.trim().split(/\s+/).length,
        speaker_turns: speakerTurns,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[translation/submit] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
