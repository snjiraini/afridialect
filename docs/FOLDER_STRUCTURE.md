# Project Folder Structure

```
afridialect/
│
├── app/                           # Next.js App Router (React Server Components)
│   ├── api/                       # API Routes
│   │   ├── components/            # API-specific components
│   │   ├── lib/                   # API utilities
│   │   └── types/                 # API types
│   │
│   ├── auth/                      # Authentication pages
│   │   ├── login/
│   │   ├── signup/
│   │   ├── verify/
│   │   └── reset-password/
│   │
│   ├── dashboard/                 # Main dashboard
│   │   ├── components/            # Dashboard components
│   │   ├── lib/                   # Dashboard utilities
│   │   └── types/                 # Dashboard types
│   │
│   ├── uploader/                  # Uploader role pages
│   │   ├── upload/
│   │   ├── my-clips/
│   │   └── earnings/
│   │
│   ├── transcriber/               # Transcriber role pages
│   │   ├── tasks/
│   │   ├── my-transcriptions/
│   │   └── earnings/
│   │
│   ├── translator/                # Translator role pages
│   │   ├── tasks/
│   │   ├── my-translations/
│   │   └── earnings/
│   │
│   ├── reviewer/                  # Reviewer/QC pages
│   │   ├── audio-qc/
│   │   ├── transcript-qc/
│   │   ├── translation-qc/
│   │   └── history/
│   │
│   ├── marketplace/               # Dataset marketplace
│   │   ├── browse/
│   │   ├── purchase/
│   │   ├── downloads/
│   │   ├── components/
│   │   ├── lib/
│   │   └── types/
│   │
│   ├── admin/                     # Admin panel
│   │   ├── users/
│   │   ├── dialects/
│   │   ├── analytics/
│   │   ├── audit-logs/
│   │   ├── components/
│   │   ├── lib/
│   │   └── types/
│   │
│   ├── layout.tsx                 # Root layout
│   ├── page.tsx                   # Home page
│   └── globals.css                # Global styles
│
├── components/                    # Reusable components
│   ├── ui/                        # Base UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   ├── Input.tsx
│   │   ├── Modal.tsx
│   │   ├── Badge.tsx
│   │   └── ...
│   │
│   ├── forms/                     # Form components
│   │   ├── AudioUploadForm.tsx
│   │   ├── TranscriptionForm.tsx
│   │   ├── TranslationForm.tsx
│   │   └── ...
│   │
│   └── layouts/                   # Layout components
│       ├── Header.tsx
│       ├── Footer.tsx
│       ├── Sidebar.tsx
│       └── Container.tsx
│
├── lib/                           # Core libraries and utilities
│   ├── supabase/                  # Supabase client & utilities
│   │   ├── client.ts              # Supabase client initialization
│   │   ├── auth.ts                # Auth helpers
│   │   ├── storage.ts             # Storage helpers
│   │   └── database.ts            # Database helpers
│   │
│   ├── hedera/                    # Hedera SDK integration
│   │   ├── client.ts              # Hedera client
│   │   ├── nft.ts                 # NFT operations
│   │   ├── account.ts             # Account management
│   │   └── payments.ts            # Payment processing
│   │
│   ├── ipfs/                      # IPFS/Pinata integration
│   │   ├── pinata.ts              # Pinata client
│   │   ├── upload.ts              # Upload to IPFS
│   │   └── metadata.ts            # Metadata generation
│   │
│   ├── aws/                       # AWS services
│   │   ├── kms.ts                 # KMS for key management
│   │   └── s3.ts                  # S3 if needed
│   │
│   └── utils/                     # General utilities
│       ├── index.ts               # Common utilities
│       ├── audio.ts               # Audio processing
│       ├── validation.ts          # Validation helpers
│       └── crypto.ts              # Crypto utilities
│
├── types/                         # TypeScript type definitions
│   ├── index.ts                   # Common types
│   ├── database.ts                # Database types
│   ├── api.ts                     # API types
│   └── supabase.ts                # Supabase generated types
│
├── hooks/                         # React custom hooks
│   ├── useAuth.ts                 # Authentication hook
│   ├── useUser.ts                 # User data hook
│   ├── useAudio.ts                # Audio operations
│   ├── useTask.ts                 # Task management
│   └── ...
│
├── middleware/                    # Next.js middleware
│   ├── auth.ts                    # Auth middleware
│   ├── rateLimit.ts               # Rate limiting
│   └── cors.ts                    # CORS configuration
│
├── services/                      # Business logic services
│   ├── audioService.ts            # Audio processing
│   ├── taskService.ts             # Task management
│   ├── nftService.ts              # NFT minting
│   ├── qcService.ts               # QC workflow
│   ├── marketplaceService.ts      # Marketplace logic
│   └── datasetService.ts          # Dataset generation
│
├── config/                        # Application configuration
│   ├── index.ts                   # Main config
│   ├── dialects.ts                # Dialect definitions
│   └── constants.ts               # Constants
│
├── tests/                         # Test suites
│   ├── unit/                      # Unit tests
│   ├── integration/               # Integration tests
│   └── e2e/                       # End-to-end tests
│
├── scripts/                       # Utility scripts
│   ├── setup-db.ts                # Database setup
│   ├── seed-data.ts               # Seed test data
│   └── migrate.ts                 # Migration runner
│
├── public/                        # Static assets
│   ├── images/                    # Images
│   ├── icons/                     # Icons
│   └── robots.txt                 # SEO
│
├── docs/                          # Documentation
│   ├── afridialect_prd.md         # Product requirements
│   ├── SCHEMA.md                  # Database schema
│   └── API.md                     # API documentation
│
├── .env.example                   # Environment template
├── .env.local                     # Local environment (git ignored)
├── .gitignore                     # Git ignore rules
├── .eslintrc.json                 # ESLint config
├── .prettierrc                    # Prettier config
├── next.config.js                 # Next.js config
├── tsconfig.json                  # TypeScript config
├── tailwind.config.js             # Tailwind config
├── postcss.config.js              # PostCSS config
├── package.json                   # Dependencies
├── README.md                      # Project readme
├── DEPENDENCIES.md                # Dependency documentation
├── COMPATIBILITY_TEST.md          # Test results
└── PROJECT_PROGRESS.md            # Implementation progress
```

## Key Directories Explained

### `/app` - Next.js App Router
- Uses React Server Components by default
- Each folder can have its own `layout.tsx`, `page.tsx`, `loading.tsx`, `error.tsx`
- API routes in `/app/api`
- Automatic code splitting per route

### `/components` - Reusable Components
- **ui/**: Base components (buttons, inputs, modals)
- **forms/**: Complex form components
- **layouts/**: Layout wrappers (header, footer, sidebars)

### `/lib` - Core Libraries
- Integration with external services
- Reusable business logic
- Utilities and helpers

### `/types` - TypeScript Types
- Centralized type definitions
- Database types
- API contract types

### `/hooks` - React Hooks
- Custom hooks for state management
- Reusable component logic

### `/services` - Business Logic
- High-level business operations
- Orchestrates lib functions
- Handles complex workflows

### `/middleware` - Next.js Middleware
- Request/response processing
- Authentication checks
- Rate limiting
- CORS handling

## File Naming Conventions

- **Components**: PascalCase (e.g., `AudioUploadForm.tsx`)
- **Utilities**: camelCase (e.g., `formatDate.ts`)
- **Types**: PascalCase for types, camelCase for files (e.g., `index.ts` exports `User` type)
- **Constants**: UPPER_SNAKE_CASE or camelCase files
- **Pages**: lowercase with hyphens (e.g., `my-clips/page.tsx`)

## Import Path Aliases

Using `@/` alias for cleaner imports:
```typescript
import { Button } from '@/components/ui/Button'
import { config } from '@/config'
import { User } from '@/types'
```

Configured in `tsconfig.json`:
```json
"paths": {
  "@/*": ["./*"]
}
```
