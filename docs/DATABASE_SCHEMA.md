# Database Schema Documentation

## Overview

This document describes the complete database schema for Afridialect.ai, including all tables, relationships, constraints, and Row Level Security (RLS) policies.

**Database:** PostgreSQL (Supabase)  
**Version:** 1.0.0  
**Last Updated:** February 23, 2026

---

## Table of Contents

1. [Schema Overview](#schema-overview)
2. [Tables](#tables)
3. [Relationships](#relationships)
4. [Row Level Security](#row-level-security)
5. [Functions & Triggers](#functions--triggers)
6. [Indexes](#indexes)
7. [Migration Guide](#migration-guide)

---

## Schema Overview

### Entity Relationship Diagram

```
┌──────────────┐
│   profiles   │
└──────┬───────┘
       │
       ├──────────────────┬────────────────┬─────────────────┐
       │                  │                │                 │
┌──────▼───────┐  ┌───────▼──────┐  ┌─────▼──────┐  ┌──────▼───────┐
│  user_roles  │  │ audio_clips  │  │    tasks   │  │ qc_reviews   │
└──────────────┘  └───────┬──────┘  └────────────┘  └──────────────┘
                          │
              ┌───────────┼───────────┐
              │           │           │
      ┌───────▼──────┐ ┌──▼────────┐ ┌──▼────────┐
      │transcriptions│ │translations│ │nft_records│
      └──────────────┘ └────────────┘ └─────┬─────┘
                                            │
                                      ┌─────▼──────┐
                                      │ nft_burns  │
                                      └─────┬──────┘
                                            │
                                ┌───────────▼──────────────┐
                                │  dataset_purchases       │
                                └───────────┬──────────────┘
                                            │
                                      ┌─────▼──────┐
                                      │   payouts  │
                                      └────────────┘
```

---

## Tables

### 1. profiles

User profile information extending Supabase Auth.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY, FK → auth.users | User ID (from Supabase Auth) |
| email | TEXT | UNIQUE, NOT NULL | User email address |
| full_name | TEXT | | User's full name |
| hedera_account_id | TEXT | UNIQUE | Hedera account ID (0.0.xxxxx) |
| kms_key_id | TEXT | | AWS KMS key ID for signing |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Profile creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**RLS Policies:**
- Users can view their own profile
- Users can update their own profile
- Public profiles viewable by all (for collaboration)

---

### 2. user_roles

User role assignments (many-to-many with profiles).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Role assignment ID |
| user_id | UUID | FK → profiles, NOT NULL | User receiving the role |
| role | TEXT | NOT NULL, CHECK | Role type (uploader, transcriber, translator, reviewer, buyer, admin) |
| granted_at | TIMESTAMPTZ | DEFAULT NOW() | When role was granted |
| granted_by | UUID | FK → profiles | Admin who granted the role |

**Constraints:**
- UNIQUE(user_id, role) - Prevent duplicate role assignments

**RLS Policies:**
- Users can view their own roles

---

### 3. dialects

Supported African dialects.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Dialect ID |
| code | TEXT | UNIQUE, NOT NULL | Dialect code (e.g., 'kikuyu') |
| name | TEXT | NOT NULL | Display name (e.g., 'Kikuyu') |
| country_code | TEXT | NOT NULL | ISO 3166-1 alpha-2 (e.g., 'KE') |
| enabled | BOOLEAN | DEFAULT true | Whether dialect is active |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |

**RLS Policies:**
- Everyone can view enabled dialects

---

### 4. audio_clips

Main audio files and their lifecycle.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Audio clip ID |
| uploader_id | UUID | FK → profiles, NOT NULL | User who uploaded |
| dialect_id | UUID | FK → dialects, NOT NULL | Dialect of the audio |
| status | TEXT | NOT NULL, CHECK | Current lifecycle status |
| audio_url | TEXT | | Supabase Storage URL |
| audio_cid | TEXT | | IPFS CID (after pinning) |
| duration_seconds | NUMERIC(10,2) | NOT NULL | Audio duration |
| sample_rate | INTEGER | | Audio sample rate |
| file_size_bytes | INTEGER | | File size in bytes |
| speaker_count | INTEGER | | Number of speakers |
| speaker_gender | TEXT | CHECK | Gender: male/female/mixed/unknown |
| speaker_age_range | TEXT | CHECK | Age: child/teen/adult/senior/mixed |
| metadata | JSONB | DEFAULT '{}' | Additional metadata |
| tags | TEXT[] | DEFAULT '{}' | Searchable tags |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Upload timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |
| rejected_at | TIMESTAMPTZ | | Rejection timestamp |
| approved_at | TIMESTAMPTZ | | Approval timestamp |

**Status Values:**
- `uploaded` - Just uploaded
- `audio_qc` - In audio quality check
- `audio_rejected` - Failed audio QC
- `transcription_ready` - Ready for transcription
- `transcription_in_progress` - Being transcribed
- `transcript_qc` - In transcript quality check
- `transcript_rejected` - Failed transcript QC
- `translation_ready` - Ready for translation
- `translation_in_progress` - Being translated
- `translation_qc` - In translation quality check
- `translation_rejected` - Failed translation QC
- `mint_ready` - Ready for NFT minting
- `ipfs_pinned` - Pinned to IPFS
- `minted` - NFTs minted
- `sellable` - Available in marketplace

**Indexes:**
- idx_audio_clips_uploader (uploader_id)
- idx_audio_clips_dialect (dialect_id)
- idx_audio_clips_status (status)
- idx_audio_clips_created_at (created_at DESC)

**RLS Policies:**
- Uploaders can view/insert/update their own clips
- Contributors can view clips they're working on
- Reviewers can view clips in QC
- Buyers can view sellable clips

---

### 5. transcriptions

Transcribed text from audio clips.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Transcription ID |
| audio_clip_id | UUID | FK → audio_clips, UNIQUE, NOT NULL | Associated audio clip |
| transcriber_id | UUID | FK → profiles, NOT NULL | User who transcribed |
| content | TEXT | NOT NULL | Transcription text |
| speaker_count | INTEGER | | Number of speakers identified |
| speaker_turns | INTEGER | | Number of speaker changes |
| tags | TEXT[] | DEFAULT '{}' | Tags from transcription |
| metadata | JSONB | DEFAULT '{}' | Additional metadata |
| transcript_url | TEXT | | Supabase Storage URL |
| transcript_cid | TEXT | | IPFS CID (after pinning) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Constraints:**
- UNIQUE(audio_clip_id) - One transcription per audio clip

**Indexes:**
- idx_transcriptions_audio_clip (audio_clip_id)
- idx_transcriptions_transcriber (transcriber_id)

**RLS Policies:**
- Transcribers can view/insert/update their own transcriptions
- Reviewers can view transcriptions for QC
- Translators can view transcriptions for claimed translation tasks

---

### 6. translations

English translations of transcriptions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Translation ID |
| audio_clip_id | UUID | FK → audio_clips, UNIQUE, NOT NULL | Associated audio clip |
| translator_id | UUID | FK → profiles, NOT NULL | User who translated |
| content | TEXT | NOT NULL | English translation |
| metadata | JSONB | DEFAULT '{}' | Additional metadata |
| translation_url | TEXT | | Supabase Storage URL |
| translation_cid | TEXT | | IPFS CID (after pinning) |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Constraints:**
- UNIQUE(audio_clip_id) - One translation per audio clip

**Indexes:**
- idx_translations_audio_clip (audio_clip_id)
- idx_translations_translator (translator_id)

**RLS Policies:**
- Translators can view/insert/update their own translations
- Reviewers can view translations for QC

---

### 7. tasks

Work tasks for contributors (transcription, translation, QC).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Task ID |
| audio_clip_id | UUID | FK → audio_clips, NOT NULL | Associated audio clip |
| task_type | TEXT | NOT NULL, CHECK | Type of task |
| status | TEXT | NOT NULL, CHECK | Task status |
| claimed_by | UUID | FK → profiles | User who claimed the task |
| claimed_at | TIMESTAMPTZ | | When task was claimed |
| expires_at | TIMESTAMPTZ | | When claim expires |
| submitted_at | TIMESTAMPTZ | | When work was submitted |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Task creation timestamp |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | Last update timestamp |

**Task Types:**
- `audio_qc` - Audio quality check
- `transcription` - Create transcription
- `transcript_qc` - Transcript quality check
- `translation` - Create translation
- `translation_qc` - Translation quality check

**Status Values:**
- `available` - Available to claim
- `claimed` - Claimed by a user
- `submitted` - Work submitted
- `approved` - Work approved
- `rejected` - Work rejected

**Constraints:**
- UNIQUE(audio_clip_id, task_type) - One task per type per clip

**Indexes:**
- idx_tasks_audio_clip (audio_clip_id)
- idx_tasks_status (status)
- idx_tasks_claimed_by (claimed_by)
- idx_tasks_expires_at (expires_at)

**RLS Policies:**
- Users can view available tasks for their roles
- Users can view their own claimed tasks
- Users can claim and update their own tasks

---

### 8. qc_reviews

Quality control reviews and decisions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Review ID |
| audio_clip_id | UUID | FK → audio_clips, NOT NULL | Reviewed audio clip |
| reviewer_id | UUID | FK → profiles, NOT NULL | Reviewer |
| review_type | TEXT | NOT NULL, CHECK | Type of review |
| decision | TEXT | NOT NULL, CHECK | approve/reject |
| reasons | TEXT[] | DEFAULT '{}' | Rejection reasons |
| notes | TEXT | | Additional notes |
| metadata | JSONB | DEFAULT '{}' | Additional metadata |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Review timestamp |

**Review Types:**
- `audio_qc` - Audio quality review
- `transcript_qc` - Transcript quality review
- `translation_qc` - Translation quality review

**Indexes:**
- idx_qc_reviews_audio_clip (audio_clip_id)
- idx_qc_reviews_reviewer (reviewer_id)
- idx_qc_reviews_type (review_type)

**RLS Policies:**
- Reviewers can view/insert their own reviews
- Contributors can view reviews of their work

---

### 9. nft_records

Hedera NFT minting records.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | NFT record ID |
| audio_clip_id | UUID | FK → audio_clips, NOT NULL | Associated audio clip |
| nft_type | TEXT | NOT NULL, CHECK | audio/transcript/translation |
| token_id | TEXT | NOT NULL | Hedera token ID |
| serial_numbers | INTEGER[] | NOT NULL | Array of 300 serial numbers |
| contributor_id | UUID | FK → profiles, NOT NULL | NFT recipient |
| ipfs_cid | TEXT | NOT NULL | IPFS metadata CID |
| metadata | JSONB | DEFAULT '{}' | Additional metadata |
| minted_at | TIMESTAMPTZ | DEFAULT NOW() | Minting timestamp |

**Constraints:**
- UNIQUE(audio_clip_id, nft_type) - One NFT record per type per clip

**Indexes:**
- idx_nft_records_audio_clip (audio_clip_id)
- idx_nft_records_contributor (contributor_id)
- idx_nft_records_token (token_id)

**RLS Policies:**
- Contributors can view their own NFT records
- Anyone can view NFT records for sellable clips

---

### 10. nft_burns

NFT burns from dataset purchases.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Burn ID |
| nft_record_id | UUID | FK → nft_records, NOT NULL | Burned NFT record |
| serial_number | INTEGER | NOT NULL | Specific serial number burned |
| purchase_id | UUID | NOT NULL | Associated purchase |
| burned_at | TIMESTAMPTZ | DEFAULT NOW() | Burn timestamp |
| transaction_id | TEXT | | Hedera transaction ID |

**Constraints:**
- UNIQUE(nft_record_id, serial_number) - One burn per serial

**Indexes:**
- idx_nft_burns_purchase (purchase_id)
- idx_nft_burns_burned_at (burned_at DESC)

**RLS Policies:**
- Contributors can view burns of their NFTs
- Buyers can view burns from their purchases

---

### 11. dataset_purchases

Dataset purchases by buyers.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Purchase ID |
| buyer_id | UUID | FK → profiles, NOT NULL | Buyer |
| sample_count | INTEGER | NOT NULL | Number of samples |
| price_usd | NUMERIC(10,2) | NOT NULL | Price in USD |
| price_hbar | NUMERIC(20,8) | NOT NULL | Price in HBAR |
| filters | JSONB | NOT NULL | Filters used |
| audio_clip_ids | UUID[] | NOT NULL | Included clips |
| export_url | TEXT | | Download URL |
| export_cid | TEXT | | IPFS CID |
| export_expires_at | TIMESTAMPTZ | | Export expiry |
| payment_transaction_id | TEXT | | Hedera transaction ID |
| payment_status | TEXT | DEFAULT 'pending', CHECK | pending/completed/failed/refunded |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Purchase timestamp |
| completed_at | TIMESTAMPTZ | | Completion timestamp |
| downloaded_at | TIMESTAMPTZ | | Download timestamp |

**Indexes:**
- idx_dataset_purchases_buyer (buyer_id)
- idx_dataset_purchases_status (payment_status)
- idx_dataset_purchases_created_at (created_at DESC)

**RLS Policies:**
- Buyers can view/insert their own purchases

---

### 12. payouts

Payments to contributors from dataset sales.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Payout ID |
| purchase_id | UUID | FK → dataset_purchases, NOT NULL | Source purchase |
| recipient_id | UUID | FK → profiles, NOT NULL | Recipient |
| payout_type | TEXT | NOT NULL, CHECK | audio/transcription/translation/qc_review |
| amount_usd | NUMERIC(10,2) | NOT NULL | Amount in USD |
| amount_hbar | NUMERIC(20,8) | NOT NULL | Amount in HBAR |
| nft_record_id | UUID | FK → nft_records | Related NFT (if applicable) |
| burned_serial_number | INTEGER | | Burned serial number |
| transaction_id | TEXT | | Hedera transaction ID |
| transaction_status | TEXT | DEFAULT 'pending', CHECK | pending/completed/failed |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Payout creation |
| processed_at | TIMESTAMPTZ | | Processing timestamp |

**Indexes:**
- idx_payouts_purchase (purchase_id)
- idx_payouts_recipient (recipient_id)
- idx_payouts_status (transaction_status)
- idx_payouts_created_at (created_at DESC)

**RLS Policies:**
- Recipients can view their own payouts

---

### 13. audit_logs

System audit trail (immutable).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| id | UUID | PRIMARY KEY | Log ID |
| user_id | UUID | FK → profiles | Actor |
| action | TEXT | NOT NULL | Action performed |
| resource_type | TEXT | NOT NULL | Resource type |
| resource_id | UUID | | Resource ID |
| details | JSONB | DEFAULT '{}' | Action details |
| ip_address | INET | | IP address |
| user_agent | TEXT | | User agent string |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | Log timestamp |

**Indexes:**
- idx_audit_logs_user (user_id)
- idx_audit_logs_resource (resource_type, resource_id)
- idx_audit_logs_created_at (created_at DESC)

**RLS Policies:**
- Users can view their own audit logs
- Anyone can insert audit logs
- No updates or deletes allowed

---

## Functions & Triggers

### Auto-Update Triggers

- `update_updated_at_column()` - Updates `updated_at` timestamp on row changes
- Applied to: profiles, audio_clips, transcriptions, translations, tasks

### Task Management

- `create_task_on_status_change()` - Auto-creates tasks when audio status changes
- `prevent_duplicate_claims()` - Prevents users from claiming multiple tasks for same clip
- `expire_old_tasks()` - Releases expired task claims (run via cron)

### Helper Functions

- `user_has_role(role_name TEXT)` - Checks if user has a specific role
- `is_admin()` - Checks if user is admin
- `get_contributor_stats(contributor_uuid UUID)` - Returns contributor statistics
- `get_platform_stats()` - Returns platform-wide statistics (admin only)

---

## Migration Guide

### Setup Order

1. **Run schema.sql** - Creates all tables and indexes
2. **Run rls-policies.sql** - Applies Row Level Security policies
3. **Run seed.sql** - Inserts reference data and creates helper functions

### Supabase Setup

```bash
# Using Supabase CLI
supabase db push

# Or manually in Supabase Dashboard:
# 1. Go to SQL Editor
# 2. Run schema.sql
# 3. Run rls-policies.sql
# 4. Run seed.sql
```

### Local Development

```bash
# Start local Supabase
supabase start

# Apply migrations
supabase db reset
```

---

## Best Practices

### Security

- ✅ All tables have RLS enabled
- ✅ Use publishable key for client operations
- ✅ Use secret key only for admin operations
- ✅ Never expose secret key to client
- ✅ Audit logs are immutable

### Performance

- ✅ Indexes on frequently queried columns
- ✅ Composite indexes for common queries
- ✅ JSONB for flexible metadata
- ✅ Arrays for one-to-many without joins

### Data Integrity

- ✅ Foreign key constraints
- ✅ Unique constraints on business rules
- ✅ CHECK constraints for enums
- ✅ Triggers for automatic task creation
- ✅ One transcription/translation per clip

---

## Support

For questions or issues with the database schema:
- Review this documentation
- Check [PROJECT_PROGRESS.md](../PROJECT_PROGRESS.md)
- See [SUPABASE_CONFIG.md](SUPABASE_CONFIG.md) for setup details

---

**Schema Version:** 1.0.0  
**Last Updated:** February 23, 2026
