import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Claim a transcription task.
 * Locks the task for 24 hours and marks it as claimed by the requesting user.
 *
 * Body: { taskId: string }
 *
 * Rules enforced:
 * - User must have the transcriber role.
 * - Task must be type "transcription" and status "available".
 * - User cannot claim a task for audio they uploaded (one-task-per-item).
 * - User cannot hold more than one claimed transcription task at a time.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await createAdminClient()

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
    const { taskId } = body

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    // Check user has no other active claimed transcription task
    const { data: existingClaim } = await admin
      .from('tasks')
      .select('id')
      .eq('task_type', 'transcription')
      .eq('status', 'claimed')
      .eq('claimed_by', user.id)
      .maybeSingle()

    if (existingClaim && existingClaim.id !== taskId) {
      return NextResponse.json(
        { error: 'You already have an active transcription task. Submit or wait for it to expire first.' },
        { status: 409 }
      )
    }

    // Fetch the task
    const { data: task, error: fetchError } = await admin
      .from('tasks')
      .select('id, task_type, status, audio_clip_id')
      .eq('id', taskId)
      .eq('task_type', 'transcription')
      .single()

    if (fetchError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (task.status !== 'available') {
      return NextResponse.json({ error: 'Task is no longer available' }, { status: 409 })
    }

    // Enforce: transcriber cannot transcribe their own upload
    const { data: clip, error: clipError } = await admin
      .from('audio_clips')
      .select('id, uploader_id')
      .eq('id', task.audio_clip_id)
      .single()

    if (clipError || !clip) {
      return NextResponse.json({ error: 'Audio clip not found' }, { status: 404 })
    }

    if (clip.uploader_id === user.id) {
      return NextResponse.json({ error: 'You cannot transcribe your own audio clip' }, { status: 403 })
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

    // Claim the task atomically
    const { error: updateError } = await admin
      .from('tasks')
      .update({
        status: 'claimed',
        claimed_by: user.id,
        claimed_at: now.toISOString(),
        expires_at: expiresAt,
        updated_at: now.toISOString(),
      })
      .eq('id', taskId)
      .eq('status', 'available') // race-condition guard

    if (updateError) {
      console.error('[transcription/claim] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to claim task — it may have been taken' }, { status: 409 })
    }

    // Audit log
    await admin.from('audit_logs').insert({
      user_id: user.id,
      action: 'claim_transcription_task',
      resource_type: 'task',
      resource_id: taskId,
      details: { audio_clip_id: task.audio_clip_id, expires_at: expiresAt },
    })

    return NextResponse.json({ success: true, expiresAt })
  } catch (err) {
    console.error('[transcription/claim] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
