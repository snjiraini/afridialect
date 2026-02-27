'use client'

/**
 * Topbar
 * Horizontal bar at the top of each page (inside the main content area).
 * - Page title / breadcrumb
 * - Notification bell
 * - User avatar pill
 * Sits BELOW the sidebar in the layout tree; no z-index conflicts with Sidebar.
 */

import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'

interface TopbarProps {
  title?: string
  subtitle?: string
}

const BellIcon = () => (
  <svg className="w-5 h-5 stroke-current fill-none stroke-2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/>
    <path d="M13.7 21a2 2 0 0 1-3.4 0"/>
  </svg>
)

function initials(email?: string | null): string {
  if (!email) return 'AF'
  return email.slice(0, 2).toUpperCase()
}

export default function Topbar({ title, subtitle }: TopbarProps) {
  const { user } = useAuth()

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-4 px-6"
      style={{
        height: 'var(--af-topbar-h)',
        background: 'var(--af-panel)',
        borderBottom: '1px solid var(--af-line)',
        transition: 'background 0.3s ease, border-color 0.3s ease',
      }}
    >
      {/* Title */}
      <div className="flex-1 min-w-0">
        {title && (
          <h2
            className="text-base font-semibold truncate"
            style={{ color: 'var(--af-txt)', fontFamily: 'Lexend, sans-serif' }}
          >
            {title}
          </h2>
        )}
        {subtitle && (
          <p className="text-xs truncate mt-0.5" style={{ color: 'var(--af-muted)' }}>
            {subtitle}
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Notification bell */}
        <button
          type="button"
          className="relative af-icon-btn"
          aria-label="Notifications"
        >
          <BellIcon />
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2"
            style={{
              background: '#ef4444',
              borderColor: 'var(--af-panel)',
            }}
          />
        </button>

        {/* User avatar */}
        {user && (
          <Link
            href="/profile"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-200 hover:opacity-80"
            style={{
              background: 'var(--af-item-hover)',
            }}
          >
            <div
              className="af-avatar w-7 h-7 text-xs"
              aria-label="Go to profile"
            >
              {initials(user.email)}
            </div>
            <span
              className="text-sm font-medium max-w-[120px] truncate hidden lg:block"
              style={{ color: 'var(--af-txt)' }}
            >
              {user.email?.split('@')[0]}
            </span>
          </Link>
        )}
      </div>
    </header>
  )
}
