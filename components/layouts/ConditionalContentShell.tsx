'use client'

/**
 * ConditionalContentShell
 * Wraps page content with the sidebar offset only on authenticated app routes.
 * On the public landing page (/) the wrapper has no left margin so the
 * full-width marketing design renders without the app shell offset.
 */

import { usePathname } from 'next/navigation'

/** Routes that should NOT have the sidebar left-margin offset */
const PUBLIC_ROUTES = ['/']

export default function ConditionalContentShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isPublic = PUBLIC_ROUTES.includes(pathname)

  if (isPublic) {
    // Public landing page: full width, no sidebar offset
    return (
      <div className="min-h-screen overflow-x-hidden">
        {children}
      </div>
    )
  }

  // Authenticated app routes: offset by sidebar width
  return (
    <div
      className="af-page-content min-h-screen overflow-x-hidden transition-colors duration-300"
      style={{ marginLeft: 'var(--af-sidebar-w)' }}
    >
      {children}
    </div>
  )
}
