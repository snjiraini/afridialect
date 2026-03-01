import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Submit a completed transcription.
 * Upserts the transcription record and advances the audio clip to transcript_qc.
 * Creates a transcript_qc task for reviewers.
 *
 * Body:
 *   taskId       - string
 *   audioClipId  - string
 *   content      - string (verbatim transcription text)
 *   speakerCount - number
 *   speakerTurns - number
 *   tags         - string[]  (e.g. ['[laughter]', '[silence]'])
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Verify transcriber role
    const { data: role } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'transcriber')
      .single()

    if (!role) {
      return NextResponse.json({ error: 'Transcriber role required' }, { status: 403 })
    }

    const body = await request.json()
    const {
      taskId,
      audioClipId,
      content,
      speakerCount = 1,
      speakerTurns = 1,
      tags = [],
    } = body

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }
    if (!audioClipId) {
      return NextResponse.json({ error: 'audioClipId is required' }, { status: 400 })
    }
    if (!content || typeof content !== 'string' || content.trim().length < 10) {
      return NextResponse.json({ error: 'Transcription content is too short or missing' }, { status: 400 })
    }

    // Fetch the task — must be transcription type, claimed by this user
    const { data: task, error: fetchError } = await admin
      .from('tasks')
      .select('id, task_type, status, claimed_by, audio_clip_id, expires_at')
      .eq('id', taskId)
      .eq('task_type', 'transcription')
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

    // Verify clip belongs to this task and user is not the uploader
    const { data: clip, error: clipError } = await admin
      .from('audio_clips')
      .select('id, uploader_id, status')
      .eq('id', task.audio_clip_id)
      .single()

    if (clipError || !clip) {
      return NextResponse.json({ error: 'Audio clip not found' }, { status: 404 })
    }

    if (clip.uploader_id === user.id) {
      return NextResponse.json({ error: 'You cannot transcribe your own audio clip' }, { status: 403 })
    }

    const now = new Date().toISOString()

    // Upsert transcription record
    const { error: transcriptionError } = await admin
      .from('transcriptions')
      .upsert(
        {
          audio_clip_id: task.audio_clip_id,
          transcriber_id: user.id,
          content: content.trim(),
          speaker_count: speakerCount,
          speaker_turns: speakerTurns,
          tags,
          updated_at: now,
        },
        { onConflict: 'audio_clip_id' }
      )

    if (transcriptionError) {
      console.error('[transcription/submit] Transcription upsert error:', transcriptionError)
      return NextResponse.json({ error: 'Failed to save transcription' }, { status: 500 })
    }

    // Mark task as submitted
    const { error: taskUpdateError } = await admin
      .from('tasks')
      .update({ status: 'submitted', submitted_at: now, updated_at: now })
      .eq('id', taskId)

    if (taskUpdateError) {
      console.error('[transcription/submit] Task update error:', taskUpdateError)
      return NextResponse.json({ error: 'Failed to update task status' }, { status: 500 })
    }

    // Advance clip to transcript_qc
    await admin
      .from('audio_clips')
      .update({ status: 'transcript_qc', updated_at: now })
      .eq('id', task.audio_clip_id)

    // Create the transcript_qc task for reviewers
    const { error: qcTaskError } = await admin
      .from('tasks')
      .insert({
        audio_clip_id: task.audio_clip_id,
        task_type: 'transcript_qc',
        status: 'available',
      })

    if (qcTaskError) {
      // Non-fatal: log but don't fail the submission
      console.error('[transcription/submit] QC task creation failed:', qcTaskError)
    }

    // Audit log
    await admin.from('audit_logs').insert({
      user_id: user.id,
      action: 'submit_transcription',
      resource_type: 'task',
      resource_id: taskId,
      details: {
        audio_clip_id: task.audio_clip_id,
        content_length: content.trim().length,
        speaker_count: speakerCount,
        speaker_turns: speakerTurns,
        tags,
      },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[transcription/submit] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
