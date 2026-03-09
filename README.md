# Afridialect.ai

> A web platform and marketplace for creating and purchasing high-quality speech datasets in African local dialects.

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.15-38bdf8)](https://tailwindcss.com/)
[![Hedera](https://img.shields.io/badge/Hedera-HTS%20Native-8259EF)](https://hedera.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E)](https://supabase.com/)

---

## Overview

Afridialect.ai enables contributors to upload, transcribe, and translate short audio clips of real speech in African local dialects — starting with **Kikuyu and Swahili** (Kenya). Every clip passes through a structured human-in-the-loop quality control pipeline before it is monetised. Contributors earn HBAR at each stage they complete. Buyers can purchase ML-ready dataset packages assembled on demand from IPFS.

Key capabilities:

- Contributors record and upload 30–40 second audio clips and earn HBAR for each pipeline stage they complete (upload, transcription, translation, QC review).
- A five-gate QC workflow moderates, transcribes, translates, and quality-checks all content before it is sold.
- After QC passes, audio, transcripts, and translations are permanently pinned to IPFS via Pinata, and Hedera HTS NFTs are minted to represent contribution rights.
- Buyers specify dataset constraints (dialect, speaker gender, age, duration, sample count), purchase in HBAR (displayed in USD), and receive a HuggingFace-compatible ZIP dataset built fresh from IPFS.
- A single atomic Hedera `BatchTransaction` handles NFT return, NFT burn, and HBAR distribution to all contributors simultaneously.

---

## Tech Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router, Turbopack) | 16.1.6 |
| UI | React | 19.0.0 |
| Language | TypeScript (strict mode) | 5.6.3 |
| Styling | Tailwind CSS | 3.4.15 |
| Database & Auth | Supabase (PostgreSQL + RLS) | ^2.97.0 |
| Blockchain | Hedera HTS — NFTs, BatchTransaction | ^2.80.0 |
| Key Management | AWS KMS (ECC_SECG_P256K1) | ^3.995.0 |
| Storage | Pinata (IPFS pinning) | REST API |

---

## Roles and Permissions

| Role | What they can do |
|---|---|
| Uploader | Upload audio clips; earn $0.50/sample when purchased |
| Transcriber | Claim and transcribe audio; earn $1.00/sample |
| Translator | Claim and translate transcribed audio; earn $1.00/sample |
| Reviewer / QC | Approve or reject at audio QC, transcript QC, and translation QC stages; earn $1.00/review |
| Buyer | Browse the marketplace, filter clips, purchase dataset packages (HBAR), download ZIP |
| Admin | Manage dialects, configure payout structure, set HBAR/USD rate, view analytics, unlock tasks |

A single user may hold multiple roles, but cannot perform more than one contribution role on the same clip.

---

## Platform Process Flow

```
CONTRIBUTOR SIDE                                         BUYER SIDE
─────────────────────────────────────────────────        ──────────────────────────

1. UPLOAD                                                A. BROWSE & FILTER
┌──────────────┐                                         ┌──────────────────────┐
│  Uploader    │  Audio clip (30–40s)                    │  Buyer               │
│  records &   │  WAV/MP3/OGG                            │  Filter by: dialect, │
│  uploads     │──────────────────┐                      │  gender, age, count  │
└──────────────┘                  │                      └──────────┬───────────┘
                                  │                                 │
2. AUDIO QC ──────────────────────────────────                      │
┌──────────────┐  Approve → next stage                              │
│  Reviewer    │  Reject  → delete + notify                         │
└──────┬───────┘                                                    │
       │                                                            │
3. TRANSCRIPTION                                                    │
┌──────────────┐                                                    │
│ Transcriber  │  Verbatim dialect text + speaker tags              │
└──────┬───────┘                                                    │
       │                                                            │
4. TRANSCRIPT QC                                                    │
┌──────────────┐  Approve → translation queue                       │
│  Reviewer    │  Reject  → retry transcription                     │
└──────┬───────┘                                                    │
       │                                                            │
5. TRANSLATION                                                      │
┌──────────────┐                                                    │
│  Translator  │  Meaning-preserving English translation            │
└──────┬───────┘                                                    │
       │                                                            │
6. TRANSLATION QC                                                   │
┌──────────────┐  Approve → mint pipeline                           │
│  Reviewer    │  Reject  → retry translation                       │
└──────┬───────┘                                                    │
       │                                                            │
7. IPFS PINNING                                                     │
┌──────────────┐                                                    │
│  Pinata      │  Audio + transcript + translation pinned to IPFS   │
└──────┬───────┘                                                    │
       │                                                            │
8. NFT MINTING                               ───────────────────────────────
┌────────────────────────────────────────┐   │ SELLABLE CLIPS POOL         │
│  Hedera HTS (5 NFTs x 3 roles/clip)   │   │                             │
│  5 Audio NFTs      → Uploader          │◄──┤  Visible in marketplace     │
│  5 Transcript NFTs → Transcriber       │   │  once status = sellable     │
│  5 Translation NFTs→ Translator        │   └─────────────────────────────┘
│  ThresholdKey (2-of-2) via AWS KMS    │              │
└────────────────────────────────────────┘             │
                                                       │◄── Buyer selects N samples
B. CHECKOUT (SSE streaming progress)
┌──────────────────────────────────────────────────────────────────────────────┐
│  POST /api/marketplace/purchase  →  reserve clips, create payout records     │
│  POST /api/marketplace/payment   →  single atomic Hedera BatchTransaction:   │
│                                                                              │
│    1. TransferTransaction  — contributor NFTs → treasury (KMS-signed)        │
│    2. TokenBurnTransaction — treasury burns NFT serials (supply key)         │
│    3. TransferTransaction  — buyer HBAR → all contributors + platform        │
│                                                                              │
│  Payout per sample ($6.00 USD → HBAR):                                       │
│    Uploader $0.50  Audio QC $1.00  Transcriber $1.00  Translator $1.00       │
│    Transcript QC $1.00  Translation QC $1.00  Platform $0.50                 │
└──────────────────────────────────────────────────────────────────────────────┘
              │
              ▼
C. DATASET BUILD (SSE streaming progress)
┌──────────────────────────────────────────────────────────────────────────────┐
│  GET /api/marketplace/download/[id]                                          │
│                                                                              │
│  auth_check → checking_cache → loading_clips → fetching_audio (xN, IPFS)    │
│            → building_zip   → uploading      → generating_url → done         │
│                                                                              │
│  dataset.zip:                                                                │
│    README.md      — HuggingFace dataset card (YAML + markdown, CC-BY-4.0)   │
│    data.jsonl     — one record per clip                                      │
│    audio/         — WAV/MP3 files fetched fresh from IPFS                   │
│    transcripts/   — verbatim dialect text files                              │
│    translations/  — English translation text files                           │
│                                                                              │
│  24-hour signed URL · package persists for full URL window                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## Clip Lifecycle States

```
uploaded → audio_qc → transcription_ready → transcription_in_progress
         → transcript_qc → translation_ready → translation_in_progress
         → translation_qc → mint_ready → ipfs_pinned → minted → sellable
```

After a purchase, NFTs are burned atomically on-chain. Buyers receive a dataset ZIP, not NFTs.

---

## Getting Started

### Prerequisites

- Node.js 20.x LTS
- npm 10.x
- Supabase project (free tier works)
- Hedera testnet account (free at [portal.hedera.com](https://portal.hedera.com))
- Pinata account (free tier)
- AWS account with KMS access

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/snjiraini/afridialect.git
cd afridialect

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.example .env.local
# Fill in all values — see Environment Variables below

# 4. Run database migrations in Supabase SQL Editor, in order:
#    lib/supabase/schema.sql
#    lib/supabase/rls-policies.sql
#    lib/supabase/triggers.sql
#    lib/supabase/seed.sql
#    lib/supabase/migrations/phase7_nft_minting.sql
#    lib/supabase/migrations/phase8_ipfs.sql
#    lib/supabase/migrations/phase9_marketplace.sql
#    lib/supabase/migrations/phase10_analytics.sql
#    lib/supabase/migrations/phase10_payment.sql
#    lib/supabase/migrations/phase10_download.sql
#    lib/supabase/migrations/phase11_payout_structure.sql

# 5. Create Supabase Storage buckets
node scripts/setup-storage-buckets.js

# 6. Start development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_publishable_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# AWS KMS (per-user secp256k1 keys)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_KMS_KEY_ID=your_platform_guardian_key_id

# Hedera
HEDERA_NETWORK=testnet
HEDERA_OPERATOR_ACCOUNT_ID=0.0.XXXXX
HEDERA_OPERATOR_PRIVATE_KEY=your_operator_private_key
HEDERA_TREASURY_ACCOUNT_ID=0.0.XXXXX
HEDERA_TREASURY_PRIVATE_KEY=your_treasury_private_key

# Pinata (IPFS)
PINATA_JWT=your_pinata_jwt
NEXT_PUBLIC_PINATA_GATEWAY=your_gateway_hostname

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

In production, all secrets except `NEXT_PUBLIC_*` variables are stored in AWS Secrets Manager (`afridialect/production/env`) and loaded at runtime by `lib/secrets/index.ts`.

---

## Project Structure

```
afridialect/
├── app/                          # Next.js 16 App Router
│   ├── api/                      # API routes
│   │   ├── admin/                # Admin APIs (payout-structure, analytics, dialects, pricing)
│   │   ├── audio/                # Audio upload
│   │   ├── audio-qc/             # Audio QC submit
│   │   ├── hedera/               # Account creation, NFT minting
│   │   ├── ipfs/                 # IPFS verify + staging cleanup
│   │   ├── marketplace/          # clips, purchase, payment, download
│   │   ├── reviewer/             # Reviewer APIs
│   │   ├── transcript-qc/        # Transcript QC submit
│   │   ├── transcription/        # Transcription claim + submit
│   │   ├── translation/          # Translation claim + submit
│   │   └── translation-qc/       # Translation QC submit
│   ├── admin/                    # Admin panel (users, mint, analytics, settings, audit-logs)
│   ├── auth/                     # Login, signup, reset-password, callback
│   ├── dashboard/                # User dashboard
│   ├── marketplace/              # Browse + checkout + purchase detail + SSE download
│   ├── profile/                  # Profile view + edit
│   ├── reviewer/                 # QC queue + task detail
│   ├── transcriber/              # Transcription queue + editor
│   ├── translator/               # Translation queue + editor
│   └── uploader/                 # Upload form + dashboard
├── components/
│   ├── layouts/                  # Sidebar (z-index 40), Topbar (z-index 30)
│   └── ThemeProvider.tsx         # Dark/light theme (FOUC-free blocking script)
├── hooks/
│   ├── useAuth.tsx               # Auth state hook
│   ├── useUser.ts                # User profile hook
│   └── useHederaAccount.ts       # Hedera account hook
├── lib/
│   ├── aws/kms.ts                # KMS: createUserKey, getPublicKey, signForHedera
│   ├── hedera/
│   │   ├── account.ts            # createHederaAccount (ThresholdKey custody)
│   │   ├── client.ts             # Hedera client (testnet/mainnet)
│   │   ├── ipfs.ts               # Pinata pinning, verifyPin, unpinFromIPFS
│   │   ├── nft.ts                # HTS minting, executeAtomicPurchaseBatch
│   │   └── payment.ts            # PayoutStructure, buildClipRecipients
│   ├── secrets/index.ts          # Unified secrets loader (env → AWS Secrets Manager)
│   ├── supabase/
│   │   ├── admin.ts              # Service-role client
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # SSR client
│   │   ├── schema.sql            # Full DB schema
│   │   ├── rls-policies.sql      # Row Level Security policies
│   │   ├── triggers.sql          # DB triggers (profile creation, timestamps)
│   │   ├── seed.sql              # Dialect + country seed data
│   │   └── migrations/           # Incremental schema migrations (phase7–11)
│   └── utils/                    # Shared utility functions
├── types/index.ts                # All TypeScript interfaces and types
├── config/index.ts               # App-level constants
├── scripts/                      # Setup and test scripts
├── proxy.ts                      # Next.js 16 route protection (replaces middleware.ts)
├── Dockerfile                    # 3-stage Docker build for Azure Container Apps
├── .github/workflows/
│   └── deploy-azure.yml          # CI/CD: build via ACR Tasks + deploy to Container Apps
├── tailwind.config.js
├── next.config.js                # output: standalone (required for Docker)
└── docs/
    ├── afridialect_prd.md
    ├── technical_docs.md
    ├── phase_progress_and_completion.md
    └── PROJECT_PROGRESS.md
```

---

## Security and Custody Model

### ThresholdKey (2-of-2)

Every user Hedera account is protected by a `KeyList` requiring both keys to sign:

| Key | Where it lives | Purpose |
|---|---|---|
| User key | AWS KMS per-user (`ECC_SECG_P256K1`) | Signs transactions on behalf of the user |
| Guardian key | AWS KMS platform (`ECC_SECG_P256K1`) | Platform co-signer; enables emergency controls |

Raw private keys never exist in application memory. All signing goes through `signForHedera()` in `lib/aws/kms.ts`.

### Atomic Purchase Transaction

The marketplace payment executes a single `BatchTransaction` (Hedera SDK ≥ 2.80):

1. **NFT return** — contributors transfer NFT serials back to treasury (ThresholdKey-signed via KMS)
2. **NFT burn** — treasury burns the returned serials (treasury supply key)
3. **HBAR distribution** — buyer distributes HBAR to all contributors and the platform (ThresholdKey-signed via KMS)

All three steps commit atomically — if any inner transaction fails, all revert.

### Row Level Security

All Supabase tables have RLS enabled. Users read only their own data; buyers access only their own purchases; admins have full access via the service-role key (server only).

---

## Admin Panel

Accessible at `/admin` (requires `admin` role):

| Page | Function |
|---|---|
| `/admin` | Dashboard: user count, pipeline stats, purchase revenue |
| `/admin/users` | User list, role assignment and removal |
| `/admin/mint` | NFT minting queue — per-clip mint, IPFS verify, staging cleanup |
| `/admin/analytics` | Upload metrics, QC pass rates, throughput charts, revenue, payout summaries |
| `/admin/settings` | Dialect management, HBAR/USD rate, payout structure, task unlock |
| `/admin/audit-logs` | Full audit trail of all critical actions |

Payout amounts are admin-configurable via `/admin/settings` and stored in the `payout_structure` table. Changes take effect on the next checkout — no redeploy required.

---

## Deployment

The app is hosted on **Azure Container Apps** (consumption plan, scale-to-zero).

**Live URL:** `https://afridialect-app.kindsand-f9476255.eastus.azurecontainerapps.io`

| Resource | Name |
|---|---|
| Resource Group | `afridialect-rg` (East US) |
| Container Registry | `afridialectacr.azurecr.io` (Basic SKU) |
| Container App | `afridialect-app` — 0.5 vCPU / 1 GiB, 0–3 replicas |

Images are built in Azure via ACR Tasks (no local Docker required) and deployed automatically on every push to `main` via `.github/workflows/deploy-azure.yml`.

Azure holds only 3 secrets (the AWS bootstrap credentials). All other secrets remain in AWS Secrets Manager and are fetched at runtime by `lib/secrets/index.ts`.

For full setup instructions, key rotation procedures, and CI/CD configuration, see [docs/technical_docs.md — Azure Container Apps Deployment](docs/technical_docs.md#azure-container-apps-deployment).

---

## Database Migrations

Run in Supabase Dashboard → SQL Editor, in order:

| File | What it adds |
|---|---|
| `schema.sql` | All core tables |
| `rls-policies.sql` | Row Level Security policies |
| `triggers.sql` | Profile auto-creation, `updated_at` timestamps |
| `seed.sql` | Dialect and country reference data |
| `migrations/phase7_nft_minting.sql` | `nft_records`, `nft_burns` tables |
| `migrations/phase8_ipfs.sql` | `ipfs_pin_log`, `audio_cid` column |
| `migrations/phase9_marketplace.sql` | `dataset_purchases`, `payout_records`, `hbar_rate` |
| `migrations/phase10_analytics.sql` | `system_config`, analytics indexes |
| `migrations/phase10_payment.sql` | Payment tracking columns |
| `migrations/phase10_download.sql` | `download_count`, `package_deleted_at` |
| `migrations/phase11_payout_structure.sql` | `payout_structure` table, `staging_cleaned_at` columns |

---

## Available Scripts

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run build            # Production build (must pass 0 errors before commit)
npm run start            # Start production server
npm run lint             # ESLint
npm run type-check       # TypeScript type check

# Setup
node scripts/setup-storage-buckets.js   # Create Supabase Storage buckets
node scripts/create-admin-user.js       # Create first admin user

# Testing
node scripts/test-database.js           # Test database connection
node scripts/test-auth.js               # Test authentication flow
npm run test:hedera                     # Test Hedera configuration
```

---


## Documentation

| File | Contents |
|---|---|
| [`docs/afridialect_prd.md`](docs/afridialect_prd.md) | Full Product Requirements Document |
| [`docs/technical_docs.md`](docs/technical_docs.md) | Technical setup: KMS, Hedera, Azure deployment, SSE endpoints |
| [`docs/phase_progress_and_completion.md`](docs/phase_progress_and_completion.md) | Detailed per-phase implementation records |
| [`docs/PROJECT_PROGRESS.md`](docs/PROJECT_PROGRESS.md) | High-level milestones and decisions log |

---

## Links

- [Hedera Documentation](https://docs.hedera.com/)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Pinata Documentation](https://docs.pinata.cloud/)
- [HashScan Testnet Explorer](https://hashscan.io/testnet)

---

## License

Proprietary — All rights reserved © 2026 Afridialect.ai

---

**Version:** 1.0.0 | **Status:** V1 Feature Complete | **Last Updated:** March 8, 2026
