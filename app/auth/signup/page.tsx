/**
 * Signup Page - redesigned with AF design system
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

export default function SignupPage() {
  const router = useRouter()
  const { signUp } = useAuth()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (!fullName.trim()) { setError('Full name is required'); return }
    setLoading(true)
    try {
      const { error: signUpError } = await signUp(email, password, fullName)
      if (signUpError) {
        if (signUpError.message.includes('rate limit')) {
          setError('Too many signup attempts. Please try again later or use a different email.')
        } else if (signUpError.message.includes('already registered')) {
          setError('This email is already registered. Try logging in instead.')
        } else {
          setError(signUpError.message)
        }
        return
      }
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4" style={{ background: 'var(--af-bg)' }}>
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex w-14 h-14 rounded-2xl items-center justify-center mb-4 shadow-soft-lg"
            style={{ background: 'linear-gradient(135deg,var(--af-primary),var(--af-primary-soft))' }}>
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Lexend, sans-serif', color: 'var(--af-txt)' }}>
            Create your account
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--af-muted)' }}>
            Join the Afridialect community
          </p>
        </div>

        <div className="af-card p-8">
          {error && (
            <div className="mb-5 p-4 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="fullName" className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--af-muted)' }}>
                Full Name
              </label>
              <input
                id="fullName" name="fullName" type="text" autoComplete="name" required
                value={fullName} onChange={(e) => setFullName(e.target.value)}
                className="af-input" placeholder="Jane Wanjiru"
              />
            </div>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--af-muted)' }}>
                Email address
              </label>
              <input
                id="email" name="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="af-input" placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--af-muted)' }}>
                Password
              </label>
              <input
                id="password" name="password" type="password" autoComplete="new-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="af-input" placeholder="Min. 8 characters"
              />
            </div>
            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--af-muted)' }}>
                Confirm Password
              </label>
              <input
                id="confirmPassword" name="confirmPassword" type="password" autoComplete="new-password" required
                value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                className="af-input" placeholder="Repeat your password"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'var(--af-muted)' }}>
            Already have an account?{' '}
            <Link href="/auth/login" className="font-semibold hover:underline" style={{ color: 'var(--af-primary)' }}>
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
