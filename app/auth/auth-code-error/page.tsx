/**
 * Auth Code Error Page — dark SaaS design
 */

import Link from 'next/link'
import Image from 'next/image'

export default function AuthCodeErrorPage() {
  return (
    <div style={pageStyle}>
      <div style={glowCenter} aria-hidden="true" />

      <div style={{ position: 'relative', zIndex: 1, width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', textDecoration: 'none' }}>
            <div style={logoWrap}>
              <Image src="/afridialect.svg" alt="Afridialect" width={40} height={40} style={{ objectFit: 'contain' }} priority />
            </div>
            <span style={wordmark}>Afridialect.ai</span>
          </Link>
        </div>

        <div style={{ ...card, textAlign: 'center' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="#f85149" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#f85149', marginBottom: '8px', fontFamily: "'Inter', system-ui, sans-serif" }}>
            Authentication Error
          </h2>
          <p style={{ fontSize: '14px', color: '#6e7681', marginBottom: '16px' }}>
            We couldn&apos;t verify your authentication link. This may happen if:
          </p>
          <ul style={{ fontSize: '14px', color: '#8b949e', textAlign: 'left', display: 'inline-block', marginBottom: '24px', listStyle: 'none', padding: 0 }}>
            {['The link has expired', 'The link was already used', 'The link was invalid'].map((item) => (
              <li key={item} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <span style={{ color: '#f85149', fontSize: '16px', lineHeight: 1 }}>•</span>
                {item}
              </li>
            ))}
          </ul>
          <div>
            <Link href="/auth/login" style={linkBtn}>Return to login</Link>
          </div>
        </div>
      </div>
    </div>
  )
}

const pageStyle: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '48px 16px',
  background: '#0d1117',
  fontFamily: "'Inter', system-ui, -apple-system, sans-serif",
  position: 'relative', overflow: 'hidden',
}

const glowCenter: React.CSSProperties = {
  position: 'absolute', top: '10%', left: '50%', transform: 'translateX(-50%)',
  width: '600px', height: '400px',
  background: 'radial-gradient(circle, rgba(248,81,73,0.05) 0%, transparent 70%)',
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

const card: React.CSSProperties = {
  background: '#161b22', border: '1px solid rgba(248,81,73,0.2)',
  borderRadius: '16px', padding: '32px', backdropFilter: 'blur(12px)',
}

const linkBtn: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  padding: '11px 28px', borderRadius: '10px',
  background: 'linear-gradient(135deg, #f5a623, #e8960e)',
  color: '#0d1117', fontWeight: 700, fontSize: '14px', textDecoration: 'none',
  boxShadow: '0 4px 16px rgba(245,166,35,0.3)',
}
