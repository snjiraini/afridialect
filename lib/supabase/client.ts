/**
 * Supabase Browser Client
 * For use in React components and client-side code
 */

import { createBrowserClient } from '@supabase/ssr'

// Module-level singleton. createBrowserClient uses its own internal singleton
// in the browser (isBrowser() === true). During server-side rendering of
// 'use client' components (e.g. /_not-found prerender at build time),
// isBrowser() === false so we provide fallback placeholder strings to prevent
// the "URL and API key are required" throw. The placeholder values are never
// used for real network requests — they only satisfy the non-empty check.
let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL      || 'https://placeholder.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder-anon-key'
    )
  }
  return client
}
