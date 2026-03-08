import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextRequest, NextResponse } from 'next/server'

const AUDIO_QC_REJECTION_REASONS = [
  'background_noise',
  'too_short',
  'clipping_distortion',
  'wrong_dialect',
  'multiple_speakers_unlabelled',
  'inaudible_content',
  'offensive_content',
  'not_speech',
  'poor_recording_quality',
  'other',
]

/**
 * Submit an Audio QC decision (approve or reject).
 *
 * Body: { taskId, decision: 'approve'|'reject', reasons?: string[], notes?: string }
 *
 * On approve → clip advances to transcription_ready; a transcription task is created.
 * On reject  → clip advances to audio_rejected; storage file is removed.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const admin = await createAdminClient()

    // Verify reviewer role
    const { data: role } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'reviewer')
      .single()

    if (!role) {
      return NextResponse.json({ error: 'Reviewer role required' }, { status: 403 })
    }

    const body = await request.json()
    const { taskId, decision, reasons = [], notes = '' } = body

    if (!taskId) {
      return NextResponse.json({ error: 'taskId is required' }, { status: 400 })
    }
    if (!['approve', 'reject'].includes(decision)) {
      return NextResponse.json({ error: 'decision must be "approve" or "reject"' }, { status: 400 })
    }
    if (decision === 'reject' && reasons.length === 0) {
      return NextResponse.json({ error: 'At least one rejection reason is required' }, { status: 400 })
    }

    // Validate reasons
    const invalidReasons = reasons.filter((r: string) => !AUDIO_QC_REJECTION_REASONS.includes(r))
    if (invalidReasons.length > 0) {
      return NextResponse.json({ error: `Invalid reason(s): ${invalidReasons.join(', ')}` }, { status: 400 })
    }

    // Fetch the task — must be audio_qc type, still available (unclaimed queue style)
    const { data: task, error: fetchError } = await admin
      .from('tasks')
      .select('id, task_type, status, audio_clip_id')
      .eq('id', taskId)
      .eq('task_type', 'audio_qc')
      .single()

    if (fetchError || !task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 })
    }

    if (!['available', 'claimed'].includes(task.status)) {
      return NextResponse.json({ error: 'Task has already been processed' }, { status: 409 })
    }

    // Enforce: reviewer cannot review their own upload
    const { data: clip, error: clipError } = await admin
      .from('audio_clips')
      .select('id, uploader_id, audio_url, status')
      .eq('id', task.audio_clip_id)
      .single()

    if (clipError || !clip) {
      return NextResponse.json({ error: 'Audio clip not found' }, { status: 404 })
    }

    if (clip.uploader_id === user.id) {
      return NextResponse.json({ error: 'You cannot review your own audio clip' }, { status: 403 })
    }

    const now = new Date().toISOString()

    // Record the QC review
    const { error: reviewError } = await admin
      .from('qc_reviews')
      .insert({
        audio_clip_id: task.audio_clip_id,
        reviewer_id: user.id,
        review_type: 'audio_qc',
        decision,
        reasons,
        notes: notes.trim() || null,
      })

    if (reviewError) {
      console.error('[audio-qc/submit] Review insert error:', reviewError)
      return NextResponse.json({ error: 'Failed to record review' }, { status: 500 })
    }

    // Mark the task as submitted
    const { error: taskUpdateError } = await admin
      .from('tasks')
      .update({ status: 'submitted', submitted_at: now, updated_at: now })
      .eq('id', taskId)

    if (taskUpdateError) {
      console.error('[audio-qc/submit] Task update error:', taskUpdateError)
      return NextResponse.json({ error: 'Failed to update task status' }, { status: 500 })
    }

    if (decision === 'approve') {
      // Advance clip to transcription_ready
      await admin
        .from('audio_clips')
        .update({ status: 'transcription_ready', approved_at: now, updated_at: now })
        .eq('id', task.audio_clip_id)

      // Create transcription task — upsert so re-approvals don't throw 23505
      const { error: transcriptionTaskError } = await admin
        .from('tasks')
        .upsert(
          {
            audio_clip_id: task.audio_clip_id,
            task_type: 'transcription',
            status: 'available',
          },
          { onConflict: 'audio_clip_id,task_type', ignoreDuplicates: true }
        )

      if (transcriptionTaskError) {
        // Non-fatal: log but don't fail the decision
        console.error('[audio-qc/submit] Transcription task creation failed:', transcriptionTaskError)
      }
    } else {
      // Reject: advance clip to audio_rejected
      await admin
        .from('audio_clips')
        .update({ status: 'audio_rejected', rejected_at: now, updated_at: now })
        .eq('id', task.audio_clip_id)
    }

    // Audit log
    await admin.from('audit_logs').insert({
      user_id: user.id,
      action: decision === 'approve' ? 'approve_audio_qc' : 'reject_audio_qc',
      resource_type: 'task',
      resource_id: taskId,
      details: {
        audio_clip_id: task.audio_clip_id,
        decision,
        reasons,
        notes: notes.trim() || null,
      },
    })

    return NextResponse.json({ success: true, decision })
  } catch (err) {
    console.error('[audio-qc/submit] Error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
