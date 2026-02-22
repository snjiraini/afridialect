# Afridialect.ai — Detailed Product Requirements Document (PRD)

**Project:** 2. Local language AI  
**Product:** Afridialect.ai  
**Document type:** Product Requirements Document (PRD)  
**Version:** 1.0  
**Date:** 2026-02-21  
**Scope:** V1 (Web-only)

## 1) Executive summary

Afridialect.ai is a web platform and marketplace for creating and purchasing high-quality speech datasets in African local dialects, starting with **Kenya (Kikuyu + Swahili)**. The platform enables:

- **Contributors** to upload short audio clips of real speech.
- A structured **human-in-the-loop workflow** to moderate, transcribe, translate, and quality-check the data.
- **Native Hedera NFTs (HTS)** minted after QC approval to represent rights and payouts for audio, transcript, and translation contributions.
- **Buyers** to specify dataset constraints (dialect, duration, speaker attributes, etc.), purchase a dataset in **HBAR** (prices displayed in USD), and download a **HuggingFace-compatible dataset package**.

Key differentiators:

- Strong **content moderation** and **QC gating** prior to minting and distribution.
- **Hedera-native** royalty/custom fee enforcement and a **production-grade custody** model using **AWS KMS-backed threshold keys**.
- A “**purchase → dataset delivery → burn**” mechanism: buyers do not retain NFTs; NFTs associated with a dataset purchase are **burned** after purchase while buyers receive the consolidated dataset.
- Clear data lifecycle: **Supabase storage (temporary)** → **IPFS via Pinata (permanent for minted assets)** → cleanup.

## 2) Goals, non-goals, and guiding principles

### 2.1 Goals (V1)

1. Launch a web-only platform focused on Kikuyu and Swahili.
2. Support contributor roles: uploaders, transcribers, translators, reviewer/QC, buyer-only, admin.
3. Enforce a multi-step workflow:
   - Audio moderation/QC
   - Transcription + QC
   - Translation + QC
   - Minting (post-QC)
   - Marketplace purchase
   - Dataset packaging + download
4. Ensure privacy and compliance via pre-mint moderation, audit logs, and strict access control.
5. Generate downloadable datasets in a standard ML format with an auto-generated dataset card.
6. Use Hedera best practices and **Hedera SDKs (not EVM tooling)**.
7. Production-grade custody: per-user accounts with **ThresholdKey (2-of-2)** backed by AWS KMS.

### 2.2 Non-goals (V1)

- Mobile app
- Written/text-only social media post ingestion
- On-platform model training/finetuning
- Refunds/chargebacks logic (handled per business policy outside this PRD)

### 2.3 Guiding principles

- **Quality first**: no minting until QC passes.
- **Clear provenance**: each dataset item must be traceable through moderation and QC.
- **Least-privilege access**: staged data is private; buyers only receive packaged outputs.
- **Protocol-enforced economics**: rely on Hedera-native fee mechanisms where possible.
- **Simplicity for V1**: constrain clip length (30–40s) and scope to 2 dialects.

## 3) Personas and roles

### 3.1 Personas

- **Uploader**: creates/owns audio recordings, wants monetization.
- **Transcriber**: native speaker who converts audio to dialect text.
- **Translator**: bilingual contributor who translates dialect → English.
- **Reviewer/QC**: ensures content compliance and annotation quality.
- **Buyer (ML engineer / org)**: needs dataset for model training, wants consistent packaging and licensing clarity.
- **Admin (Afridialect staff)**: manages dialect taxonomy, pricing, and analytics.

### 3.2 Role capabilities

- A single user may hold multiple roles, but with strict per-item constraints (see §4.4).

## 4) Workflow & lifecycle requirements

### 4.1 High-level state machine

**Uploaded → Audio_QC → (Rejected|Transcription_Ready) → Transcription_InProgress → Transcript_QC → (Rejected|Translation_Ready) → Translation_InProgress → Translation_QC → (Rejected|Mint_Ready) → IPFS_Pinned → Minted → Sellable**

### 4.2 Task claiming and locking

- Transcription and translation tasks are claimable.
- When claimed, the item is locked for **24 hours**.
- If not submitted within 24 hours, it is automatically unlocked and returns to queue.
- Admin can override locks.

### 4.3 Multi-step QC pipeline (required)

**Step 1: Audio QC / Moderation** (Reviewer/QC)

- Validate declared dialect is correct (“primarily in the right dialect”).
- Content moderation checks and flags:
  - Hate speech or discriminatory content
  - Threats of violence or credible harm
  - Harassment or targeted abuse
  - Explicit material
  - Illegal activity promotion
  - Copyright infringement (e.g., audible background music)
  - Doxxing/personal data disclosure
- Outcomes:
  - **Reject**: Delete audio from staging storage; notify uploader via email; record reasons.
  - **Approve**: Move to transcription queue.

**Step 2: Transcription submission** (Transcriber)

- Requirements:
  - Verbatim transcription (policy-driven consistency)
  - Dialect marking in transcription
  - Tag usage (e.g., laughter, silence)
  - Code-switching handling
  - Speaker count / speaker turns

**Step 3: Transcript QC** (Reviewer/QC)

- Checks:
  - Verbatim fidelity
  - Correct dialect marking
  - Correct tag usage
  - Code-switching correctness
  - Speaker count sanity
- Outcomes:
  - **Reject**: Discard transcript; notify transcriber via email; reopen task.
  - **Approve**: Move to translation queue.

**Step 4: Translation submission** (Translator)

- Requirements:
  - Meaning-preserving English translation
  - Maintain alignment with turns/segments
  - Code-switching policy adherence

**Step 5: Translation QC** (Reviewer/QC)

- Checks:
  - Fidelity/meaning preservation
  - Completeness
  - Consistency
- Outcomes:
  - **Reject**: Discard translation; notify translator via email; reopen translation.
  - **Approve**: Move to minting pipeline.

### 4.4 One-task-per-audio-item constraint

To prevent self-dealing and improve dataset integrity:

- A user can only occupy **one** contribution role per audio item:
  - uploader OR transcriber OR translator OR transcript QC reviewer OR translation QC reviewer
- A user **cannot** transcribe or translate their own upload.
- A user who transcribes a specific item **cannot** translate the same item.
- Reviewers cannot review their own work.

### 4.5 Clip length enforcement & chunking

- V1 supports **30–40 second** clips.
- If a user uploads a longer file, the platform automatically chunks it into compliant clips.
- Each chunk becomes its own pipeline item with its own QC/minting lifecycle.

## 5) Storage & data lifecycle

### 5.1 Storage phases

1. **Pre-mint staging (Supabase Storage)**
   - Private buckets, strict policies.
   - Used for upload, transcription, translation, and review.
2. **Post-mint permanent storage (IPFS via Pinata)**
   - After final QC and before minting completion, assets are pinned to IPFS.
   - NFTs reference IPFS URIs/CIDs.
3. **Cleanup**
   - After minting success is confirmed, staging assets are deleted from Supabase.
4. **Buyer dataset compilation (temporary Supabase Storage)**
   - When a buyer purchases a dataset, the compiled dataset archive is staged in Supabase temporarily.
   - Deleted after buyer download is completed or after a TTL.

### 5.2 Supabase buckets (suggested)

- `audio-staging` (private)
- `transcript-staging` (private)
- `translation-staging` (private)
- `dataset-exports` (private, signed URLs)

### 5.3 Access control policies (must-have)

- Private by default.
- Uploaders access only their staged uploads.
- Claimants access only items they claimed.
- Reviewers access items in their review scope.
- Admin access to all.
- Buyers only access their generated export via signed URL.

### 5.4 IPFS pinning (Pinata)

- After approval, audio/transcript/translation are pinned to IPFS.
- All NFTs for that item reference the **same IPFS files** (shared CIDs) in metadata.

### 5.5 Dataset export cleanup policy

- Exports are deleted after:
  - buyer confirms download (where feasible) OR
  - TTL expiry (e.g., 24 hours)

## 6) NFTs, minting, and marketplace mechanics (Hedera-native)

### 6.1 Hedera approach

- Use Hedera SDKs and HTS native NFT tokens.
- Follow best practices per Hedera docs.

### 6.2 Minting timing

- **Mint only after Step 5 QC passes**.

### 6.3 Supply rules

For each approved audio item (clip):

- Mint **300 audio NFTs**
- Mint **300 transcription NFTs**
- Mint **300 translation NFTs**

### 6.4 NFT ownership distribution

- Audio NFTs → uploader account
- Transcription NFTs → transcriber account
- Translation NFTs → translator account

### 6.5 Buyer purchase model (purchase → burn)

- Buyer does **not** retain NFTs.
- At checkout, buyer purchases dataset “samples” (each sample corresponds to one clip).
- After purchase, NFTs associated with the purchase are **burned**.
- Buyer receives only the consolidated dataset package.

### 6.6 Fees and contributor payouts (USD display, HBAR settlement)

#### 6.6.1 Base component pricing (platform-suggested)

- Audio: **$0.50**
- Transcription: **$1.00**
- Translation: **$1.00**
- Afridialect markup: **$0.50** per bundle

#### 6.6.2 QC payments

- Each QC review task earns **$1.00**:
  - Transcript QC reviewer: $1.00
  - Translation QC reviewer: $1.00
- QC reviewers are paid for service; **no QC NFTs** are minted.

#### 6.6.3 Bundle price to buyer

Per sample (bundle):

- $0.50 audio + $1.00 transcription + $1.00 translation + $1.00 transcript QC + $1.00 translation QC + $0.50 platform = **$5.00**

All displayed in USD and converted to HBAR at checkout.

### 6.7 Royalty/fee mechanism

- Use **HTS Native Royalty Fees** where applicable for marketplace mechanics.
- Note: Because the buyer burns NFTs and does not retain them, the “purchase” is implemented as a protocol-level fee distribution via HTS custom fees

**Requirement:** Avoid manual off-chain split logic where feasible; prefer protocol-level fees.

## 7) Custody, accounts, and treasury separation

### 7.1 Treasury separation (required)

Use separate Hedera accounts:

| Purpose           | Account type               |
| ----------------- | -------------------------- |
| Platform revenue  | Dedicated treasury account |
| NFT mint treasury | Dedicated HTS treasury     |
| User accounts     | Per-user KMS-backed        |
| Fee collector     | Platform royalty account   |

### 7.2 Production-grade custody (recommended and required for V1)

- User account key = **ThresholdKey (2 of 2)**
  - Key 1: User KMS key
  - Key 2: Platform Guardian key (separate KMS key, different AWS account)
- User operations require both.
- Platform can implement emergency controls (policy-defined).
- Compromise of one key is insufficient.

### 7.3 Account creation flow

On user registration:

1. Create KMS asymmetric key.
2. Fetch public key.
3. Create Hedera account using that public key in a ThresholdKey structure.
4. Store:
   - `user_id`
   - `hedera_account_id`
   - `kms_key_id`
   - `evm_address` (derived, stored for convenience)

**Do not store private keys.**

## 8) Dataset purchase and packaging

### 8.1 Buyer dataset builder requirements

Buyers can:

- Preview audio (policy-limited)
- Filter by:
  - dialect (Kikuyu/Swahili)
  - speaker gender
  - audio quality
  - duration
  - speaker count
- Specify desired dataset size:
  - “N samples” and/or “total minutes” (V1 should pick one primary input; recommend N samples)
- System randomly selects eligible items.

### 8.2 Post-purchase delivery

After payment:

- System compiles a HuggingFace-compatible dataset package.
- Buyer downloads via a signed URL.

### 8.3 Dataset format requirements (HuggingFace-like)

Package contents:

- Audio files
- Transcripts
- English translations
- A manifest in JSONL/Parquet
- Auto-generated dataset card including:
  - languages/dialects
  - duration
  - counts
  - speaker stats (if collected)
  - annotation guidelines
  - licensing

## 9) Moderation policy and governance

### 9.1 Moderation categories (must implement)

- Hate speech/discrimination
- Threats/credible harm
- Harassment/targeted abuse
- Explicit material
- Illegal activity
- Copyright infringement
- Doxxing/PII

### 9.2 Enforcement actions

- Reject + delete staged audio.
- Notify uploader/transcriber/translator via email.
- Maintain audit logs.

## 10) Admin requirements

Admins can:

- Add/manage countries and dialects
- Configure pricing (platform suggested) at any time
- View analytics:
  - uploads, QC pass rate, time-to-approval
  - transcription/translation throughput
  - purchases, revenue, payouts

## 11) Non-functional requirements

### 11.1 Security

- Secrets in `.env` files only.
- `.env.example` required.
- Least privilege.
- Audit logs for critical actions (approvals, rejections, minting, burns, payouts).

### 11.2 Privacy

- Staged content private.
- No buyer access to raw staging.
- IPFS content is permanent—ensure policy acceptance and compliance before pinning.

### 11.3 UX/UI

- Modern UI with soft shadows and subtle elevation.
- Accessibility: contrast, focus states, touch targets.

### 11.4 Stability constraints

- Do **not** use latest packages.
- Use stable LTS runtimes and pin versions.

## 12) Key screens (V1)

- Landing + browse
- Auth
- Uploader dashboard + upload page
- Reviewer dashboard (audio QC, transcript QC, translation QC)
- Transcriber dashboard + editor
- Translator dashboard + editor
- Buyer dataset builder + checkout
- Buyer downloads page
- Admin panel (dialects/countries, pricing, analytics)

## 13) Notifications

- Email notifications required for:
  - upload rejection
  - transcript rejection
  - translation rejection
  - task claim expiry warnings (optional)

Email provider: **TBD**.

## 14) Metrics and success criteria

### 14.1 Quality

- Audio QC rejection rate by reason
- Transcript QC rejection rate
- Translation QC rejection rate

### 14.2 Marketplace

- Dataset purchases per week
- Average samples per purchase
- Revenue (platform markup)

### 14.3 Operations

- Time in queue per stage
- Claim expiry rate

## 15) Risks and mitigations

- **IPFS permanence risk**: ensure moderation is strict pre-pin; require consent checkboxes.
- **Gaming the system**: enforce one-task-per-item, reviewer separation, audit logs.
- **Low-quality contributions**: QC gates and reviewer incentives.
- **Conversion rate volatility (USD→HBAR)**: define rate provider and hold time.
