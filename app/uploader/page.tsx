import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Topbar from '@/components/layouts/Topbar'
import AudioUploadForm from './components/AudioUploadForm'

export default async function UploaderPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .eq('role', 'uploader')
    .single()

  if (!roles) {
    return (
      <>
        <Topbar title="Upload Audio" subtitle="Contribute dialect recordings" />
        <div className="container-modern py-8">
          <div className="af-card p-6 border-l-4" style={{ borderColor: 'var(--af-warning)' }}>
            <div className="flex items-start gap-3">
              <svg className="h-5 w-5 mt-0.5 shrink-0" style={{ color: 'var(--af-warning)' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div>
                <h3 className="font-semibold" style={{ color: 'var(--af-txt)' }}>Access Denied</h3>
                <p className="text-sm mt-1" style={{ color: 'var(--af-muted)' }}>
                  You need the <strong>uploader</strong> role to access this page. Please contact an administrator to request access.
                </p>
              </div>
            </div>
          </div>
        </div>
      </>
    )
  }

  const { data: audioClips, error } = await supabase
    .from('audio_clips')
    .select('id, dialect_id, status, duration_seconds, created_at, dialects(name, code)')
    .eq('uploader_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const statusStyle: Record<string, string> = {
    uploaded: 'badge-primary',
    audio_qc: 'badge-warning',
    audio_rejected: 'badge-danger',
  }

  return (
    <>
      <Topbar title="Upload Audio" subtitle="Contribute dialect recordings to the dataset" />
      <div className="container-modern py-8 space-y-6">

        {/* Upload form */}
        <div className="af-card p-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>New Upload</h2>
          <AudioUploadForm />
        </div>

        {/* Guidelines */}
        <div className="af-card p-5 border-l-4" style={{ borderColor: 'var(--af-primary)' }}>
          <div className="flex items-start gap-3">
            <svg className="h-5 w-5 mt-0.5 shrink-0" style={{ color: 'var(--af-primary)' }} xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            <div>
              <h3 className="font-semibold mb-2" style={{ color: 'var(--af-txt)' }}>Upload Guidelines</h3>
              <ul className="text-sm space-y-1 list-disc list-inside" style={{ color: 'var(--af-muted)' }}>
                <li>Supported formats: MP3, WAV, M4A, OGG</li>
                <li>Maximum file size: 50 MB</li>
                <li>Target duration: 30–40 seconds (longer files will be chunked)</li>
                <li>Clear audio quality required — no background noise</li>
                <li>No copyrighted content (e.g. background music)</li>
                <li>No hate speech, threats, or explicit content</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Recent uploads */}
        <div className="af-card p-6">
          <h2 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>Recent Uploads</h2>

          {error && (
            <p className="text-sm" style={{ color: 'var(--af-danger)' }}>Error loading uploads: {error.message}</p>
          )}

          {audioClips && audioClips.length === 0 && (
            <div className="text-center py-12">
              <div className="text-4xl mb-3">🎙️</div>
              <p style={{ color: 'var(--af-muted)' }}>No uploads yet. Submit your first audio clip above.</p>
            </div>
          )}

          {audioClips && audioClips.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--af-line)' }}>
                    {['Dialect', 'Duration', 'Status', 'Uploaded'].map(h => (
                      <th key={h} className="text-left pb-3 pr-4 font-medium" style={{ color: 'var(--af-muted)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {audioClips.map((clip) => (
                    <tr key={clip.id} style={{ borderBottom: '1px solid var(--af-line)' }}>
                      <td className="py-3 pr-4 font-medium" style={{ color: 'var(--af-txt)' }}>
                        {/* @ts-ignore */}
                        {clip.dialects?.name || 'Unknown'}
                      </td>
                      <td className="py-3 pr-4" style={{ color: 'var(--af-muted)' }}>{clip.duration_seconds}s</td>
                      <td className="py-3 pr-4">
                        <span className={`badge ${statusStyle[clip.status] || 'badge-primary'}`}>
                          {clip.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="py-3" style={{ color: 'var(--af-muted)' }}>
                        {new Date(clip.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </>
  )
}
