/**
 * Supabase Admin Client
 * For admin operations that bypass RLS (use sparingly)
 * ONLY use in API routes, never expose to client
 */

import { createClient } from '@supabase/supabase-js'
import { getSecret } from '@/lib/secrets'

export async function createAdminClient() {
  const secretKey = await getSecret('SUPABASE_SECRET_KEY').catch(() => undefined)

  if (!secretKey) {
    throw new Error('SUPABASE_SECRET_KEY is not set')
  }

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    secretKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
