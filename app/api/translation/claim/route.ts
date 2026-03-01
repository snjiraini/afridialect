import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

/**
 * Claim a translation task.
 * Locks the task for 24 hours to the current user.
 *
 * Body: { taskId }
 *
 * Enforces:
 * - translator role required
 * - no other active claimed translation task
 * - cannot claim own upload
 * - cannot claim a clip they transcribed
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

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
    const { taskId } = body

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    // Check user doesn't already have an active claimed translation task
    const { data: existingClaim } = await admin
      .from('tasks')
      .select('id')
      .eq('task_type', 'translation')
      .eq('status', 'claimed')
      .eq('claimed_by', user.id)
      .maybeSingle()

    if (existingClaim && existingClaim.id !== taskId) {
      return NextResponse.json(
        { error: 'You already have an active translation task. Complete or wait for it to expire first.' },
        { status: 409 }
      )
    }

    // Fetch the task
    const { data: task, error: fetchError } = await admin
      .from('tasks')
      .select('id, task_type, status, claimed_by, audio_clip_id')
      .eq('id', taskId)
      .eq('task_type', 'translation')
      .single()

    if (fetchError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    // Already claimed by this user — idempotent success
    if (task.status === 'claimed' && task.claimed_by === user.id) {
      return NextResponse.json({ success: true, alreadyClaimed: true })
    }

    if (task.status !== 'available') {
      return NextResponse.json({ error: 'Task is no longer available' }, { status: 409 })
    }

    // Enforce one-task-per-item: cannot translate own upload
    const { data: clip, error: clipError } = await admin
      .from('audio_clips')
      .select('id, uploader_id')
      .eq('id', task.audio_clip_id)
      .single()

    if (clipError || !clip) {
      return NextResponse.json({ error: 'Audio clip not found' }, { status: 404 })
    }

    if (clip.uploader_id === user.id) {
      return NextResponse.json({ error: 'You cannot translate your own audio clip' }, { status: 403 })
    }

    // Enforce one-task-per-item: cannot translate clip they transcribed
    const { data: ownTranscription } = await admin
      .from('transcriptions')
      .select('transcriber_id')
      .eq('audio_clip_id', task.audio_clip_id)
      .eq('transcriber_id', user.id)
      .maybeSingle()

    if (ownTranscription) {
      return NextResponse.json(
        { error: 'You cannot translate a clip you transcribed' },
        { status: 403 }
      )
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

    // Claim the task atomically — only succeed if still available
    const { data: updated, error: updateError } = await admin
      .from('tasks')
      .update({
        status:     'claimed',
        claimed_by: user.id,
        claimed_at: now.toISOString(),
        expires_at: expiresAt,
        updated_at: now.toISOString(),
      })
      .eq('id', taskId)
      .eq('status', 'available')
      .select('id')
      .maybeSingle()

    if (updateError) {
      console.error('[translation/claim] Update error:', updateError)
      return NextResponse.json({ error: 'Failed to claim task' }, { status: 500 })
    }

    if (!updated) {
      return NextResponse.json({ error: 'Task was claimed by another user. Please choose a different task.' }, { status: 409 })
    }

    // Audit log
    await admin.from('audit_logs').insert({
      user_id: user.id,
      action: 'claim_translation',
      resource_type: 'task',
      resource_id: taskId,
      details: {
        audio_clip_id: task.audio_clip_id,
        expires_at: expiresAt,
      },
    })

    return NextResponse.json({ success: true, expiresAt })
  } catch (err) {
    console.error('[translation/claim] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
