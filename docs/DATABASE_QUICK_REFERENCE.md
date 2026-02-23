# Database Quick Reference

Quick reference guide for working with the Afridialect.ai database.

## Table Overview

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `profiles` | User profiles | id, email, hedera_account_id |
| `user_roles` | Role assignments | user_id, role |
| `dialects` | Supported dialects | code, name, country_code |
| `audio_clips` | Audio files | uploader_id, status, audio_url, audio_cid |
| `transcriptions` | Transcription text | audio_clip_id, transcriber_id, content |
| `translations` | English translations | audio_clip_id, translator_id, content |
| `tasks` | Work assignments | audio_clip_id, task_type, claimed_by, status |
| `qc_reviews` | QC decisions | audio_clip_id, reviewer_id, decision |
| `nft_records` | Minted NFTs | audio_clip_id, nft_type, token_id |
| `nft_burns` | Burned NFTs | nft_record_id, serial_number, purchase_id |
| `dataset_purchases` | Buyer purchases | buyer_id, sample_count, payment_status |
| `payouts` | Contributor payments | recipient_id, payout_type, amount_hbar |
| `audit_logs` | System audit trail | user_id, action, resource_type |

## Audio Lifecycle States

```
uploaded
   ↓
audio_qc → audio_rejected ❌
   ↓
transcription_ready
   ↓
transcription_in_progress
   ↓
transcript_qc → transcript_rejected ❌
   ↓
translation_ready
   ↓
translation_in_progress
   ↓
translation_qc → translation_rejected ❌
   ↓
mint_ready
   ↓
ipfs_pinned
   ↓
minted
   ↓
sellable ✅
```

## Task Types

| Task Type | Role | Purpose |
|-----------|------|---------|
| `audio_qc` | reviewer | Check audio quality |
| `transcription` | transcriber | Create transcription |
| `transcript_qc` | reviewer | Check transcription |
| `translation` | translator | Create translation |
| `translation_qc` | reviewer | Check translation |

## User Roles

- **uploader** - Upload audio files
- **transcriber** - Create transcriptions
- **translator** - Create translations
- **reviewer** - Perform QC reviews
- **buyer** - Purchase datasets
- **admin** - Platform administration

## Common Queries

### Get user's roles
```sql
SELECT role FROM user_roles WHERE user_id = 'uuid-here';
```

### Get available tasks for transcriber
```sql
SELECT * FROM tasks 
WHERE task_type = 'transcription' 
  AND status = 'available'
ORDER BY created_at ASC;
```

### Get user's audio clips
```sql
SELECT * FROM audio_clips 
WHERE uploader_id = 'uuid-here'
ORDER BY created_at DESC;
```

### Get sellable clips count by dialect
```sql
SELECT d.name, COUNT(*) as clip_count
FROM audio_clips ac
JOIN dialects d ON ac.dialect_id = d.id
WHERE ac.status = 'sellable'
GROUP BY d.name;
```

### Get user's total earnings
```sql
SELECT 
  SUM(amount_usd) as total_usd,
  SUM(amount_hbar) as total_hbar
FROM payouts
WHERE recipient_id = 'uuid-here'
  AND transaction_status = 'completed';
```

### Get contributor statistics
```sql
SELECT * FROM get_contributor_stats('uuid-here');
```

## Helper Functions

### Check if user has role
```sql
SELECT user_has_role('transcriber'); -- Returns boolean
```

### Check if user is admin
```sql
SELECT is_admin(); -- Returns boolean
```

### Get platform statistics (admin only)
```sql
SELECT * FROM get_platform_stats();
```

### Expire old tasks (run via cron)
```sql
SELECT expire_old_tasks();
```

## RLS Quick Reference

### Client Operations (Publishable Key)
- Always respects RLS policies
- Users see only their data
- Automatic security enforcement

### Admin Operations (Secret Key)
- Can bypass RLS
- Use sparingly and carefully
- Never expose to client

## Indexes

All tables have indexes on:
- Foreign keys
- Status fields
- Created/updated timestamps
- Frequently queried fields

## Constraints

### Unique Constraints
- One transcription per audio clip
- One translation per audio clip
- One task per type per audio clip
- One NFT record per type per audio clip
- One burn per NFT serial number

### Check Constraints
- Valid status values
- Valid role values
- Valid task types
- Valid review types

## Migrations

### Apply all migrations
```bash
./scripts/migrate-database.sh
```

### Manual application
1. Run `lib/supabase/schema.sql`
2. Run `lib/supabase/rls-policies.sql`
3. Run `lib/supabase/seed.sql`

## Security Best Practices

✅ **DO:**
- Use publishable key for client operations
- Implement RLS policies on all tables
- Use secret key only in API routes
- Validate user roles before operations
- Log sensitive actions to audit_logs

❌ **DON'T:**
- Expose secret key to client
- Bypass RLS without good reason
- Store sensitive data in metadata JSONB
- Allow direct table access without RLS

## Monitoring

### Check active claims
```sql
SELECT COUNT(*) FROM tasks WHERE status = 'claimed';
```

### Check expired claims
```sql
SELECT COUNT(*) FROM tasks 
WHERE status = 'claimed' AND expires_at < NOW();
```

### Check pending payments
```sql
SELECT COUNT(*), SUM(amount_usd) 
FROM payouts 
WHERE transaction_status = 'pending';
```

### Recent audit activity
```sql
SELECT * FROM audit_logs 
ORDER BY created_at DESC 
LIMIT 100;
```

## Troubleshooting

### User can't see data
- Check RLS policies
- Verify user has correct roles
- Check auth.uid() matches user_id

### Task claim fails
- Check if user already has task for same clip
- Check if task is already claimed
- Verify task hasn't expired

### Can't insert data
- Check foreign key constraints
- Verify unique constraints
- Check RLS INSERT policies

---

**See also:**
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Full schema documentation
- [SUPABASE_CONFIG.md](SUPABASE_CONFIG.md) - Supabase setup guide
- [PROJECT_PROGRESS.md](../PROJECT_PROGRESS.md) - Implementation progress
