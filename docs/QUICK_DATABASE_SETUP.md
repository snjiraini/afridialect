# Quick Database Setup (No Password Needed!)

## ⚡ Fastest Method: Supabase Dashboard

Since you have special characters in your database password, **the easiest approach is to use the Supabase Dashboard SQL Editor**. No password encoding needed!

### 5-Minute Setup

#### 1. Open Supabase Dashboard

Go to: **https://app.supabase.com/project/phjgebfpybxcbfkxnckb/sql/new**

(This opens the SQL Editor directly for your project)

#### 2. Run SQL Files (Copy & Paste)

Run these files **in order**:

##### Step 1: Create Tables

1. Open `lib/supabase/schema.sql` in VS Code
2. Press `Ctrl+A` (or `Cmd+A`) to select all
3. Press `Ctrl+C` (or `Cmd+C`) to copy
4. Go to Supabase SQL Editor
5. Paste the contents
6. Click **"Run"** (or press `Ctrl+Enter`)
7. Wait ~5-10 seconds
8. ✅ Should see "Success. No rows returned"

##### Step 2: Apply Security Policies

1. Click **"New query"** in SQL Editor
2. Open `lib/supabase/rls-policies.sql` in VS Code
3. Select all and copy (`Ctrl+A`, `Ctrl+C`)
4. Paste into SQL Editor
5. Click **"Run"**
6. Wait ~5-10 seconds
7. ✅ Should see "Success. No rows returned"

##### Step 3: Insert Seed Data

1. Click **"New query"** in SQL Editor
2. Open `lib/supabase/seed.sql` in VS Code
3. Select all and copy (`Ctrl+A`, `Ctrl+C`)
4. Paste into SQL Editor
5. Click **"Run"**
6. Wait ~5-10 seconds
7. ✅ Should see "Success" with some insert counts

#### 3. Verify Setup

In your terminal, run:

```bash
npm run test:db
```

Expected output:
```
✅ DATABASE SCHEMA TEST PASSED!
```

---

## 🔧 Alternative: Fix DATABASE_URL (If You Need psql)

If you want to use command-line tools later, you need the correct DATABASE_URL.

### Option A: Get It from Dashboard (Recommended)

1. Go to: https://app.supabase.com/project/phjgebfpybxcbfkxnckb/settings/database
2. Scroll to **"Connection string"**
3. Select **"URI"** from dropdown
4. Click **"Copy"** - this includes the password already encoded!
5. Replace the DATABASE_URL line in `.env.local` with this

### Option B: Encode Your Password

If you have the password separately:

```bash
node scripts/encode-password.js
```

This will:
- Prompt for your password (hidden)
- Show you the URL-encoded version
- Give you the full DATABASE_URL to copy

---

## ✅ After Setup

Once setup is complete, you'll have:

- ✅ 15 database tables
- ✅ 35+ security policies  
- ✅ 7 helper functions
- ✅ Seed data loaded
- ✅ Ready for Phase 3!

Run this to verify:
```bash
npm run test:db
```

---

## 💡 Why Dashboard Method is Easier

1. **No password encoding needed** - Supabase handles auth
2. **Better error messages** - See exactly what failed
3. **Works immediately** - No CLI setup required
4. **Can see results** - View tables in Table Editor right away

---

## 🆘 Troubleshooting

### "Password encoding failed"
→ Use Dashboard method instead (no encoding needed)

### "Connection refused"  
→ DATABASE_URL is wrong, use Dashboard method

### "Already exists" errors
→ This is OK! Means tables were already created

### Test fails after setup
→ Check Supabase Dashboard → Table Editor
→ Should see 15 tables including: profiles, audio_clips, dialects

---

**Recommended:** Use the Dashboard method above ⬆️

**Time Required:** 5 minutes  
**Last Updated:** February 23, 2026
