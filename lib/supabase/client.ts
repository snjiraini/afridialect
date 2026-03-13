/**
 * Supabase Browser Client
 * For use in React components and client-side code
 */

import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Guard: env vars are absent during Next.js static prerendering at build
  // time. Return null-safe no-op; real calls happen only in the browser where
  // env vars are always present.
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  ) {
    return null as unknown as ReturnType<typeof createBrowserClient>
  }
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
}
