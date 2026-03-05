# 🌍 Afridialect.ai

> A web platform and marketplace for creating and purchasing high-quality speech datasets in African local dialects.

[![Next.js](https://img.shields.io/badge/Next.js-16.1.6-black)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.0.0-blue)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6.3-blue)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-3.4.15-38bdf8)](https://tailwindcss.com/)
[![Hedera](https://img.shields.io/badge/Hedera-HTS%20Native-8259EF)](https://hedera.com/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E)](https://supabase.com/)

---

## 🔄 Platform Process Flow

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│                              AFRIDIALECT.AI — DATA PIPELINE                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────┘

  CONTRIBUTOR SIDE                                         BUYER SIDE
  ─────────────────────────────────────────────────        ──────────────────────────────────

  1. UPLOAD                                                A. BROWSE & FILTER
  ┌──────────────┐                                         ┌────────────────────────┐
  │  🎤 Uploader │  Audio clip (30–40s)                    │  🛒 Buyer              │
  │  records &   │  WAV/MP3/OGG                            │  Filter by: dialect,   │
  │  uploads     │──────────────────┐                      │  gender, age, duration │
  └──────────────┘                  │                      └──────────┬─────────────┘
                                    ▼                                 │
  2. AUDIO QC ──────────────────────────────────                      │
  ┌──────────────┐  ✅ Approve → next stage                           │
  │  👁️ Reviewer │  ❌ Reject  → delete + notify                      │
  └──────┬───────┘                                                    │
         │                                                            │
  3. TRANSCRIPTION ──────────────────────────────                     │
  ┌──────────────┐                                                    │
  │ ✍️ Transcriber│  Verbatim dialect text                            │
  │  (native     │  + speaker tags + code-switch                      │
  │   speaker)   │                                                    │
  └──────┬───────┘                                                    │
         │                                                            │
  4. TRANSCRIPT QC ──────────────────────────────                     │
  ┌──────────────┐  ✅ Approve → translation queue                    │
  │  👁️ Reviewer │  ❌ Reject  → retry transcription                  │
  └──────┬───────┘                                                    │
         │                                                            │
  5. TRANSLATION ─────────────────────────────────                    │
  ┌──────────────┐                                                    │
  │ 🌐 Translator│  Meaning-preserving English                        │
  │              │  translation + speaker turns                       │
  └──────┬───────┘                                                    │
         │                                                            │
  6. TRANSLATION QC ─────────────────────────────                     │
  ┌──────────────┐  ✅ Approve → mint pipeline                        │
  │  👁️ Reviewer │  ❌ Reject  → retry translation                    │
  └──────┬───────┘                                                    │
         │                                                            │
  7. IPFS PINNING ────────────────────────────────                    │
  ┌──────────────┐                                                    │
  │  📌 Pinata   │  Audio + transcript + translation                  │
  │  (permanent) │  permanently pinned to IPFS                        │
  └──────┬───────┘                                                    │
         │                                                            │
  8. NFT MINTING ─────────────────────────────────  ─────────────────────────
  ┌──────────────────────────────────────────────┐  │ SELLABLE CLIPS POOL    │
  │  🔷 Hedera HTS (5 NFTs × 3 roles per clip)  │  │                        │
  │  • 5 Audio NFTs      → Uploader account      │◄─┤  Clips visible in      │
  │  • 5 Transcript NFTs → Transcriber account   │  │  marketplace once      │
  │  • 5 Translation NFTs→ Translator account    │  │  status = sellable     │
  │  ThresholdKey (2-of-2) via AWS KMS           │  └────────────────────────┘
  └──────────────────────────────────────────────┘           │
                                                             │
  ─────────────────────────────────────────────              │
  MARKETPLACE CHECKOUT FLOW                                  │
  ─────────────────────────────────────────────              │
                                                             │◄──── Buyer selects N samples
  B. CHECKOUT (SSE streaming progress)                       │
  ┌──────────────────────────────────────────────────────────▼──────────────────────────┐
  │  POST /api/marketplace/purchase  →  reserve clips, create payout records            │
  │  POST /api/marketplace/payment   →  single atomic Hedera BatchTransaction:          │
  │                                                                                      │
  │    ① TransferTransaction  — contributor NFTs → treasury (ThresholdKey KMS-signed)  │
  │    ② TokenBurnTransaction — treasury burns NFT serials (supply key)                 │
  │    ③ TransferTransaction  — buyer HBAR → all contributors + platform                │
  │                                                                                      │
  │  Payout per sample ($6.00 USD → HBAR):                                              │
  │    Uploader $0.50 · Audio QC $1.00 · Transcriber $1.00 · Translator $1.00          │
  │    Transcript QC $1.00 · Translation QC $1.00 · Platform $0.50                     │
  └──────────────────────────────────────────────────────────────────────────────────────┘
                │
                ▼
  C. DATASET BUILD (SSE streaming progress)
  ┌──────────────────────────────────────────────────────────────────────────────────────┐
  │  GET /api/marketplace/download/[id]                                                  │
  │                                                                                      │
  │  auth_check → checking_cache → loading_clips → fetching_audio (×N from IPFS)       │
  │            → building_zip   → uploading      → generating_url → done                │
  │                                                                                      │
  │  dataset.zip contents:                                                               │
  │    README.md      — HuggingFace dataset card (YAML + markdown, CC-BY-4.0)           │
  │    data.jsonl     — one record per clip (id, dialect, cid, transcript, translation) │
  │    audio/         — WAV/MP3 files fetched fresh from IPFS                           │
  │    transcripts/   — verbatim dialect text files                                     │
  │    translations/  — English translation text files                                  │
  │                                                                                      │
  │  24-hour signed URL · package persists for full URL window                          │
  └──────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 📋 Overview

Afridialect.ai is a web platform and marketplace for creating and purchasing high-quality speech datasets in African local dialects, starting with **Kikuyu and Swahili** (Kenya). It enables:

- **Contributors** to upload short audio clips of real speech and earn HBAR for each stage of the pipeline they complete.
- A structured **human-in-the-loop QC workflow** to moderate, transcribe, translate, and quality-check all data before it is monetized.
- **Hedera HTS NFTs** minted after QC approval to represent contribution rights and on-chain payouts for audio, transcript, and translation work.
- **Buyers** to specify dataset constraints (dialect, speaker gender, age, duration, sample count), purchase in HBAR (displayed in USD), and receive a **HuggingFace-compatible ZIP dataset** assembled on demand from IPFS.

### Key Features

| Feature | Detail |
|---|---|
| 🎤 **Audio Upload** | Drag-and-drop, 30–40s clips, WAV/MP3/OGG, Supabase private staging |
| ✍️ **Transcription** | Verbatim dialect text with speaker tags and code-switch markers |
| 🌐 **Translation** | Meaning-preserving English translation with speaker-turn alignment |
| ✅ **5-Stage QC Pipeline** | Audio QC → Transcript QC → Translation QC with approve/reject at every gate |
| 📌 **IPFS Pinning** | All approved assets permanently pinned to Pinata after QC passes |
| 🔷 **Hedera NFTs** | 5 HTS NFTs × 3 roles (audio, transcript, translation) per clip |
| ⚛️ **Atomic Purchase** | Single `BatchTransaction` — NFT return + burn + HBAR distribution atomically |
| 📦 **HuggingFace Dataset** | On-demand ZIP built from IPFS: dataset card, JSONL manifest, audio, text |
| 📡 **SSE Progress** | Real-time Server-Sent Events for checkout and dataset build steps |
| 🔑 **KMS Custody** | Per-user ThresholdKey (2-of-2) backed by AWS KMS — no raw keys in memory |
| 🛡️ **Admin Controls** | Configurable payout structure, dialect management, HBAR/USD rate, analytics |

---

## 🏗️ Tech Stack

### Core Framework
| Package | Version | Purpose |
|---|---|---|
| `next` | 16.1.6 | React framework, App Router, Turbopack |
| `react` / `react-dom` | 19.0.0 | UI library |
| TypeScript | 5.6.3 | Strict type safety |
| Tailwind CSS | 3.4.15 | Utility-first styling with custom design tokens |

### Blockchain & Storage
| Package | Version | Purpose |
|---|---|---|
| `@hashgraph/sdk` | ^2.80.0 | Hedera HTS NFTs, `BatchTransaction`, `TransferTransaction` |
| `@supabase/supabase-js` | ^2.97.0 | Database, auth, and private storage |
| `@supabase/ssr` | ^0.8.0 | Server-side Supabase client for Next.js App Router |
| `@aws-sdk/client-kms` | ^3.995.0 | AWS KMS per-user secp256k1 key management |
| Pinata | REST API | IPFS pinning for permanent asset storage |

### Utilities
| Package | Version | Purpose |
|---|---|---|
| `uuid` | ^13.0.0 | UUID generation for clip and purchase IDs |
| `dotenv` | ^17.3.1 | Environment variable loading |

---

## 👥 Roles & Permissions

| Role | What they can do |
|---|---|
| **Uploader** | Upload audio clips; earn $0.50/sample when clips are purchased |
| **Transcriber** | Claim and transcribe audio; earn $1.00/sample |
| **Translator** | Claim and translate transcribed audio; earn $1.00/sample |
| **Reviewer / QC** | Approve or reject at audio QC, transcript QC, and translation QC stages; earn $1.00/review |
| **Buyer** | Browse the marketplace, filter clips, purchase dataset packages (HBAR), download ZIP |
| **Admin** | Manage dialects, configure payout structure, set HBAR/USD rate, view analytics, unlock tasks |

> A single user may hold multiple roles, but **cannot perform more than one contribution role on the same clip** (no self-dealing).

---

## 🔄 Clip Lifecycle States

```
uploaded → audio_qc → transcription_ready → transcription_in_progress
         → transcript_qc → translation_ready → translation_in_progress
         → translation_qc → mint_ready → ipfs_pinned → minted → sellable
```

After a purchase: NFTs are **burned** atomically on-chain. Buyers receive a dataset ZIP, not NFTs.

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20.x LTS
- **npm** 10.x
- **Supabase** project (free tier works)
- **Hedera** testnet account (free at [portal.hedera.com](https://portal.hedera.com))
- **Pinata** account (free tier)
- **AWS** account with KMS access

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/snjiraini/afridialect.git
cd afridialect

# 2. Install dependencies
npm install

# 3. Copy environment template
cp .env.example .env.local
# Fill in all values — see Environment Variables section below

# 4. Run database migrations in Supabase SQL Editor (in order):
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
# ── Supabase ──────────────────────────────────────────────
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# ── AWS KMS (per-user secp256k1 keys) ─────────────────────
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_KMS_KEY_ID=your_platform_guardian_key_id   # Guardian key (2nd ThresholdKey slot)

# ── Hedera ────────────────────────────────────────────────
HEDERA_NETWORK=testnet
HEDERA_OPERATOR_ACCOUNT_ID=0.0.XXXXX
HEDERA_OPERATOR_PRIVATE_KEY=your_operator_private_key
HEDERA_TREASURY_ACCOUNT_ID=0.0.XXXXX
HEDERA_TREASURY_PRIVATE_KEY=your_treasury_private_key

# ── Pinata (IPFS) ─────────────────────────────────────────
PINATA_JWT=your_pinata_jwt
PINATA_API_KEY=your_api_key          # optional if JWT is set
PINATA_API_SECRET=your_api_secret    # optional if JWT is set
```

---

## 📁 Project Structure

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
│   ├── layouts/                  # Sidebar, Topbar (z-index rules: 40/30)
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
│   │   └── payment.ts            # PayoutStructure, buildClipRecipients, executePurchasePayment
│   ├── supabase/
│   │   ├── admin.ts              # Service-role client
│   │   ├── client.ts             # Browser client
│   │   ├── server.ts             # SSR client
│   │   ├── schema.sql            # Full DB schema
│   │   ├── rls-policies.sql      # Row Level Security policies
│   │   ├── triggers.sql          # DB triggers (profile creation, timestamps)
│   │   ├── seed.sql              # Dialect + country seed data
│   │   └── migrations/           # Incremental schema migrations (phase7–11)
│   └── utils/index.ts            # Shared utility functions
├── types/index.ts                # All TypeScript interfaces and types
├── config/index.ts               # App-level constants
├── scripts/                      # Setup and test scripts
├── proxy.ts                      # Next.js 16 route protection (replaces middleware.ts)
├── tailwind.config.js            # Custom design tokens and theme
├── next.config.js
├── tsconfig.json                 # Strict mode TypeScript
└── docs/
    ├── afridialect_prd.md        # Product Requirements Document
    ├── technical_docs.md         # Technical setup and implementation details
    ├── phase_progress_and_completion.md  # Detailed phase tracking
    ├── PROJECT_PROGRESS.md       # High-level milestones and decisions log
    └── hedera-kms-policy.json    # IAM policy for KMS permissions
```

---

## 🔐 Security & Custody Model

### ThresholdKey (2-of-2) — Production Custody

Every user Hedera account is protected by a `KeyList` requiring **both** keys to sign:

| Key | Where it lives | Purpose |
|---|---|---|
| **User key** | AWS KMS per-user (`ECC_SECG_P256K1`) | Signs transactions on behalf of the user |
| **Guardian key** | AWS KMS platform (`ECC_SECG_P256K1`) | Platform co-signer; enables emergency controls |

Raw private keys **never exist in application memory**. All signing goes through `signForHedera()` in `lib/aws/kms.ts`, which calls AWS KMS `Sign` with `MessageType: 'RAW'` and converts the DER-encoded response to the 64-byte `r‖s` format the Hedera SDK expects.

### Atomic Purchase Transaction

The marketplace payment executes a single `BatchTransaction` (Hedera SDK ≥ 2.80):

1. **NFT return** — contributor accounts transfer their NFT serials back to treasury (`TransferTransaction`, ThresholdKey-signed per contributor via KMS)
2. **NFT burn** — treasury burns the returned serials (`TokenBurnTransaction`, treasury supply key)
3. **HBAR distribution** — buyer account distributes to all contributors + platform (`TransferTransaction`, ThresholdKey-signed via KMS)

All three steps commit atomically — if any inner transaction fails, all revert.

### Row Level Security

All Supabase tables have RLS enabled. Key policies:
- Users read only their own data
- Claimants access only tasks they claimed
- Buyers access only their own purchases and signed URLs
- Admins have full access via service-role key (server only)

---

## 🎛️ Admin Panel

Accessible at `/admin` (requires `admin` role):

| Page | Function |
|---|---|
| `/admin` | Dashboard: user count, clip pipeline stats, purchase revenue |
| `/admin/users` | User list, role assignment/removal |
| `/admin/mint` | NFT minting queue — per-clip mint, IPFS verify, staging cleanup |
| `/admin/analytics` | Upload metrics, QC pass rates, throughput charts, revenue, payout summaries |
| `/admin/settings` | Dialect management · HBAR/USD rate · Payout structure · Task unlock |
| `/admin/audit-logs` | Full audit trail of all critical actions |

### Admin-Configurable Payout Structure

Default amounts (PRD §6.6.3) stored in the `payout_structure` DB table. Admins can update via `/admin/settings` → "Contributor Payout Structure". Changes take effect on the next checkout — no redeploy required.

---

## 📡 SSE Endpoints

Two endpoints stream real-time progress via `text/event-stream`:

### Checkout — `POST /api/marketplace/payment`

Steps: `reserving` → `broadcasting` → `confirming` → `done` | `error`

### Dataset Build — `GET /api/marketplace/download/[id]`

Steps: `auth_check` → `checking_cache` → `loading_clips` → `fetching_audio` (×N, with `current`/`total`) → `building_zip` → `uploading` → `generating_url` → `done` | `error`

Each event shape:
```typescript
{
  step: string        // step name
  message: string     // human-readable status
  detail?: string     // secondary detail
  current?: number    // fetching_audio: current clip index
  total?: number      // fetching_audio: total clips
  downloadUrl?: string // done: 24h signed URL
  error?: string      // error: description
}
```

---

## 🗄️ Database Migrations

Run in Supabase Dashboard → SQL Editor, in order:

| File | What it adds |
|---|---|
| `schema.sql` | All core tables |
| `rls-policies.sql` | Row Level Security policies |
| `triggers.sql` | Profile auto-creation, `updated_at` |
| `seed.sql` | Dialect and country reference data |
| `migrations/phase7_nft_minting.sql` | `nft_records`, `nft_burns` tables |
| `migrations/phase8_ipfs.sql` | `ipfs_pin_log`, `audio_cid` column |
| `migrations/phase9_marketplace.sql` | `dataset_purchases`, `payout_records`, `hbar_rate` |
| `migrations/phase10_analytics.sql` | `system_config`, analytics indexes |
| `migrations/phase10_payment.sql` | Payment tracking columns |
| `migrations/phase10_download.sql` | `download_count`, `package_deleted_at` on `dataset_purchases` |
| `migrations/phase11_payout_structure.sql` | `payout_structure` table, `staging_cleaned_at` columns |

---

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start dev server with Turbopack
npm run build            # Production build (must pass 0 errors before commit)
npm run start            # Start production server
npm run lint             # ESLint

# Setup & testing
node scripts/setup-storage-buckets.js   # Create Supabase Storage buckets
node scripts/setup-database.js          # Verify DB connection
node scripts/test-auth.js               # Test authentication flow
node scripts/test-database.js           # Test database connection
node scripts/create-admin-user.js       # Create first admin user
node scripts/fund-account.js            # Fund a Hedera account for testing
```

---

## 📚 Documentation

| File | Contents |
|---|---|
| [`docs/afridialect_prd.md`](docs/afridialect_prd.md) | Full Product Requirements Document |
| [`docs/technical_docs.md`](docs/technical_docs.md) | Technical setup: KMS, Hedera, SSE endpoints, custody model |
| [`docs/phase_progress_and_completion.md`](docs/phase_progress_and_completion.md) | Detailed per-phase implementation records |
| [`docs/PROJECT_PROGRESS.md`](docs/PROJECT_PROGRESS.md) | High-level milestones and decisions log |

---

## 🗺️ Implementation Status

| Phase | Description | Status |
|---|---|---|
| 1 | Project setup & foundation | ✅ Complete |
| 2 | Database schema & RLS | ✅ Complete |
| 3.1 | Authentication & protected routes | ✅ Complete |
| 3.2 | Hedera account creation (ThresholdKey + KMS) | ✅ Complete |
| 3.3 | Profile pages & admin panel | ✅ Complete |
| 4 | Audio upload pipeline & Supabase storage | ✅ Complete |
| 5 | Transcription workflow | ✅ Complete |
| 6 | Translation workflow + Transcript QC | ✅ Complete |
| 7 | NFT minting (HTS, admin queue) | ✅ Complete |
| 8 | IPFS/Pinata integration | ✅ Complete |
| 9 | Marketplace & dataset purchase | ✅ Complete |
| 10 | Admin analytics, dialect management, pricing | ✅ Complete |
| 11 | Atomic BatchTransaction, SSE download, payout config | ✅ Complete |
| Bug fix | ZIP auto-delete removed — package persists 24h | ✅ Complete |

---

## 🔗 Links

- [Hedera Documentation](https://docs.hedera.com/)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)
- [Pinata Documentation](https://docs.pinata.cloud/)
- [HashScan (Testnet Explorer)](https://hashscan.io/testnet)

---

## 📄 License

Proprietary — All rights reserved © 2026 Afridialect.ai

---

**Version:** 1.0.0  
**Status:** V1 Feature Complete  
**Last Updated:** March 5, 2026


## 📋 Overview

Afridialect.ai enables contributors to upload, transcribe, and translate audio clips in African local dialects (starting with Kikuyu and Swahili in Kenya). The platform ensures quality through a multi-step human-in-the-loop workflow and mints Hedera NFTs to represent ownership and payouts. Buyers can purchase datasets in a HuggingFace-compatible format.

### Key Features

- 🎤 **Audio Upload & Chunking** - Automatic 30-40s clip chunking
- ✍️ **Transcription & Translation** - Native speaker contributions
- ✅ **Multi-Stage QC Pipeline** - Content moderation and quality checks
- 🔐 **Hedera NFTs** - Blockchain-native provenance and payouts
- 📦 **HuggingFace Datasets** - ML-ready dataset packages
- 🔒 **Production-Grade Custody** - AWS KMS-backed threshold keys
- 🌐 **IPFS Storage** - Permanent storage via Pinata

## 🏗️ Tech Stack

### Core Framework
- **Next.js 16.1.6** - React framework with App Router
- **React 19.0.0** - UI library
- **TypeScript 5.6.3** - Type safety

### Blockchain & Storage
- **Hedera Hashgraph** - NFT minting and payments (HTS native)
- **Supabase** - Database, auth, and staging storage
- **Pinata/IPFS** - Permanent decentralized storage
- **AWS KMS** - Secure key management

### Styling & UI
- **Tailwind CSS 3.4.15** - Utility-first CSS
- **shadcn/ui** (planned) - Component library

### Code Quality
- **ESLint 9.17.0** - Linting
- **Prettier 3.4.2** - Code formatting

## 🚀 Getting Started

### Prerequisites

- **Node.js** 20.x LTS or higher
- **npm** 10.0.0 or higher
- **Supabase** account (free tier available)
- **Hedera** testnet account (free)
- **Pinata** account (free tier available)
- **AWS** account (for KMS)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/snjiraini/afridialect.git
   cd afridialect
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and fill in your credentials:
   - Supabase URL and keys
   - Hedera account IDs and keys
   - Pinata API keys
   - AWS KMS configuration
   - Email provider configuration

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser**
   ```
   http://localhost:3000
   ```

## 📁 Project Structure

```
afridialect/
├── app/                      # Next.js App Router
│   ├── api/                  # API routes
│   ├── auth/                 # Authentication pages
│   ├── dashboard/            # Main dashboard
│   ├── uploader/             # Uploader role pages
│   ├── transcriber/          # Transcriber role pages
│   ├── translator/           # Translator role pages
│   ├── reviewer/             # Reviewer/QC pages
│   ├── marketplace/          # Dataset marketplace
│   ├── admin/                # Admin panel
│   ├── layout.tsx            # Root layout
│   └── page.tsx              # Home page
├── components/               # Reusable components
│   ├── ui/                   # UI components
│   ├── forms/                # Form components
│   └── layouts/              # Layout components
├── lib/                      # Core libraries
│   ├── supabase/             # Supabase client & utils
│   ├── hedera/               # Hedera SDK integration
│   ├── ipfs/                 # Pinata/IPFS utils
│   ├── aws/                  # AWS KMS integration
│   └── utils/                # General utilities
├── types/                    # TypeScript type definitions
├── hooks/                    # React custom hooks
├── middleware/               # Next.js middleware
├── services/                 # Business logic services
├── config/                   # App configuration
├── tests/                    # Test suites
├── scripts/                  # Utility scripts
├── public/                   # Static assets
└── docs/                     # Documentation
```

## 🔧 Available Scripts

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm run start            # Start production server

# Code Quality
npm run lint             # Run ESLint
npm run format           # Format code with Prettier
npm run format:check     # Check formatting
npm run type-check       # Run TypeScript checks

# Testing (planned)
npm run test             # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
```

## 🗄️ Database Setup

### Supabase Schema

The database schema includes:
- Users & roles
- Audio clips & metadata
- Transcriptions & translations
- QC reviews & audit logs
- NFT records
- Purchases & datasets

Detailed schema documentation: [SCHEMA.md](docs/SCHEMA.md) (coming soon)

### Row Level Security (RLS)

All Supabase tables have RLS policies enforcing:
- Private staging data access
- Role-based permissions
- One-task-per-item constraints
- Audit trail immutability

## 🔐 Security & Best Practices

### Key Management
- **AWS KMS** for secure key generation
- **ThresholdKey (2-of-2)** for Hedera accounts
- User keys never stored in plaintext
- Separate treasury accounts per revenue stream

### Data Privacy
- Pre-mint content moderation
- Private staging storage with signed URLs
- IPFS pinning only after QC approval
- Automatic cleanup of staging data

### Rate Limiting
- API route protection
- Upload size limits
- Task claiming restrictions

## 🎯 Roadmap

### V1 (Current Phase)
- [x] Project setup
- [ ] Authentication & user management
- [ ] Audio upload pipeline
- [ ] QC workflow engine
- [ ] Hedera NFT integration
- [ ] IPFS storage
- [ ] Marketplace & dataset builder
- [ ] Admin panel

### Future Phases
- Mobile app (iOS/Android)
- Additional African dialects
- On-platform model training
- Advanced analytics
- Community features

## 📚 Documentation

- [Product Requirements Document](docs/afridialect_prd.md)
- [Project Progress](PROJECT_PROGRESS.md)
- [Dependencies & Compatibility](DEPENDENCIES.md)
- [Compatibility Test Results](COMPATIBILITY_TEST.md)

## 🤝 Contributing

This is a private project during initial development. Contributing guidelines will be added when the project goes public.

## 📄 License

Proprietary - All rights reserved

## 🔗 Links

- [Documentation](docs/)
- [Hedera Documentation](https://docs.hedera.com/)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js Documentation](https://nextjs.org/docs)

## 💬 Support

For support and questions:
- Check the [docs](docs/) folder
- Review [PROJECT_PROGRESS.md](PROJECT_PROGRESS.md) for implementation status

---

**Version:** 1.0.0  
**Status:** In Development  
**Last Updated:** February 23, 2026
