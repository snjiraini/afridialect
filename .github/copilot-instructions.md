# Afridialect.ai - GitHub Copilot Instructions

## Project Rules and Guidelines

### Code Change Rules
**CRITICAL:** All new code changes must adhere to the following rules:
- ❌ DO NOT introduce breaking changes to existing code, APIs, or functionality
- ❌ DO NOT alter the existing application look and feel (UI layout, color scheme, typography, spacing, component styles)
- ✅ New features must be additive and backward-compatible
- ✅ Existing component styles, Tailwind classes, and CSS must be preserved unless explicitly instructed to change them
- ✅ Existing API contracts (request/response shapes, status codes) must remain unchanged
- ✅ Refactors must maintain identical behavior and visual output

### Documentation Rules
**CRITICAL:** Only 4 markdown documentation files are allowed in the `docs/` folder:
1. `afridialect_prd.md` - Product Requirements Document (DO NOT MODIFY)
2. `technical_docs.md` - All technical setup, configuration, and implementation details
3. `phase_progress_and_completion.md` - Detailed phase tracking and completion records
4. `PROJECT_PROGRESS.md` - High-level project overview and milestone tracking

**Additional allowed files in docs/:**
- `hedera-kms-policy.json` - IAM policy configuration
- `nft-dashboard-with-dark-mode/` - UI reference materials

**Rules:**
- ❌ DO NOT create new markdown files in `docs/`
- ❌ DO NOT create markdown files in the project root directory
- ❌ DO NOT create summary documents, completion documents, or temporary docs
- ✅ Add all new documentation to one of the 4 existing markdown files
- ✅ Technical details → `technical_docs.md`
- ✅ Detailed progress tracking → `phase_progress_and_completion.md`
- ✅ High-level milestones → `PROJECT_PROGRESS.md`
- ✅ Never create README.md in docs/ folder
- ✅ Keep project root clean - only README.md allowed at root level

### Code Organization

#### Project Structure
```
/workspaces/afridialect/
├── app/                    # Next.js 16 App Router
│   ├── api/               # API routes
│   ├── auth/              # Authentication pages
│   ├── dashboard/         # User dashboard
│   └── [role]/            # Role-specific pages
├── components/            # Shared React components
├── hooks/                 # Custom React hooks
├── lib/                   # Business logic and services
│   ├── aws/              # AWS KMS services
│   ├── hedera/           # Hedera blockchain services
│   ├── supabase/         # Database and auth
│   └── utils/            # Utility functions
├── docs/                  # Documentation (3 markdown files only!)
├── scripts/               # Setup and utility scripts
└── types/                 # TypeScript type definitions
```

### Technology Stack
- **Framework:** Next.js 16.1.6 with App Router and Turbopack
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** Supabase (PostgreSQL)
- **Authentication:** Supabase Auth
- **Blockchain:** Hedera Hashgraph (Testnet)
- **Key Management:** AWS KMS (ECC_SECG_P256K1)
- **Storage:** IPFS (Pinata)

### Key Technical Decisions

#### Authentication
- Use Supabase Auth with email/password
- Middleware renamed to `proxy.ts` (Next.js 16 convention)
- Protected routes: /dashboard, /uploader, /transcriber, /translator, /reviewer, /admin
- Admin routes require role check via `user_roles` table

#### Hedera Integration
- **Account Creation:** ThresholdKey (2-of-2) custody model
- **User Key:** AWS KMS per-user key (ECC_SECG_P256K1)
- **Platform Guardian Key:** Shared platform key for recovery
- **DER Conversion:** Use `PublicKey.fromBytes(derBytes)` directly - Hedera SDK handles DER natively
- **Initial Balance:** 1 HBAR per account
- **Signing Algorithm:** ECDSA_SHA_256

#### Database Schema
- `profiles` table auto-created via trigger on auth.users insert
- `user_roles` table for role-based access control
- `audit_logs` table for tracking critical actions
- Store `hedera_account_id` and `kms_key_id` in profiles

### Development Workflow

#### Before Making Changes
1. Check `phase_progress_and_completion.md` for current phase status
2. Review `technical_docs.md` for existing implementations
3. Never create new documentation files

#### When Implementing Features
1. Follow the existing folder structure
2. Create types in `types/` directory
3. Business logic goes in `lib/`
4. UI components in `components/` or `app/[feature]/components/`
5. Update `technical_docs.md` with setup instructions
6. Update `phase_progress_and_completion.md` with completion status

#### When Writing Code
- Use TypeScript strict mode
- Add JSDoc comments for exported functions
- Handle errors gracefully with try-catch
- Log important operations with console.log/error
- Use `'use client'` directive for client components
- Prefer server components when possible

### Common Patterns

#### API Routes (App Router)
```typescript
// app/api/[feature]/route.ts
import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  // Implementation here
}
```

#### Client Components with Hooks
```typescript
'use client'

import { useState } from 'react'

export default function MyComponent() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Implementation here
}
```

#### Server Components with Database
```typescript
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function MyPage() {
  const supabase = await createClient()
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    redirect('/auth/login')
  }
  
  // Implementation here
}
```

### Environment Variables Required
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AWS KMS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_KMS_KEY_ID=  # Platform guardian key

# Hedera
HEDERA_NETWORK=testnet
HEDERA_TREASURY_ACCOUNT_ID=
HEDERA_TREASURY_PRIVATE_KEY=

# Pinata (IPFS)
PINATA_API_KEY=
PINATA_API_SECRET=
PINATA_JWT=
```

### Testing
- Use `npm run test:hedera` to verify Hedera configuration
- Use `scripts/test-auth.js` to verify authentication setup
- Use `scripts/test-database.js` to verify database connection
- Always test in development before deploying

### Deployment
- Build with `npm run build` (must pass with no errors)
- Run `npm run lint` before committing
- Keep environment variables in `.env.local` (never commit)
- Use Vercel for production deployment

### Security Best Practices
- Never expose private keys or secrets in code
- Use Supabase RLS policies for data access control
- Validate all user inputs on the server side
- Use AWS KMS for all cryptographic operations
- Implement proper CORS policies for API routes

### Current Phase Status
**Active Phase:** Phase 3.2 - Hedera Integration ✅ COMPLETE
**Next Phase:** Phase 3.3 - Profile & Admin Pages

### Important Notes
- The project uses Next.js 16 with `proxy.ts` instead of `middleware.ts`
- Hedera testnet is used for development
- All KMS keys use ECC_SECG_P256K1 (secp256k1) key spec
- ThresholdKey accounts require 2-of-2 signatures (user + platform)

---

**Last Updated:** February 24, 2026
