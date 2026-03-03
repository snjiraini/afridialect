/**
 * POST /api/admin/tasks/unlock
 * Admin override: unlock a claimed (or expired) task, returning it to 'available'.
 * Admin role required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = createAdminClient()

    const { data: roleRow } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (!roleRow) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    let body: { taskId?: string }
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    if (!body.taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }

    // Fetch the task to verify it exists and is in a lockable state
    const { data: task } = await admin
      .from('tasks')
      .select('id, status, task_type, audio_clip_id, claimed_by')
      .eq('id', body.taskId)
      .single()

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (task.status !== 'claimed') {
      return NextResponse.json(
        { error: `Task is in status '${task.status}' — only 'claimed' tasks can be unlocked` },
        { status: 409 },
      )
    }

    // Unlock: reset to available, clear claim fields
    const { error: updateError } = await admin
      .from('tasks')
      .update({
        status: 'available',
        claimed_by: null,
        claimed_at: null,
        expires_at: null,
      })
      .eq('id', body.taskId)

    if (updateError) {
      console.error('[api/admin/tasks/unlock]', updateError)
      return NextResponse.json({ error: 'Database error' }, { status: 500 })
    }

    // Revert clip status back to the "ready" state for this task type
    const clipStatusMap: Record<string, string> = {
      transcription:  'transcription_ready',
      transcript_qc:  'transcript_qc',
      translation:    'translation_ready',
      translation_qc: 'translation_qc',
      audio_qc:       'audio_qc',
    }
    const targetClipStatus = clipStatusMap[task.task_type]
    if (targetClipStatus && task.audio_clip_id) {
      await admin
        .from('audio_clips')
        .update({ status: targetClipStatus })
        .eq('id', task.audio_clip_id)
        .in('status', [
          'transcription_in_progress',
          'translation_in_progress',
        ])
    }

    // Audit log
    await admin.from('audit_logs').insert({
      user_id: user.id,
      action: 'admin_unlock_task',
      resource_type: 'task',
      resource_id: body.taskId,
      details: {
        task_type: task.task_type,
        previously_claimed_by: task.claimed_by,
      },
    })

    return NextResponse.json({ success: true, taskId: body.taskId })
  } catch (err) {
    console.error('[api/admin/tasks/unlock] Unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
