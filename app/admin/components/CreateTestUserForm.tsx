/**
 * Create Test User Form Component
 * Allows admins to create users with any email format for testing
 */

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function CreateTestUserForm() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    setLoading(true)

    try {
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName: fullName || 'Test User',
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      setSuccess(`User created: ${data.user.email} (ID: ${data.user.id})`)
      setEmail('')
      setPassword('')
      setFullName('')
      
      // Refresh the page to show new user
      setTimeout(() => {
        router.refresh()
      }, 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  const generateTestEmail = () => {
    const timestamp = Date.now()
    const random = Math.floor(Math.random() * 1000)
    // Use gmail.com as it has valid MX records
    setEmail(`test${timestamp}${random}@gmail.com`)
  }

  return (
    <div className="af-card p-6">
      <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--af-txt)' }}>
        Create Test User
      </h3>

      <div className="mb-4 p-3 rounded-xl" style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)' }}>
        <p className="text-sm font-semibold mb-2" style={{ color: '#fbbf24' }}>
          ⚠️ Email Domain Validation:
        </p>
        <ul className="text-xs space-y-1" style={{ color: '#a8b0d8' }}>
          <li>• Supabase validates email domains (checks DNS/MX records)</li>
          <li>• Use real domains: gmail.com, yahoo.com, outlook.com, etc.</li>
          <li>• Or use test services: mailinator.com, guerrillamail.com</li>
          <li>• Custom domains like @afridialect.ai need valid MX records</li>
        </ul>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--af-muted)' }}>
            Email *
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="test123@gmail.com"
              className="af-input flex-1"
              required
            />
            <button type="button" onClick={generateTestEmail} className="btn-secondary px-4 text-sm whitespace-nowrap">
              Generate
            </button>
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--af-muted)' }}>
            Use domains with valid MX records (gmail.com, yahoo.com, etc.)
          </p>
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--af-muted)' }}>
            Password *
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
            className="af-input"
            required
            minLength={8}
          />
        </div>

        <div>
          <label className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--af-muted)' }}>
            Full Name
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Test User (optional)"
            className="af-input"
          />
        </div>

        {error && (
          <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(239,68,68,0.1)', color: '#f87171', border: '1px solid rgba(239,68,68,0.2)' }}>
            ❌ {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl text-sm" style={{ background: 'rgba(16,185,129,0.1)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>
            ✅ {success}
          </div>
        )}

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2.5">
          {loading ? 'Creating...' : 'Create User'}
        </button>
      </form>
    </div>
  )
}
