'use client'

/**
 * Sidebar
 * Fixed left navigation panel — WhatsApp-Sender-Pro design system.
 *
 * Fixes applied:
 *  1. Z-index: zIndex 40 keeps sidebar above all page content (topbar is 30).
 *  2. Hydration: no theme-dependent class names emitted during SSR.
 *  3. Event bubbling: e.stopPropagation() on all interactive buttons.
 *  4. Null safety: user?.email guarded before every access.
 *  5. Modular role-based navigation: roles fetched lazily, graceful on error.
 */

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/hooks/useAuth'
import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

/* ── SVG icon helper ─────────────────────────────────────────────────────── */

function IC({ d, children }: { d?: string; children?: React.ReactNode }) {
  return (
    <svg
      className="w-[18px] h-[18px] stroke-current fill-none"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      {d ? <path d={d} /> : children}
    </svg>
  )
}

/* ── Icons ───────────────────────────────────────────────────────────────── */

function HomeIcon() {
  return <IC d="M3 10.5 12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5h-5.5v-7h-4v7H4.5A1.5 1.5 0 0 1 3 19.5z" />
}
function UploadIcon() {
  return (
    <IC>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </IC>
  )
}
function DocIcon() {
  return <IC d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2z" />
}
function TranslateIcon() {
  return (
    <IC>
      <circle cx="12" cy="12" r="10" />
      <path d="m4.93 4.93 14.14 14.14M15 9H9m3-3v6" />
    </IC>
  )
}
function ReviewIcon() {
  return (
    <IC>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
    </IC>
  )
}
function ShopIcon() {
  return (
    <IC>
      <circle cx="9" cy="21" r="1" />
      <circle cx="20" cy="21" r="1" />
      <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
    </IC>
  )
}
function AdminIcon() {
  return (
    <IC>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1 1.7 1.7 0 0 0-.3-1.8l-.1-.1A2 2 0 1 1 7 2.3l.1.1a1.7 1.7 0 0 0 1.8.3h0A1.7 1.7 0 0 0 10 1.2V1a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5h0a1.7 1.7 0 0 0 1.8-.3l.1-.1A2 2 0 1 1 21.7 7l-.1.1a1.7 1.7 0 0 0-.3 1.8v0a1.7 1.7 0 0 0 1.5 1H23a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </IC>
  )
}
function ProfileIcon() {
  return (
    <IC>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </IC>
  )
}
function MicIcon() {
  return <IC d="M19 11a7 7 0 0 1-7 7m0 0a7 7 0 0 1-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 0 1-3-3V5a3 3 0 1 1 6 0v6a3 3 0 0 1-3 3z" />
}
function SignOutIcon() {
  return (
    <IC>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </IC>
  )
}

/* ── Nav item definitions ─────────────────────────────────────────────────── */

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
  /** undefined = all authenticated users; array = at least one role required */
  roles?: string[]
}

const ALL_NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    href: '/dashboard',   icon: <HomeIcon />,      roles: undefined },
  { label: 'Upload Audio', href: '/uploader',    icon: <UploadIcon />,    roles: ['uploader', 'admin'] },
  { label: 'Transcribe',   href: '/transcriber', icon: <DocIcon />,       roles: ['transcriber', 'admin'] },
  { label: 'Translate',    href: '/translator',  icon: <TranslateIcon />, roles: ['translator', 'admin'] },
  { label: 'Review / QC',  href: '/reviewer',    icon: <ReviewIcon />,    roles: ['reviewer', 'admin'] },
  { label: 'Marketplace',  href: '/marketplace', icon: <ShopIcon />,      roles: undefined },
  { label: 'Admin',        href: '/admin',        icon: <AdminIcon />,     roles: ['admin'] },
  { label: 'Profile',      href: '/profile',      icon: <ProfileIcon />,   roles: undefined },
]

/* ── Utility ──────────────────────────────────────────────────────────────── */

function initials(name?: string | null, email?: string | null): string {
  if (name) {
    const parts = name.trim().split(/\s+/)
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : name.slice(0, 2).toUpperCase()
  }
  if (email) return email.slice(0, 2).toUpperCase()
  return 'AF'
}

/* ── Sidebar component ────────────────────────────────────────────────────── */

export default function Sidebar() {
  const { user, signOut }             = useAuth()
  const pathname                      = usePathname()
  const router                        = useRouter()
  const [userRoles, setUserRoles]     = useState<string[]>([])
  const [displayName, setDisplayName] = useState<string | null>(null)
  const [signingOut, setSigningOut]   = useState(false)

  /* Fetch profile + roles when user changes */
  useEffect(() => {
    if (!user?.id) {
      setUserRoles([])
      setDisplayName(null)
      return
    }
    let cancelled = false
    const supabase = createClient()
    ;(async () => {
      try {
        const [{ data: profile }, { data: roles }] = await Promise.all([
          supabase.from('profiles').select('full_name').eq('id', user.id).single(),
          supabase.from('user_roles').select('role').eq('user_id', user.id),
        ])
        if (cancelled) return
        setDisplayName(profile?.full_name ?? null)
        setUserRoles(roles?.map((r: { role: string }) => r.role) ?? [])
      } catch {
        /* graceful degradation */
      }
    })()
    return () => { cancelled = true }
  }, [user?.id])

  /**
   * Sign-out — fully isolated from parent click events.
   * type="button" + stopPropagation prevents any Link or container from firing.
   */
  const handleSignOut = useCallback(
    async (e: React.MouseEvent<HTMLButtonElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (signingOut) return
      setSigningOut(true)
      try {
        // signOut() performs a hard page navigation to /auth/login internally,
        // so no router call is needed here.
        await signOut()
      } catch (err) {
        console.error('[Sidebar] sign-out error:', err)
        setSigningOut(false)
      }
    },
    [signOut, router, signingOut]
  )

  const visibleNav = ALL_NAV_ITEMS.filter((item) => {
    if (!user) return false
    if (!item.roles) return true
    return item.roles.some((r) => userRoles.includes(r))
  })

  const avatarInitials = initials(displayName, user?.email ?? null)
  const firstName = displayName
    ? displayName.trim().split(/\s+/)[0]
    : (user?.email?.split('@')[0] ?? 'User')

  return (
    <aside
      aria-label="Main navigation"
      className="fixed left-0 top-0 h-screen flex flex-col gap-4 overflow-y-auto scrollbar-thin"
      style={{
        zIndex: 40,
        width: 'var(--af-sidebar-w)',
        background: 'linear-gradient(180deg, #161b22 0%, #0d1117 100%)',
        borderRight: '1px solid #30363d',
        color: 'var(--af-sidebar-text)',
        padding: '24px 16px',
        boxShadow: '4px 0 24px rgba(1, 4, 9, 0.5)',
        transition: 'background 0.4s ease',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-1 mb-1">
        <div className="w-9 h-9 rounded-xl overflow-hidden flex-shrink-0 shadow-inner" style={{ background: 'rgba(245, 166, 35, 0.12)', border: '1px solid rgba(245, 166, 35, 0.2)' }}>
          <Image
            src="/afridialect.svg"
            alt="Afridialect"
            width={36}
            height={36}
            className="w-full h-full object-contain"
            priority
          />
        </div>
        <div>
          <div className="font-bold text-base leading-tight" style={{ fontFamily: "'Comfortaa', system-ui, sans-serif", color: '#e6edf3' }}>
            Afridialect
          </div>
          <div className="text-[10px] leading-tight mt-0.5" style={{ color: '#6e7681' }}>
            African Speech Datasets
          </div>
        </div>
      </div>

      {/* User profile strip */}
      {user && (
        <div
          className="flex items-center gap-3 p-3 rounded-2xl flex-shrink-0"
          style={{ background: 'rgba(245, 166, 35, 0.08)', border: '1px solid rgba(245, 166, 35, 0.15)' }}
        >
          <div className="af-avatar w-10 h-10 text-sm flex-shrink-0" aria-hidden="true">
            {avatarInitials}
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate leading-tight" style={{ color: '#e6edf3' }}>{firstName}</div>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: '#3fb950' }} />
              <span className="text-[11px]" style={{ color: '#6e7681' }}>Active</span>
            </div>
          </div>
          {userRoles.length > 0 && (
            <span
              className="text-[10px] px-2 py-0.5 rounded-full font-semibold capitalize flex-shrink-0"
              style={{ background: 'rgba(245, 166, 35, 0.15)', color: '#f5a623', border: '1px solid rgba(245, 166, 35, 0.25)' }}
            >
              {userRoles[0]}
            </span>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 flex-1" aria-label="Site navigation">
        {!user ? (
          <>
            <Link href="/auth/login" className="af-nav-item">
              <HomeIcon />
              <span>Login</span>
            </Link>
            <Link href="/auth/signup" className="af-nav-item">
              <ProfileIcon />
              <span>Sign Up</span>
            </Link>
          </>
        ) : (
          visibleNav.map((item) => {
            const isActive =
              item.href === '/dashboard'
                ? pathname === '/dashboard'
                : !!pathname?.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`af-nav-item${isActive ? ' active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                {item.icon}
                <span className="flex-1">{item.label}</span>
                {isActive && (
                  <span
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: '#f5a623' }}
                  />
                )}
              </Link>
            )
          })
        )}
      </nav>

      {/* Footer */}
      <div
        className="flex items-center gap-2 pt-3 flex-shrink-0"
        style={{ borderTop: '1px solid #30363d' }}
      >
        {/* Sign-out button — standalone, NOT wrapped in any Link */}
        {user && (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            aria-label="Sign out of Afridialect"
            className="flex-1 flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium"
            style={{
              color: '#6e7681',
              background: 'transparent',
              border: 'none',
              transition: 'background 0.2s ease, color 0.2s ease',
              opacity: signingOut ? 0.55 : 1,
              cursor: signingOut ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!signingOut) {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'
                e.currentTarget.style.color = '#f87171'
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent'
              e.currentTarget.style.color = '#6e7681'
            }}
          >
            <SignOutIcon />
            <span>{signingOut ? 'Signing out…' : 'Sign Out'}</span>
          </button>
        )}
      </div>
    </aside>
  )
}


