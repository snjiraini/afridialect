'use client'

/**
 * Topbar
 * Sticky header inside the main content area.
 *
 * Z-index: 30 (below sidebar at 40, above page content at 0).
 * Sits entirely in the content area (margin-left: var(--af-sidebar-w)).
 * No z-index conflict with Sidebar because Topbar is never positioned
 * above the sidebar column — it starts at the sidebar's right edge.
 */

import { useAuth } from '@/hooks/useAuth'
import Link from 'next/link'

interface TopbarProps {
  title?: string
  subtitle?: string
}

const BellIcon = () => (
  <svg
    className="w-5 h-5 stroke-current fill-none"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    viewBox="0 0 24 24"
    aria-hidden="true"
  >
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
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
      className="sticky top-0 flex items-center gap-4 px-6"
      style={{
        height: 'var(--af-topbar-h)',
        /*
         * Z-index 30: below sidebar (40) so sidebar shadow renders on top
         * when sidebar overlaps the topbar corner.
         * Above page body content (0).
         */
        zIndex: 30,
        background: 'var(--af-panel)',
        borderBottom: '1px solid var(--af-line)',
        transition: 'background 0.3s ease, border-color 0.3s ease',
        /* Prevent content from bleeding under the topbar on scroll */
        backdropFilter: 'none',
      }}
    >
      {/* Page title */}
      <div className="flex-1 min-w-0">
        {title && (
          <h1
            className="text-base font-semibold truncate leading-tight"
            style={{ color: 'var(--af-txt)', fontFamily: 'Lexend, sans-serif' }}
          >
            {title}
          </h1>
        )}
        {subtitle && (
          <p
            className="text-xs truncate mt-0.5"
            style={{ color: 'var(--af-muted)' }}
          >
            {subtitle}
          </p>
        )}
      </div>

      {/* Right-side actions */}
      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Notification bell */}
        <button
          type="button"
          className="relative af-icon-btn"
          aria-label="Notifications"
          onClick={(e) => e.stopPropagation()}
        >
          <BellIcon />
          {/* Red dot indicator */}
          <span
            className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full border-2"
            style={{
              background: '#ef4444',
              borderColor: 'var(--af-panel)',
            }}
            aria-hidden="true"
          />
        </button>

        {/* User avatar pill — links to profile */}
        {user && (
          <Link
            href="/profile"
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all duration-200"
            style={{
              background: 'var(--af-item-hover)',
              textDecoration: 'none',
            }}
            aria-label="Go to profile"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="af-avatar w-7 h-7 text-xs"
              aria-hidden="true"
            >
              {initials(user.email)}
            </div>
            <span
              className="text-sm font-medium max-w-[120px] truncate hidden lg:block"
              style={{ color: 'var(--af-txt)' }}
            >
              {user.email?.split('@')[0] ?? 'User'}
            </span>
          </Link>
        )}
      </div>
    </header>
  )
}

