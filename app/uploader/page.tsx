import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import AudioUploadForm from './components/AudioUploadForm'

export default async function UploaderPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    redirect('/auth/login')
  }

  // Check if user has uploader role
  const { data: roles } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', session.user.id)
    .eq('role', 'uploader')
    .single()

  if (!roles) {
    return (
      <div className="min-h-screen bg-gray-50 py-12">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">
                  Access Denied
                </h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <p>You need the <strong>uploader</strong> role to access this page.</p>
                  <p className="mt-1">Please contact an administrator to request access.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Get user's uploaded clips
  const { data: audioClips, error } = await supabase
    .from('audio_clips')
    .select('id, dialect_id, status, duration_seconds, created_at, dialects(name, code)')
    .eq('uploader_id', session.user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Upload Audio</h1>
          <p className="mt-2 text-gray-600">
            Upload audio clips in Kikuyu or Swahili. Files will be automatically chunked into 30-40 second segments.
          </p>
        </div>

        {/* Upload Form */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <AudioUploadForm />
        </div>

        {/* Recent Uploads */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Recent Uploads</h2>
          
          {error && (
            <div className="text-red-600 text-sm mb-4">
              Error loading uploads: {error.message}
            </div>
          )}

          {audioClips && audioClips.length === 0 && (
            <p className="text-gray-500 text-center py-8">
              No uploads yet. Upload your first audio clip above.
            </p>
          )}

          {audioClips && audioClips.length > 0 && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Dialect
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Duration
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Uploaded
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {audioClips.map((clip) => (
                    <tr key={clip.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {/* @ts-ignore */}
                        {clip.dialects?.name || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {clip.duration_seconds}s
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          clip.status === 'uploaded' ? 'bg-blue-100 text-blue-800' :
                          clip.status === 'audio_qc' ? 'bg-yellow-100 text-yellow-800' :
                          clip.status === 'audio_rejected' ? 'bg-red-100 text-red-800' :
                          'bg-green-100 text-green-800'
                        }`}>
                          {clip.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(clip.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Upload Guidelines */}
        <div className="mt-8 bg-blue-50 border-l-4 border-blue-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-blue-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Upload Guidelines</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Supported formats: MP3, WAV, M4A, OGG</li>
                  <li>Maximum file size: 50MB</li>
                  <li>Target duration: 30-40 seconds (longer files will be chunked)</li>
                  <li>Clear audio quality required</li>
                  <li>No copyrighted content (e.g., background music)</li>
                  <li>No hate speech, threats, or explicit content</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
