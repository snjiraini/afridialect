/**
 * Signup Page — dark SaaS design with logo and amber accent
 */
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
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
    <div style={pageStyle}>
      {/* Subtle corner glows */}
      <div style={glowTR} aria-hidden="true" />
      <div style={glowBL} aria-hidden="true" />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px' }}>
        {/* Logo + wordmark */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <div style={logoWrap}>
              <Image src="/afridialect.svg" alt="Afridialect" width={40} height={40} style={{ objectFit: 'contain' }} priority />
            </div>
            <span style={wordmark}>Afridialect.ai</span>
          </Link>
          <h1 style={heading}>Create your account</h1>
          <p style={subheading}>Join the Afridialect community today</p>
        </div>

        {/* Card */}
        <div style={card}>
          {error && (
            <div style={errorBox}>{error}</div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {[
              { id: 'fullName', label: 'Full Name', type: 'text', autoComplete: 'name', value: fullName, setter: setFullName, placeholder: 'Jane Wanjiru' },
              { id: 'email', label: 'Email Address', type: 'email', autoComplete: 'email', value: email, setter: setEmail, placeholder: 'you@example.com' },
              { id: 'password', label: 'Password', type: 'password', autoComplete: 'new-password', value: password, setter: setPassword, placeholder: 'Min. 8 characters' },
              { id: 'confirmPassword', label: 'Confirm Password', type: 'password', autoComplete: 'new-password', value: confirmPassword, setter: setConfirmPassword, placeholder: 'Repeat your password' },
            ].map(({ id, label, type, autoComplete, value, setter, placeholder }) => (
              <div key={id}>
                <label htmlFor={id} style={labelStyle}>{label}</label>
                <input
                  id={id} name={id} type={type} autoComplete={autoComplete} required
                  value={value} onChange={(e) => setter(e.target.value)}
                  placeholder={placeholder}
                  style={inputStyle}
                  onFocus={(e) => { e.currentTarget.style.borderColor = '#f5a623'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(245,166,35,0.15)' }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = '#30363d'; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            ))}

            <button type="submit" disabled={loading} style={submitBtn(loading)}>
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p style={footerText}>
            Already have an account?{' '}
            <Link href="/auth/login" style={{ color: '#f5a623', fontWeight: 600, textDecoration: 'none' }}>
              Sign in
            </Link>
          </p>
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
  background: '#0d1117',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  position: 'relative',
  overflow: 'hidden',
}

const glowTR: React.CSSProperties = {
  position: 'absolute', top: 0, right: 0, width: '500px', height: '500px',
  background: 'radial-gradient(circle, rgba(245,166,35,0.06) 0%, transparent 70%)',
  pointerEvents: 'none',
}

const glowBL: React.CSSProperties = {
  position: 'absolute', bottom: 0, left: 0, width: '500px', height: '500px',
  background: 'radial-gradient(circle, rgba(45,212,191,0.05) 0%, transparent 70%)',
  pointerEvents: 'none',
}

const logoWrap: React.CSSProperties = {
  width: '44px', height: '44px', borderRadius: '12px', overflow: 'hidden',
  background: 'rgba(245,166,35,0.1)', border: '1px solid rgba(245,166,35,0.2)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
}

const wordmark: React.CSSProperties = {
  fontFamily: "'Comfortaa', system-ui, sans-serif",
  fontWeight: 700, fontSize: '20px', color: '#e6edf3',
}

const heading: React.CSSProperties = {
  marginTop: '24px', marginBottom: '6px',
  fontSize: '24px', fontWeight: 700, color: '#e6edf3',
  fontFamily: "'Inter', system-ui, sans-serif",
}

const subheading: React.CSSProperties = {
  fontSize: '14px', color: '#6e7681', margin: 0,
}

const card: React.CSSProperties = {
  background: '#161b22',
  border: '1px solid #30363d',
  borderRadius: '16px',
  padding: '32px',
  backdropFilter: 'blur(12px)',
}

const errorBox: React.CSSProperties = {
  marginBottom: '20px', padding: '14px 16px',
  borderRadius: '10px', fontSize: '14px', color: '#f85149',
  background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)',
}

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: '12px', fontWeight: 600,
  textTransform: 'uppercase', letterSpacing: '0.05em',
  color: '#8b949e', marginBottom: '8px',
}

const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '11px 14px',
  borderRadius: '10px', border: '1px solid #30363d',
  background: '#0d1117', color: '#e6edf3', fontSize: '14px',
  fontFamily: 'inherit', outline: 'none',
  transition: 'border-color 0.2s, box-shadow 0.2s',
  boxSizing: 'border-box',
}

const submitBtn = (disabled: boolean): React.CSSProperties => ({
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  width: '100%', padding: '13px 20px', marginTop: '4px',
  borderRadius: '10px', border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
  background: disabled ? 'rgba(245,166,35,0.4)' : 'linear-gradient(135deg, #f5a623, #e8960e)',
  color: '#0d1117', fontSize: '15px', fontWeight: 700,
  boxShadow: disabled ? 'none' : '0 4px 16px rgba(245,166,35,0.3)',
  transition: 'all 0.2s ease',
  opacity: disabled ? 0.7 : 1,
})

const footerText: React.CSSProperties = {
  textAlign: 'center', fontSize: '14px', color: '#6e7681',
  marginTop: '24px', marginBottom: 0,
}
