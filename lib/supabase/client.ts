/**
 * Supabase Browser Client
 * For use in React components and client-side code
 */

import { createBrowserClient } from '@supabase/ssr'

// Module-level singleton — createBrowserClient is safe to call at module
// evaluation time in the browser because NEXT_PUBLIC_* vars are baked into
// the JS bundle at build time by Next.js.
// During server-side rendering of client components Next.js also makes these
// vars available, so this never throws.
let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
    )
  }
  return client
}
