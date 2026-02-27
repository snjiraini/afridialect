/**
 * Login Page - redesigned with AF design system
 */
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/hooks/useAuth'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (searchParams.get('email') || searchParams.get('password')) {
      setError('SECURITY WARNING: Never put credentials in URLs! Please clear your browser history.')
      router.replace('/auth/login')
    }
  }, [searchParams, router])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setError(null)
    setLoading(true)
    try {
      const { error: signInError } = await signIn(email, password)
      if (signInError) throw signInError
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sign in')
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
            Welcome back
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--af-muted)' }}>
            Sign in to your Afridialect account
          </p>
        </div>

        <div className="af-card p-8">
          {error && (
            <div className="mb-5 p-4 rounded-xl text-sm" style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} method="post" action="#" className="space-y-5">
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
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--af-muted)' }}>
                  Password
                </label>
                <Link href="/auth/reset-password" className="text-xs hover:underline" style={{ color: 'var(--af-primary)' }}>
                  Forgot password?
                </Link>
              </div>
              <input
                id="password" name="password" type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="af-input" placeholder="Enter your password"
              />
            </div>

            <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 text-base">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm mt-6" style={{ color: 'var(--af-muted)' }}>
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" className="font-semibold hover:underline" style={{ color: 'var(--af-primary)' }}>
              Create one
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--af-bg)' }}>
        <div className="text-sm" style={{ color: 'var(--af-muted)' }}>Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
