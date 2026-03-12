'use client'

/**
 * ConditionalSidebar
 * Renders the Sidebar only on authenticated app routes.
 * The public landing page (/) uses its own full-page layout
 * so the sidebar must not appear there.
 */

import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

/** Routes where the sidebar should NOT appear */
const PUBLIC_ROUTES = ['/']
/** Route prefixes where the sidebar should NOT appear */
const PUBLIC_PREFIXES = ['/auth/']

export default function ConditionalSidebar() {
  const pathname = usePathname()
  const isPublic =
    PUBLIC_ROUTES.includes(pathname) ||
    PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix))
  if (isPublic) return null
  return <Sidebar />
}
