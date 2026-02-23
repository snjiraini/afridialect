# Database Setup Guide

## Current Status
❌ Database schema **NOT YET APPLIED** to Supabase

## Quick Setup (5 minutes)

### Step 1: Access Supabase Dashboard

1. Go to: https://app.supabase.com
2. Sign in to your account
3. Select your **afridialect** project

### Step 2: Open SQL Editor

1. Click **"SQL Editor"** in the left sidebar
2. Click **"New query"** button

### Step 3: Apply Schema (Run these in order)

#### 3.1 Create Tables & Indexes

1. Open file: `lib/supabase/schema.sql`
2. **Copy ALL contents** (350+ lines)
3. Paste into SQL Editor
4. Click **"Run"** (or press Ctrl/Cmd + Enter)
5. Wait for completion (should take 5-10 seconds)
6. ✅ You should see "Success. No rows returned"

#### 3.2 Apply RLS Policies

1. Create a **new query** (click "+ New query")
2. Open file: `lib/supabase/rls-policies.sql`
3. **Copy ALL contents** (400+ lines)
4. Paste into SQL Editor
5. Click **"Run"**
6. Wait for completion (should take 5-10 seconds)
7. ✅ You should see "Success. No rows returned"

#### 3.3 Insert Seed Data

1. Create a **new query** (click "+ New query")
2. Open file: `lib/supabase/seed.sql`
3. **Copy ALL contents** (350+ lines)
4. Paste into SQL Editor
5. Click **"Run"**
6. Wait for completion (should take 5-10 seconds)
7. ✅ You should see "Success" with row counts

### Step 4: Verify Setup

#### 4.1 Check Tables

1. Click **"Table Editor"** in left sidebar
2. You should see **15 tables**:
   - profiles
   - user_roles
   - dialects
   - audio_clips
   - transcriptions
   - translations
   - tasks
   - qc_reviews
   - nft_records
   - nft_burns
   - dataset_purchases
   - payouts
   - audit_logs
   - rejection_reasons
   - system_config

#### 4.2 Check Seed Data

1. Click on **"dialects"** table
2. You should see **2 rows**:
   - Kikuyu (code: kikuyu, country: KE)
   - Swahili (code: swahili, country: KE)

3. Click on **"rejection_reasons"** table
4. You should see **~18 rows** with various rejection categories

5. Click on **"system_config"** table
6. You should see **~6 rows** with configuration keys

#### 4.3 Check RLS Policies

1. Click **"Authentication"** in left sidebar
2. Click **"Policies"** tab
3. You should see **35+ policies** across all tables
4. Each table should show RLS as **"Enabled"**

### Step 5: Test Connection

Run the test script from your terminal:

```bash
node scripts/test-database.js
```

Expected output:
```
✅ DATABASE SCHEMA TEST PASSED!

📊 Summary:
   • Connection: ✅ Working
   • Tables: ✅ All present
   • Seed data: ✅ Loaded
   • RLS policies: ✅ Active
```

---

## Troubleshooting

### Error: "relation does not exist"
- Make sure you ran schema.sql FIRST
- Check that all tables show in Table Editor

### Error: "function does not exist"
- Make sure you ran seed.sql (contains helper functions)
- Check SQL Editor history for any errors

### RLS Test Fails
- Make sure you ran rls-policies.sql
- Check Authentication → Policies shows policies for all tables

### Tables Missing
- Re-run schema.sql
- Check SQL Editor for error messages
- Make sure you copied the ENTIRE file content

---

## Alternative: CLI Method (Advanced)

If you have `psql` installed:

```bash
# Get your database connection string from Supabase Dashboard
# Settings → Database → Connection string (URI format)

psql "your-connection-string" -f lib/supabase/schema.sql
psql "your-connection-string" -f lib/supabase/rls-policies.sql
psql "your-connection-string" -f lib/supabase/seed.sql
```

---

## What Gets Created

### Tables (13 Core)
1. **profiles** - User profiles
2. **user_roles** - Role assignments
3. **dialects** - Supported languages
4. **audio_clips** - Audio files (14-state lifecycle)
5. **transcriptions** - Transcribed text
6. **translations** - English translations
7. **tasks** - Work assignments
8. **qc_reviews** - Quality control reviews
9. **nft_records** - Minted NFTs
10. **nft_burns** - Burned NFTs
11. **dataset_purchases** - Buyer purchases
12. **payouts** - Contributor payments
13. **audit_logs** - System audit trail

### Reference Tables (2)
14. **rejection_reasons** - QC rejection categories
15. **system_config** - Platform configuration

### Security (35+ Policies)
- Row Level Security on all tables
- Role-based access control
- Users see only their data
- Reviewers see only QC items
- Buyers see only sellable clips

### Functions (7)
- `user_has_role()` - Check user role
- `is_admin()` - Check admin status
- `get_contributor_stats()` - User statistics
- `get_platform_stats()` - Platform metrics
- `expire_old_tasks()` - Auto-release claims
- Auto-task creation triggers
- Duplicate claim prevention

---

## Next Steps After Setup

Once the database is set up:

1. ✅ Run `node scripts/test-database.js` to verify
2. ✅ Commit the Supabase client files
3. ✅ Ready for Phase 3: Authentication implementation

---

## Support

If you encounter issues:
1. Check Supabase Dashboard → Logs for errors
2. Review SQL Editor history for failed queries
3. Verify .env.local has correct credentials
4. See [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) for detailed reference

---

**Status:** Awaiting setup ⏳  
**Estimated Time:** 5 minutes  
**Last Updated:** February 23, 2026
