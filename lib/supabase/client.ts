/**
 * Supabase Browser Client
 * For use in React components and client-side code
 */

import { createBrowserClient } from '@supabase/ssr'

// Use the JWT anon key (eyJ...) which @supabase/ssr requires.
// NEXT_PUBLIC_SUPABASE_ANON_KEY is the correct key from:
//   Supabase Dashboard → Settings → API → "anon" "public"
// Falls back to the publishable key if anon key is not yet set,
// and to a placeholder during Next.js static prerendering at build time.
const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  'placeholder-anon-key'

let client: ReturnType<typeof createBrowserClient> | null = null

export function createClient() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co',
      supabaseKey
    )
  }
  return client
}
