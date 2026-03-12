/**
 * Reset Password Request Page — dark SaaS design
 */

'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useAuth } from '@/hooks/useAuth'

export default function ResetPasswordPage() {
  const { resetPassword } = useAuth()
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setLoading(true)

    try {
      await resetPassword(email)
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send reset email')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={pageStyle}>
        <div style={glowTL} aria-hidden="true" />
        <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px' }}>
          <div style={{ ...card, textAlign: 'center' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#2dd4bf" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 style={{ ...heading, marginTop: 0 }}>Check your email</h2>
            <p style={{ ...subheading, marginBottom: '24px' }}>
              We&apos;ve sent reset instructions to <strong style={{ color: '#f7f8ff' }}>{email}</strong>
            </p>
            <Link href="/auth/login" style={linkBtn}>Return to login</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={pageStyle}>
      <div style={glowTL} aria-hidden="true" />
      <div style={glowBR} aria-hidden="true" />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px' }}>
        {/* Logo + wordmark */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <div style={logoWrap}>
              <Image src="/afridialect.svg" alt="Afridialect" width={40} height={40} style={{ objectFit: 'contain' }} priority />
            </div>
            <span style={wordmark}>Afridialect.ai</span>
          </Link>
          <h1 style={heading}>Reset your password</h1>
          <p style={subheading}>Enter your email and we&apos;ll send you reset instructions</p>
        </div>

        <div style={card}>
          {error && <div style={errorBox}>{error}</div>}

          <form style={{ display: 'flex', flexDirection: 'column', gap: '20px' }} onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" style={labelStyle}>Email address</label>
              <input
                id="email" name="email" type="email" autoComplete="email" required
                value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={inputStyle}
                onFocus={(e) => { e.currentTarget.style.borderColor = '#f5b55d'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,181,93,0.15)' }}
                onBlur={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'; e.currentTarget.style.boxShadow = 'none' }}
              />
            </div>

            <button type="submit" disabled={loading} style={submitBtn(loading)}>
              {loading ? 'Sending…' : 'Send reset instructions'}
            </button>

            <div style={{ textAlign: 'center' }}>
              <Link href="/auth/login" style={{ fontSize: '14px', color: '#2dd4bf', textDecoration: 'none' }}>
                ← Back to login
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}

/* ── Inline styles ────────────────────────────────────────────────────────── */

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '48px 16px',
  background: [
    'radial-gradient(circle at 0% 0%, rgba(244,172,84,0.18), transparent 55%)',
    'radial-gradient(circle at 100% 10%, rgba(45,212,191,0.12), transparent 55%)',
    'radial-gradient(circle at top, #121635 0, #050711 54%, #010108 100%)',
  ].join(', '),
  backgroundAttachment: 'fixed',
  fontFamily: 'system-ui,-apple-system,BlinkMacSystemFont,"SF Pro Text","Inter",sans-serif',
  position: 'relative', overflow: 'hidden',
  colorScheme: 'dark', WebkitFontSmoothing: 'antialiased',
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
  fontSize: '22px', fontWeight: 700, color: '#f7f8ff',
  fontFamily: "'Comfortaa', system-ui, sans-serif",
}

const subheading: React.CSSProperties = {
  fontSize: '14px', color: '#a8b0d8', margin: 0,
}

const card: React.CSSProperties = {
  background: 'rgba(7,11,26,0.96)', border: '1px solid rgba(255,255,255,0.06)',
  borderRadius: '24px', padding: '32px',
  backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
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
  transition: 'all 0.2s ease', opacity: disabled ? 0.7 : 1,
})

const linkBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '11px 24px', borderRadius: '999px',
  background: 'rgba(245,181,93,0.10)', border: '1px solid rgba(245,181,93,0.25)',
  color: '#f5b55d', fontWeight: 600, fontSize: '14px', textDecoration: 'none',
}
