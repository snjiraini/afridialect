import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { v4 as uuidv4 } from 'uuid'

// Audio constraints from system config
const MIN_DURATION_SECONDS = 30
const MAX_DURATION_SECONDS = 40
const MAX_FILE_SIZE_MB = 50
const SUPPORTED_FORMATS = ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/mp4', 'audio/x-m4a', 'audio/ogg', 'audio/webm']

/**
 * Get audio duration from file buffer
 * Note: This is a simplified version. For production, consider using a library like ffprobe
 */
async function getAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const audio = new Audio()
    const url = URL.createObjectURL(file)
    
    audio.addEventListener('loadedmetadata', () => {
      URL.revokeObjectURL(url)
      resolve(audio.duration)
    })
    
    audio.addEventListener('error', () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load audio metadata'))
    })
    
    audio.src = url
  })
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { session } } = await supabase.auth.getSession()

    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has uploader role
    const { data: role } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'uploader')
      .single()

    if (!role) {
      return NextResponse.json(
        { error: 'You must have the uploader role to upload audio' },
        { status: 403 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const dialect = formData.get('dialect') as string
    const description = formData.get('description') as string
    const speakerCount = parseInt(formData.get('speakerCount') as string) || 1
    const speakerGender = formData.get('speakerGender') as string || 'unknown'
    const speakerAgeRange = formData.get('speakerAgeRange') as string || 'adult'

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!dialect) {
      return NextResponse.json({ error: 'Dialect is required' }, { status: 400 })
    }

    if (!description || description.trim().length === 0) {
      return NextResponse.json({ error: 'Description is required' }, { status: 400 })
    }

    // Validate file type
    if (!SUPPORTED_FORMATS.includes(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file format: ${file.type}. Supported: MP3, WAV, M4A, OGG` },
        { status: 400 }
      )
    }

    // Validate file size
    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      return NextResponse.json(
        { error: `File size (${fileSizeMB.toFixed(2)}MB) exceeds ${MAX_FILE_SIZE_MB}MB limit` },
        { status: 400 }
      )
    }

    // Get dialect ID
    const { data: dialectData, error: dialectError } = await supabase
      .from('dialects')
      .select('id')
      .eq('code', dialect)
      .single()

    if (dialectError || !dialectData) {
      return NextResponse.json(
        { error: 'Invalid dialect' },
        { status: 400 }
      )
    }

    // Get file extension
    const fileExtension = file.name.split('.').pop() || 'mp3'
    
    // Generate unique clip ID
    const clipId = uuidv4()
    
    // Create storage path: {user_id}/{clip_id}.{ext}
    const storagePath = `${session.user.id}/${clipId}.${fileExtension}`

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
      .storage
      .from('audio-staging')
      .upload(storagePath, file, {
        contentType: file.type,
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { error: `Upload failed: ${uploadError.message}` },
        { status: 500 }
      )
    }

    // Get public URL
    const { data: { publicUrl } } = supabase
      .storage
      .from('audio-staging')
      .getPublicUrl(storagePath)

    // TODO: Get actual audio duration (requires server-side audio processing)
    // For now, we'll set a placeholder and update later
    const duration = 35 // Placeholder

    // Create database record
    const { data: clipData, error: clipError } = await supabase
      .from('audio_clips')
      .insert({
        id: clipId,
        uploader_id: session.user.id,
        dialect_id: dialectData.id,
        audio_url: publicUrl,
        duration_seconds: duration,
        sample_rate: 44100, // Placeholder
        file_size_bytes: file.size,
        speaker_count: speakerCount,
        speaker_gender: speakerGender,
        speaker_age_range: speakerAgeRange,
        status: 'uploaded',
        metadata: {
          description,
          original_filename: file.name,
          mime_type: file.type
        }
      })
      .select()
      .single()

    if (clipError) {
      console.error('Database error:', clipError)
      
      // Clean up uploaded file
      await supabase.storage.from('audio-staging').remove([storagePath])
      
      return NextResponse.json(
        { error: `Database error: ${clipError.message}` },
        { status: 500 }
      )
    }

    // Log audit trail
    await supabase.from('audit_logs').insert({
      user_id: session.user.id,
      action: 'audio_upload',
      resource_type: 'audio_clip',
      resource_id: clipId,
      details: {
        dialect,
        file_size_mb: fileSizeMB.toFixed(2),
        duration_seconds: duration
      }
    })

    // Create audio_qc task so reviewers can pick it up immediately
    const { error: qcTaskError } = await supabase
      .from('tasks')
      .insert({
        audio_clip_id: clipId,
        task_type: 'audio_qc',
        status: 'available',
      })

    if (qcTaskError) {
      // Non-fatal: task can be created manually; don't fail the upload
      console.error('[audio/upload] audio_qc task creation failed:', qcTaskError)
    } else {
      // Advance clip status so the state machine is consistent
      await supabase
        .from('audio_clips')
        .update({ status: 'audio_qc', updated_at: new Date().toISOString() })
        .eq('id', clipId)
    }

    // TODO: Implement chunking logic if duration > MAX_DURATION_SECONDS
    // For Phase 4.1, we'll accept files as-is and add chunking in Phase 4.3

    return NextResponse.json({
      success: true,
      clipId: clipData.id,
      message: 'Audio uploaded successfully',
      chunksCreated: 1, // Will be > 1 when chunking is implemented
      clip: {
        id: clipData.id,
        status: clipData.status,
        duration: duration
      }
    })

  } catch (error) {
    console.error('Audio upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
