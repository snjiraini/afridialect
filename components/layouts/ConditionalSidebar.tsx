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

export default function ConditionalSidebar() {
  const pathname = usePathname()
  if (PUBLIC_ROUTES.includes(pathname)) return null
  return <Sidebar />
}
