/**
 * Login Page — dark SaaS design with logo and amber accent
 */
'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/hooks/useAuth'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [credsOpen, setCredsOpen] = useState(false)

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
    <div style={pageStyle}>
      {/* Subtle corner glows */}
      <div style={glowTL} aria-hidden="true" />
      <div style={glowBR} aria-hidden="true" />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px' }}>
        {/* Logo + wordmark */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <div style={logoWrap}>
              <Image src="/afridialect.svg" alt="Afridialect" width={40} height={40} style={{ objectFit: 'contain' }} priority />
            </div>
            <span style={wordmark}>Afridialect</span>
          </Link>
          <h1 style={heading}>Welcome back</h1>
          <p style={subheading}>Sign in to continue to your workspace</p>
        </div>

        {/* Card */}
        <div style={card}>
          {error && (
            <div style={errorBox}>{error}</div>
          )}

          <form onSubmit={handleSubmit} method="post" action="#" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div>
              <label htmlFor="email" style={labelStyle}>Email address</label>
              <input
                id="email" name="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#f5b55d'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,181,93,0.15)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow = 'none' }}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label htmlFor="password" style={labelStyle}>Password</label>
                <Link href="/auth/reset-password" style={{ fontSize: '12px', color: '#2dd4bf', textDecoration: 'none' }}>
                  Forgot password?
                </Link>              </div>
              <input
                id="password" name="password" type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#f5b55d'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,181,93,0.15)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow = 'none' }}
                placeholder="Enter your password"
              />
            </div>

            <button type="submit" disabled={loading} style={submitBtn(loading)}>
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p style={footerText}>
            Don&apos;t have an account?{' '}
            <Link href="/auth/signup" style={{ color: '#f5b55d', fontWeight: 600, textDecoration: 'none' }}>
              Create one
            </Link>
          </p>
        </div>

        {/* ── Test credentials panel ── */}
        <div style={{ marginTop: '28px' }}>
          <button
            type="button"
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setCredsOpen(o => !o) }}
            style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              width: '100%', padding: '12px 16px',
              borderRadius: '14px',
              border: '1px solid rgba(45,212,191,0.22)',
              background: 'rgba(45,212,191,0.06)',
              color: '#2dd4bf', fontSize: '12px', fontWeight: 600,
              textTransform: 'uppercase', letterSpacing: '0.12em',
              cursor: 'pointer', justifyContent: 'space-between',
              fontFamily: 'inherit', transition: 'background 160ms ease, border-color 160ms ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(45,212,191,0.10)'; e.currentTarget.style.borderColor = 'rgba(45,212,191,0.40)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(45,212,191,0.06)'; e.currentTarget.style.borderColor = 'rgba(45,212,191,0.22)' }}
          >
            <span>🧪 Test credentials</span>
            <span style={{ fontSize: '16px', lineHeight: 1 }}>{credsOpen ? '▲' : '▼'}</span>
          </button>

          {credsOpen && (
            <div style={{
              marginTop: '8px',
              borderRadius: '14px',
              border: '1px solid rgba(255,255,255,0.06)',
              background: 'rgba(7,11,26,0.97)',
              overflow: 'hidden',
            }}>
              {/* Header */}
              <div style={{
                display: 'grid', gridTemplateColumns: '96px 1fr',
                padding: '8px 14px', fontSize: '10px',
                textTransform: 'uppercase', letterSpacing: '0.13em',
                color: '#7c84af', borderBottom: '1px solid rgba(255,255,255,0.05)',
              }}>
                <span>Role</span>
                <span>Email · Password</span>
              </div>
              {[
                { role: 'Uploader',    email: 'uploader@afridialect.local',    password: 'UploaderPass123!',    color: '#f5b55d', bg: 'rgba(245,181,93,0.12)',   border: 'rgba(245,181,93,0.3)'  },
                { role: 'Transcriber', email: 'transcriber@afridialect.local', password: 'TranscriberPass123!', color: '#fb923c', bg: 'rgba(251,146,60,0.12)',   border: 'rgba(251,146,60,0.3)'  },
                { role: 'Translator',  email: 'translator@afridialect.local',  password: 'TranslatorPass123!',  color: '#a78bfa', bg: 'rgba(167,139,250,0.12)',  border: 'rgba(167,139,250,0.3)' },
                { role: 'Reviewer',    email: 'reviewer@afridialect.local',    password: 'ReviewerPass123!',    color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)',   border: 'rgba(45,212,191,0.3)'  },
                { role: 'Buyer',       email: 'buyer@afridialect.local',       password: 'BuyerPass123!',       color: '#60a5fa', bg: 'rgba(96,165,250,0.12)',   border: 'rgba(96,165,250,0.3)'  },
                { role: 'Admin',       email: 'admin@afridialect.local',       password: 'AdminPass123!',       color: '#f472b6', bg: 'rgba(244,114,182,0.12)',  border: 'rgba(244,114,182,0.3)' },
              ].map((cred, i, arr) => (
                <button
                  key={cred.role}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setEmail(cred.email)
                    setPassword(cred.password)
                    setCredsOpen(false)
                  }}
                  title={`Fill in ${cred.role} credentials`}
                  style={{
                    display: 'grid', gridTemplateColumns: '96px 1fr',
                    alignItems: 'center', width: '100%',
                    padding: '10px 14px', gap: '8px',
                    background: 'transparent', border: 'none',
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                    cursor: 'pointer', textAlign: 'left',
                    fontFamily: 'inherit', transition: 'background 120ms ease',
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
                >
                  <span style={{
                    display: 'inline-block', borderRadius: '999px',
                    padding: '2px 8px', fontSize: '10px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.1em',
                    background: cred.bg, color: cred.color,
                    border: `1px solid ${cred.border}`,
                  }}>{cred.role}</span>
                  <div>
                    <div style={{ fontSize: '11px', color: '#a8b0d8', fontFamily: 'monospace' }}>{cred.email}</div>
                    <div style={{ fontSize: '11px', color: '#f7f8ff', fontFamily: 'monospace', marginTop: '2px' }}>{cred.password}</div>
                  </div>
                </button>
              ))}
              <div style={{ padding: '8px 14px', fontSize: '10px', color: '#7c84af', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                Click any row to auto-fill the login form ↑
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Inline styles ────────────────────────────────────────────────────────── */

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '48px 16px',
  background: [
    'radial-gradient(circle at 0% 0%, rgba(244,172,84,0.18), transparent 55%)',
    'radial-gradient(circle at 100% 10%, rgba(45,212,191,0.12), transparent 55%)',
    'radial-gradient(circle at top, #121635 0, #050711 54%, #010108 100%)',
  ].join(', '),
  backgroundAttachment: 'fixed',
  fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",sans-serif',
  position: 'relative',
  overflow: 'hidden',
  colorScheme: 'dark',
  WebkitFontSmoothing: 'antialiased',
}

const glowTL: React.CSSProperties = {
  position: 'absolute', top: 0, left: 0, width: '600px', height: '600px',
  background: 'radial-gradient(circle, rgba(244,172,84,0.14) 0%, transparent 70%)',
  pointerEvents: 'none',
}

const glowBR: React.CSSProperties = {
  position: 'absolute', bottom: 0, right: 0, width: '600px', height: '600px',
  background: 'radial-gradient(circle, rgba(45,212,191,0.10) 0%, transparent 70%)',
  pointerEvents: 'none',
}

const logoWrap: React.CSSProperties = {
  width: '44px', height: '44px', borderRadius: '12px', overflow: 'hidden',
  background: 'rgba(245,181,93,0.10)', border: '1px solid rgba(245,181,93,0.22)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const wordmark: React.CSSProperties = {
  fontFamily: "'Comfortaa', system-ui, sans-serif",
  fontWeight: 700, fontSize: '20px', color: '#f7f8ff', letterSpacing: '0.04em',
}

const heading: React.CSSProperties = {
  marginTop: '24px', marginBottom: '6px',
  fontSize: '24px', fontWeight: 700, color: '#f7f8ff',
  fontFamily: "'Comfortaa', system-ui, sans-serif",
}

const subheading: React.CSSProperties = {
  fontSize: '14px', color: '#a8b0d8', margin: 0,
}

const card: React.CSSProperties = {
  background: 'rgba(7,11,26,0.96)',
  border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '24px',
  padding: '32px',
  backdropFilter: 'blur(20px)',
  WebkitBackdropFilter: 'blur(20px)',
  boxShadow: '0 24px 80px rgba(0,0,0,0.7)',
}

const errorBox: React.CSSProperties = {
  marginBottom: '20px', padding: '14px 16px',
  borderRadius: '12px', fontSize: '14px', color: '#f85149',
  background: 'rgba(248,81,73,0.10)', border: '1px solid rgba(248,81,73,0.2)',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '11px', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.12em',
  color: '#7c84af', marginBottom: '8px',
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '11px 14px',
  borderRadius: '12px', border: '1px solid rgba(255,255,255,0.10)',
  background: 'rgba(255,255,255,0.04)', color: '#f7f8ff', fontSize: '14px',
  fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  boxSizing: 'border-box',
}

const submitBtn = (disabled: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '100%', padding: '13px 20px',
  borderRadius: '999px', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
  background: disabled ? 'rgba(245,181,93,0.35)' : 'linear-gradient(135deg, #ff8b3d, #f5b55d)',
  color: '#0a0712', fontSize: '15px', fontWeight: 700,
  boxShadow: disabled ? 'none' : '0 16px 36px rgba(0,0,0,0.7)',
  transition: 'all 0.2s ease',
  opacity: disabled ? 0.7 : 1,
})

const footerText: React.CSSProperties = {
  textAlign: 'center', fontSize: '14px', color: '#a8b0d8',
  marginTop: '24px', marginBottom: 0,
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#050711' }}>
        <div style={{ fontSize: '14px', color: '#7c84af' }}>Loading…</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  )
}
