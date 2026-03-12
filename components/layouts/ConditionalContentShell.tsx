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
/** Route prefixes that should NOT have the sidebar left-margin offset */
const PUBLIC_PREFIXES = ['/auth/']

export default function ConditionalContentShell({
  children,
}: {
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const isPublic =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))

  if (isPublic) {
    // Public / auth pages: full width, no sidebar offset
    return (
      <div className="min-h-screen overflow-x-hidden">
        {children}
      </div>
    )
  }

  // Authenticated app routes: offset by sidebar width
  return (
    <div
      className="app-shell min-h-screen overflow-x-hidden transition-colors duration-300"
      style={{
        marginLeft: 'var(--af-sidebar-w)',
        background: [
          'radial-gradient(circle at 0% 0%, rgba(244,172,84,0.06), transparent 50%)',
          'radial-gradient(circle at 100% 10%, rgba(45,212,191,0.05), transparent 50%)',
          'radial-gradient(circle at top, #0e1225 0, #050711 54%, #010108 100%)',
        ].join(', '),
        backgroundAttachment: 'fixed',
      }}
    >
      {children}
    </div>
  )
}

