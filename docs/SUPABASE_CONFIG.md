# Supabase Configuration Guide

## Environment Variables

### Updated Approach (Current)

We use the **newer Supabase API key approach** with publishable and secret keys:

```bash
# Client-side (safe to expose in browser)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your-publishable-key-here

# Server-side only (never expose to client)
SUPABASE_SECRET_KEY=your-secret-api-key-here
```

### Legacy Approach (Deprecated)

The old approach used `anon_key` and `service_role_key`:
```bash
# ❌ DON'T USE - Legacy approach
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
```

## Key Differences

| Aspect | Legacy (anon/service_role) | New (publishable/secret) |
|--------|---------------------------|--------------------------|
| **Client Key** | `anon_key` | `publishable_key` |
| **Server Key** | `service_role_key` | `secret_key` |
| **RLS** | Bypassed with service_role | Always enforced |
| **Security** | Service role has full access | Secret key respects RLS |
| **Use Case** | Admin operations bypass RLS | All operations respect RLS |

## Implementation Guide

### 1. Client-Side Supabase Client (Browser/React Components)

```typescript
// lib/supabase/client.ts
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

**Usage:**
```typescript
import { createClient } from '@/lib/supabase/client'

const supabase = createClient()
const { data, error } = await supabase.from('audio_clips').select('*')
```

### 2. Server-Side Supabase Client (API Routes, Server Components)

```typescript
// lib/supabase/server.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
      },
    }
  )
}
```

**Usage in Server Components:**
```typescript
import { createClient } from '@/lib/supabase/server'

export default async function Page() {
  const supabase = createClient()
  const { data } = await supabase.from('audio_clips').select('*')
  return <div>{/* render data */}</div>
}
```

### 3. Admin Operations (Server-Side Only)

For operations that need elevated privileges (bypassing RLS), use the secret key:

```typescript
// lib/supabase/admin.ts
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
```

**Usage (Admin operations only):**
```typescript
import { createAdminClient } from '@/lib/supabase/admin'

// Only use in API routes, never expose to client
export async function POST(request: Request) {
  const supabase = createAdminClient()
  
  // Admin operation - use sparingly and carefully
  const { data, error } = await supabase
    .from('users')
    .update({ role: 'admin' })
    .eq('id', userId)
}
```

## Row Level Security (RLS)

### Important: RLS Enforcement

- **Publishable Key**: Always respects RLS policies
- **Secret Key**: Can bypass RLS (use with extreme caution)

### Best Practices

1. **Always use publishable key by default**
2. **Use secret key ONLY for:**
   - Initial data seeding
   - Admin operations that must bypass RLS
   - Background jobs that operate as "system"
   
3. **Never expose secret key to client**
4. **Implement comprehensive RLS policies**

### Example RLS Policy

```sql
-- Users can only read their own data
CREATE POLICY "Users can view own data"
ON audio_clips
FOR SELECT
USING (auth.uid() = uploader_id);

-- This policy is ALWAYS enforced with publishable key
-- Can be bypassed with secret key (admin client)
```

## Migration from Legacy Keys

If migrating from legacy approach:

### 1. Update Environment Variables
```bash
# Old
NEXT_PUBLIC_SUPABASE_ANON_KEY=... ❌
SUPABASE_SERVICE_ROLE_KEY=...     ❌

# New
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=... ✅
SUPABASE_SECRET_KEY=...                  ✅
```

### 2. Update Client Creation

```typescript
// Old ❌
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(url, anonKey)

// New ✅
import { createBrowserClient } from '@supabase/ssr'
const supabase = createBrowserClient(url, publishableKey)
```

### 3. Update Server Client

```typescript
// Old ❌
const supabase = createClient(url, serviceRoleKey)

// New ✅
import { createServerClient } from '@supabase/ssr'
const supabase = createServerClient(url, publishableKey, {
  cookies: { /* cookie handling */ }
})
```

## Getting Your Keys

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Navigate to **Settings** → **API**
4. Copy the keys:
   - **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
   - **Publishable anon key** → `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
   - **Secret service_role key** → `SUPABASE_SECRET_KEY`

## Security Checklist

- [ ] Publishable key used for all client-side operations
- [ ] Secret key used ONLY in server-side code
- [ ] Secret key NEVER exposed to browser/client
- [ ] RLS policies implemented on all tables
- [ ] Admin operations use secret key sparingly
- [ ] Environment variables properly configured in `.env.local`
- [ ] `.env.local` added to `.gitignore`

## Dependencies

Install the required Supabase packages:

```bash
npm install @supabase/supabase-js @supabase/ssr
```

Update `package.json`:
```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.45.0",
    "@supabase/ssr": "^0.5.0"
  }
}
```

## References

- [Supabase SSR Documentation](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [Next.js App Router with Supabase](https://supabase.com/docs/guides/getting-started/quickstarts/nextjs)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

---

**Status:** Ready for Phase 3 implementation  
**Last Updated:** February 23, 2026
