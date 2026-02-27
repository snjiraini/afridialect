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
- `whatsapp-sender-pro-ui/` - UI reference materials

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

#### ⚠️ Core Principle — Minimum Change, No Regressions

**CRITICAL — read before writing a single line of code:**

- ✅ Make the **smallest possible change** that satisfies the requirement — nothing more
- ✅ Read and understand every file you are about to edit before touching it
- ✅ After every change, verify that all existing functionality still works (`npm run build` must pass with 0 errors)
- ✅ If a fix can be made in 3 lines, write 3 lines — do not refactor surrounding code
- ❌ **NEVER break existing working code** to implement new features
- ❌ **NEVER change the visual appearance of the UI** unless the task explicitly asks for a UI/design change — colours, spacing, fonts, layout, shadows, and component styles must remain exactly as designed
- ❌ Never rename, move, or restructure files that are not directly required by the task
- ❌ Never change component props, function signatures, or exported types unless the task requires it
- ❌ Never rewrite a working component from scratch — add only what is needed

**Before every edit, ask:**
1. Is this change strictly necessary for the task?
2. Will this change alter how any existing page or component looks?
3. Will this change break any other part of the codebase?

If the answer to question 2 or 3 is "yes" or "maybe", stop and find a smaller approach.

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

## UI/UX & Frontend Engineering Rules

These rules were established after a full redesign session (February 2026) that uncovered five categories of recurring bugs. **Read before touching any component, layout, or CSS file.**

---

### Rule 1 — Dark Mode: Always Use a Blocking Inline Script (FOUC Prevention)

**Problem discovered:** `ThemeProvider` initialised state as `'light'` on the server. On the client, a `useEffect` read `localStorage` and switched to `'dark'` — causing a white flash on every dark-mode page load.

**Required pattern — `app/layout.tsx`:**
```tsx
const themeScript = `
(function(){
  try {
    var stored = localStorage.getItem('af-theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored || (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.add('light-mode');
    }
  } catch(e) {}
})();
`

// In <html> → <head>:
<script dangerouslySetInnerHTML={{ __html: themeScript }} />
```

**Required pattern — `ThemeProvider.tsx`:**
```tsx
// Read theme from the DOM that the inline script already set — not from useState('light')
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

const [theme, setTheme] = useState<Theme>(getInitialTheme)
```

**Rules:**
- ✅ Always place the blocking `<script>` in `<head>` before React hydrates
- ✅ Always initialise theme state from `document.documentElement.classList`, not `localStorage` directly
- ✅ Always add `suppressHydrationWarning` to `<html>` and `<body>` in `layout.tsx`
- ❌ Never use `useState('light')` then a `useEffect` to correct it — this always causes FOUC
- ❌ Never use a `mounted` guard that renders nothing on first paint

---

### Rule 2 — Hydration: Never Render Theme-Dependent Text During SSR

**Problem discovered:** The Sidebar theme-toggle button used:
```tsx
// ❌ WRONG — causes React hydration mismatch
aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
```
The server renders `theme = 'light'`, the client hydrates with `theme = 'dark'` (from DOM), so the `aria-label` strings differ → React hydration error.

**Fix applied:**
```tsx
// ✅ CORRECT — static label, no SSR/client mismatch
aria-label="Toggle light / dark mode"
suppressHydrationWarning
```

**Rules:**
- ✅ Use `suppressHydrationWarning` on any element whose attribute depends on client-only state (theme, locale, time, random values)
- ✅ Keep `aria-label` values static or theme-neutral when the value derives from `theme` state
- ❌ Never interpolate `theme`, `Date.now()`, `Math.random()`, or `window.*` into JSX attributes that are server-rendered
- ❌ Never branch on `typeof window !== 'undefined'` inside a component's render path to produce different JSX

---

### Rule 3 — CSS: Never Mix `@apply` with Custom Tailwind Tokens Inside `@layer components`

**Problem discovered:** Classes like `shadow-soft-md` and `shadow-soft-lg` were defined in `tailwind.config.js` under `theme.extend.boxShadow`. Using them inside `@layer components` via `@apply` caused VS Code lint errors and occasional Tailwind build failures because the JIT compiler processes `@layer components` before resolving extended theme tokens.

**Fix applied:** Replaced all `@apply` inside `@layer components` with native CSS properties:
```css
/* ❌ WRONG */
.af-card {
  @apply rounded-2xl shadow-soft-md transition-all duration-300;
}

/* ✅ CORRECT */
.af-card {
  border-radius: var(--af-radius);
  box-shadow: var(--af-shadow-card);
  transition: background 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease;
}
```

**Rules:**
- ✅ Use CSS custom properties (`var(--af-*)`) for all design tokens inside `@layer components`
- ✅ `@apply` is acceptable for stable Tailwind core utilities (e.g. `flex`, `items-center`, `truncate`) but not for extended theme values
- ✅ Store box shadows, radii, colours, and spacing as CSS variables in `:root` / `.dark`
- ❌ Never `@apply shadow-soft-*`, `@apply bg-[--af-*]`, or `@apply dark:*` inside `@layer components`
- ❌ Never duplicate CSS variable declarations — each token must appear exactly once in `:root` and once in `.dark`

---

### Rule 4 — Z-Index: Use an Explicit Hierarchy, Never Rely on Tailwind Classes Alone

**Problem discovered:** Tailwind's `z-30` and `z-40` classes can be purged or overridden by CSS cascade order when components are in different layout trees.

**Established z-index hierarchy (do not change without updating all layers):**

| Layer       | z-index | Where applied            |
|-------------|---------|--------------------------|
| Page body   | 0       | Default (no z set)       |
| Topbar      | 30      | `components/layouts/Topbar.tsx` |
| Sidebar     | 40      | `components/layouts/Sidebar.tsx` |
| Dropdowns   | 50      | Popovers, select menus   |
| Modals      | 60      | Dialog overlays          |
| Toasts      | 70      | Notification toasts      |

**Rules:**
- ✅ Always set z-index as an **inline style** (`style={{ zIndex: 40 }}`) on fixed/absolute positioned elements — inline styles cannot be purged
- ✅ Sidebar must always be `zIndex: 40`; Topbar must always be `zIndex: 30`
- ✅ Use the utility classes `.z-sidebar`, `.z-topbar`, `.z-dropdown`, `.z-modal`, `.z-toast` defined in `globals.css` for non-layout components
- ❌ Never use Tailwind `z-*` classes on `<Sidebar>` or `<Topbar>` — use inline styles only

---

### Rule 5 — Event Handling: Isolate Interactive Buttons from Parent Click Handlers

**Problem discovered:** Sidebar sign-out and theme-toggle buttons were sometimes inside containers that had their own click handlers, causing parent navigation links to trigger instead.

**Required pattern for all standalone interactive buttons:**
```tsx
// ✅ All interactive sidebar/panel buttons must follow this pattern
<button
  type="button"                          // Prevents accidental form submit
  onClick={(e) => {
    e.preventDefault()                   // Prevents any default anchor behaviour
    e.stopPropagation()                  // Stops parent container/Link from firing
    doAction()
  }}
  disabled={isLoading}                   // Prevent double-click during in-flight ops
  onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)' }}
  onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
>
```

**Rules:**
- ✅ Always use `type="button"` on non-submit buttons
- ✅ Always call `e.stopPropagation()` on buttons inside sidebars, cards, or any container that is itself clickable
- ✅ Sign-out and theme-toggle must **never** be wrapped in a `<Link>` component
- ✅ Use `e.currentTarget` (not `e.target`) in `onMouseEnter`/`onMouseLeave` for reliable hover targeting
- ❌ Never nest a `<button>` inside an `<a>` or Next.js `<Link>` — this is invalid HTML and causes event bubbling bugs

---

### Rule 6 — Supabase / Auth: Guard All User Object Accesses

**Problem discovered:** Components accessed `user.email` before the auth state had resolved, causing silent crashes that prevented event listeners from binding.

**Required pattern:**
```tsx
// ❌ WRONG — crashes if user is null
const label = user.email.split('@')[0]

// ✅ CORRECT — safe at every lifecycle stage
const label = user?.email?.split('@')[0] ?? 'User'
```

**For `useEffect` with Supabase fetches:**
```tsx
useEffect(() => {
  if (!user?.id) return                  // Guard: skip if not logged in

  let cancelled = false                  // Prevent state update after unmount
  ;(async () => {
    try {
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (cancelled) return
      // set state
    } catch {
      // graceful degradation — never let a fetch crash the component
    }
  })()
  return () => { cancelled = true }
}, [user?.id])                           // Depend on user.id, not the full user object
```

**Rules:**
- ✅ Always use optional chaining (`?.`) for every `user.*` access in client components
- ✅ Always provide a fallback value (`?? 'default'`) after optional chaining
- ✅ Always use a `cancelled` flag in async `useEffect` to prevent state updates after unmount
- ✅ Depend on `user?.id` (primitive) in `useEffect` dependency arrays, not `user` (object reference)
- ❌ Never access `user.email`, `user.id`, or any user property without null-checking first

---

### Rule 7 — Tailwind Dark Mode: Class Strategy Only

**Project configuration:** `darkMode: 'class'` in `tailwind.config.js`. This means dark mode is controlled entirely by the `dark` class on `<html>`.

**Rules:**
- ✅ Dark mode CSS variables live in `.dark { }` in `globals.css`
- ✅ The `dark` class is applied/removed by `ThemeProvider` via `document.documentElement.classList`
- ✅ The blocking inline script in `layout.tsx` sets the class before React hydrates
- ❌ Never use `darkMode: 'media'` — system preference is only a fallback for first-visit, controlled by the inline script
- ❌ Never add `data-theme` attributes — the project uses only `class="dark"` / `class="light-mode"`
- ❌ Never use Tailwind's `dark:` variant inside `@layer components` with `@apply` (see Rule 3)

---

**Last Updated:** February 27, 2026

