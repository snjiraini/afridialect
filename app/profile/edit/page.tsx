/**
 * Edit Profile Page
 * Update user profile information
 */

'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { createClient } from '@/lib/supabase/client'

export default function EditProfilePage() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()
  
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Load current profile
  useEffect(() => {
    async function loadProfile() {
      if (!user) return

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name')
          .eq('id', user.id)
          .single()

        if (error) throw error

        setFullName(data.full_name || '')
      } catch (err) {
        console.error('Error loading profile:', err)
        setError(err instanceof Error ? err.message : 'Failed to load profile')
      } finally {
        setLoading(false)
      }
    }

    loadProfile()
  }, [user, supabase])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
        })
        .eq('id', user.id)

      if (error) throw error

      setSuccess(true)
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push('/profile')
      }, 2000)
    } catch (err) {
      console.error('Error updating profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="container-modern py-12">
        <div className="max-w-2xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 rounded-xl w-1/3" style={{ background: 'rgba(255,255,255,0.06)' }}></div>
            <div className="rounded-2xl p-6" style={{ background: 'rgba(12,16,32,0.92)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <div className="space-y-4">
                <div className="h-4 rounded w-1/4" style={{ background: 'rgba(255,255,255,0.06)' }}></div>
                <div className="h-10 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)' }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container-modern py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold" style={{ fontFamily: "'Lexend', sans-serif", color: '#f7f8ff' }}>
            Edit Profile
          </h1>
          <button
            type="button"
            onClick={() => router.push('/profile')}
            className="btn-ghost text-sm"
          >
            Cancel
          </button>
        </div>

        {success && (
          <div className="mb-6 p-4 rounded-xl text-sm" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
            ✅ Profile updated successfully! Redirecting...
          </div>
        )}

        {error && (
          <div className="mb-6 p-4 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            {error}
          </div>
        )}

        <div className="af-card p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="full-name" className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#7c84af' }}>
                Full Name
              </label>
              <input
                id="full-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="af-input"
                placeholder="Enter your full name"
              />
            </div>

            <div className="p-4 rounded-xl" style={{ background: 'rgba(45,212,191,0.06)', border: '1px solid rgba(45,212,191,0.12)' }}>
              <h3 className="font-semibold mb-2 text-sm" style={{ color: '#2dd4bf' }}>
                ℹ️ Note
              </h3>
              <ul className="text-sm space-y-1" style={{ color: '#7c84af' }}>
                <li>• Email address cannot be changed after registration</li>
                <li>• To change your password, use the "Change Password" link</li>
                <li>• Hedera account details are read-only for security</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <button type="submit" disabled={saving} className="btn-primary flex-1 justify-center py-2.5">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
              <button type="button" onClick={() => router.push('/profile')} className="btn-secondary px-5">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
