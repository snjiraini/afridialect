# Afridialect Technical Documentation

**Last Updated:** February 24, 2026

## Table of Contents

1. [Quick Start](#quick-start)
2. [Project Structure](#project-structure)
3. [Database Setup](#database-setup)
4. [Authentication Setup](#authentication-setup)
5. [Hedera & KMS Setup](#hedera--kms-setup)
6. [Proxy Configuration](#proxy-configuration)
7. [Environment Variables](#environment-variables)
8. [Database Schema Reference](#database-schema-reference)

---

## 1. Quick Start

### Prerequisites
- Node.js 18+ (LTS)
- PostgreSQL 14+
- Supabase account
- AWS account (for KMS)
- Hedera testnet account

### Installation
```bash
# Clone the repository
git clone https://github.com/snjiraini/afridialect.git
cd afridialect

# Install dependencies
npm install

# Copy environment template
cp .env.example .env.local

# Configure environment variables (see section 7)

# Run database migrations
npm run db:migrate

# Start development server
npm run dev
```

### First-Time Setup Checklist
- [ ] Configure Supabase project
- [ ] Set up authentication providers
- [ ] Create database schema and RLS policies
- [ ] Configure AWS KMS keys
- [ ] Set up Hedera treasury account
- [ ] Test authentication flow
- [ ] Test Hedera account creation

---

## 2. Project Structure

```
afridialect/
├── app/                      # Next.js 16 app directory
│   ├── api/                  # API routes
│   │   ├── hedera/           # Hedera-related endpoints
│   │   │   └── create-account/
│   │   └── auth/             # Auth callbacks
│   ├── auth/                 # Auth pages
│   │   ├── login/
│   │   ├── signup/
│   │   ├── reset-password/
│   │   └── update-password/
│   ├── dashboard/            # User dashboard
│   │   └── components/       # Dashboard-specific components
│   ├── marketplace/          # Dataset marketplace
│   ├── uploader/             # Audio upload interface
│   ├── transcriber/          # Transcription interface
│   ├── translator/           # Translation interface
│   ├── reviewer/             # QC/Review interface
│   └── admin/                # Admin panel
├── components/               # Shared React components
│   ├── forms/                # Form components
│   ├── layouts/              # Layout components (Header, Footer)
│   └── ui/                   # UI primitives
├── hooks/                    # Custom React hooks
│   ├── useAuth.tsx           # Authentication hook
│   ├── useUser.ts            # User data hook
│   └── useHederaAccount.ts   # Hedera operations hook
├── lib/                      # Core library code
│   ├── supabase/             # Supabase clients
│   │   ├── client.ts         # Browser client
│   │   ├── server.ts         # Server client
│   │   ├── admin.ts          # Admin client
│   │   ├── schema.sql        # Database schema
│   │   ├── rls-policies.sql  # Row Level Security
│   │   └── triggers.sql      # Database triggers
│   ├── hedera/               # Hedera integration
│   │   ├── client.ts         # Hedera client setup
│   │   └── account.ts        # Account operations
│   ├── aws/                  # AWS services
│   │   └── kms.ts            # KMS operations
│   └── utils/                # Utility functions
├── middleware/               # (Deprecated - see proxy.ts)
├── proxy.ts                  # Next.js 16 proxy (route protection)
├── scripts/                  # Utility scripts
│   ├── setup-database.js     # Database setup
│   ├── setup-kms.sh          # KMS setup
│   └── test-hedera-api.sh    # Hedera API testing
├── types/                    # TypeScript type definitions
└── docs/                     # Documentation
    ├── afridialect_prd.md    # Product requirements
    ├── technical_docs.md     # This file
    └── phase_progress_and_completion.md
```

### Key Directories

**`app/`**: Next.js App Router structure with file-based routing
**`lib/`**: Business logic and external service integrations
**`components/`**: Reusable UI components
**`hooks/`**: Custom React hooks for state management
**`proxy.ts`**: Route protection and session management (Next.js 16)

---

## 3. Database Setup

### Supabase Configuration

1. **Create Supabase Project**
   - Go to https://supabase.com
   - Create new project
   - Note your project URL and anon key

2. **Run Schema Migration**
   ```bash
   npm run db:migrate
   ```

3. **Apply RLS Policies**
   ```sql
   -- Run lib/supabase/rls-policies.sql in Supabase SQL Editor
   ```

4. **Set Up Triggers**
   ```sql
   -- Run lib/supabase/triggers.sql in Supabase SQL Editor
   ```

### Database Quick Reference

**Core Tables:**
- `profiles` - User profiles (auto-created on signup)
- `user_roles` - Role assignments (uploader, transcriber, translator, reviewer, admin)
- `audio_clips` - Audio uploads
- `transcriptions` - Transcription data
- `translations` - Translation data
- `reviews` - QC reviews
- `nft_tokens` - Minted NFT records
- `purchases` - Dataset purchases
- `audit_logs` - System audit trail

**Key Relationships:**
```
users (auth.users)
  └── profiles (1:1)
       ├── user_roles (1:N)
       ├── audio_clips (1:N, as uploader)
       ├── transcriptions (1:N, as transcriber)
       └── translations (1:N, as translator)

audio_clips
  ├── transcriptions (1:N)
  ├── translations (1:N)
  ├── reviews (1:N)
  └── nft_tokens (1:N)
```

### Database Backup
```bash
# Export schema
pg_dump -U postgres -h db.xxx.supabase.co -d postgres --schema-only > backup_schema.sql

# Export data
pg_dump -U postgres -h db.xxx.supabase.co -d postgres --data-only > backup_data.sql
```

---

## 4. Authentication Setup

### Supabase Auth Configuration

1. **Enable Email Provider**
   - Supabase Dashboard → Authentication → Providers
   - Enable "Email" provider
   - Configure email templates

2. **Configure OAuth Providers (Optional)**
   - Google OAuth
   - GitHub OAuth

3. **Set Redirect URLs**
   - Development: `http://localhost:3000/auth/callback`
   - Production: `https://yourdomain.com/auth/callback`

### Authentication Flow

```mermaid
graph LR
    A[User] --> B[Login/Signup Page]
    B --> C[Supabase Auth]
    C --> D[Email Confirmation]
    D --> E[Auth Callback]
    E --> F[Profile Created via Trigger]
    F --> G[Dashboard]
```

### Profile Auto-Creation

A database trigger automatically creates a profile when a user signs up:

```sql
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
```

The trigger function:
- Creates a `profiles` record
- Sets initial user role
- Initializes default settings

### Testing Authentication

```bash
# Test signup
curl -X POST http://localhost:3000/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# Test login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'
```

---

## 5. Hedera & KMS Setup

### AWS KMS Configuration

#### Step 1: Create IAM User

```bash
# Create IAM user
aws iam create-user --user-name afridialect-kms-user

# Attach policy
aws iam put-user-policy \
  --user-name afridialect-kms-user \
  --policy-name AfridialectKMSPolicy \
  --policy-document file://docs/hedera-kms-policy.json

# Create access keys
aws iam create-access-key --user-name afridialect-kms-user
```

#### Step 2: Create Platform Guardian Key

```bash
# Create the platform guardian KMS key
aws kms create-key \
  --key-usage SIGN_VERIFY \
  --key-spec ECC_SECG_P256K1 \
  --description "Afridialect Platform Guardian Key" \
  --tags TagKey=Purpose,TagValue=PlatformGuardian TagKey=Project,TagValue=Afridialect

# Create alias
aws kms create-alias \
  --alias-name alias/afridialect-guardian \
  --target-key-id <KEY_ID_FROM_ABOVE>
```

#### Step 3: Update Environment Variables

```env
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<your_access_key>
AWS_SECRET_ACCESS_KEY=<your_secret_key>
AWS_KMS_KEY_ID=<guardian_key_id>
```

### IAM Policy (hedera-kms-policy.json)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowKMSKeyManagement",
      "Effect": "Allow",
      "Action": [
        "kms:CreateKey",
        "kms:CreateAlias",
        "kms:DeleteAlias",
        "kms:DescribeKey",
        "kms:GetPublicKey",
        "kms:GetKeyPolicy",
        "kms:ListAliases",
        "kms:ListKeys",
        "kms:TagResource",
        "kms:UntagResource",
        "kms:UpdateAlias",
        "kms:ScheduleKeyDeletion"
      ],
      "Resource": "*"
    },
    {
      "Sid": "AllowKMSSigning",
      "Effect": "Allow",
      "Action": ["kms:Sign", "kms:Verify"],
      "Resource": "*",
      "Condition": {
        "StringEquals": {
          "kms:SigningAlgorithm": "ECDSA_SHA_256"
        }
      }
    }
  ]
}
```

### Hedera Account Setup

#### Create Treasury Account

1. Go to https://portal.hedera.com
2. Create testnet account
3. Fund with HBAR from faucet
4. Note account ID and private key

#### Configure Environment

```env
HEDERA_NETWORK=testnet
HEDERA_TREASURY_ACCOUNT_ID=0.0.YOUR_ACCOUNT
HEDERA_TREASURY_PRIVATE_KEY=your_private_key
```

### User Account Creation Flow

When a user clicks "Create Hedera Account":

1. **Create User KMS Key**
   - KeySpec: `ECC_SECG_P256K1` (secp256k1)
   - KeyUsage: `SIGN_VERIFY`
   - SigningAlgorithm: `ECDSA_SHA_256`

2. **Get Platform Guardian Key**
   - Retrieve from `AWS_KMS_KEY_ID`

3. **Create ThresholdKey (2-of-2)**
   ```typescript
   const thresholdKey = new KeyList([userPublicKey, guardianPublicKey], 2)
   ```

4. **Create Hedera Account**
   - Initial balance: 1 HBAR
   - Key: ThresholdKey
   - Max auto-token associations: 10

5. **Store in Database**
   ```sql
   UPDATE profiles
   SET hedera_account_id = '0.0.XXX',
       kms_key_id = 'kms-key-id'
   WHERE id = user_id;
   ```

### Testing Hedera Integration

```bash
# Test configuration
npm run test:hedera

# Test account creation API
curl -X POST http://localhost:3000/api/hedera/create-account \
  -H "Cookie: sb-access-token=YOUR_TOKEN"
```

---

## 6. Proxy Configuration

### Next.js 16 Proxy Pattern

**File:** `proxy.ts` (root level)

The proxy replaces the deprecated `middleware.ts` convention in Next.js 16.

```typescript
import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'

export default async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { session },
  } = await supabase.auth.getSession()

  // Protected routes
  const protectedPaths = ['/dashboard', '/uploader', '/transcriber', '/translator', '/reviewer', '/admin']
  const isProtectedPath = protectedPaths.some((path) => request.nextUrl.pathname.startsWith(path))

  if (isProtectedPath && !session) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  // Admin-only routes
  if (request.nextUrl.pathname.startsWith('/admin') && session) {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', session.user.id)
      .eq('role', 'admin')
      .single()

    if (!roles) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

### Migration from middleware.ts

If you have an existing `middleware.ts`:
1. Rename to `proxy.ts`
2. Change export: `export async function middleware()` → `export default async function proxy()`
3. Remove HTTP method exports (GET, POST, etc.)
4. Keep the same logic

---

## 7. Environment Variables

### Complete .env.local Template

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# AWS KMS
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
AWS_KMS_KEY_ID=09cac3d6-d172-4981-ba6b-ea966328d18b

# Hedera
HEDERA_NETWORK=testnet
HEDERA_TREASURY_ACCOUNT_ID=0.0.12345
HEDERA_TREASURY_PRIVATE_KEY=302e020100300506032b657004220420...

# Application
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
```

### Environment Variable Descriptions

| Variable | Purpose | Required |
|----------|---------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key | ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Admin operations | ✅ |
| `AWS_REGION` | AWS region for KMS | ✅ |
| `AWS_ACCESS_KEY_ID` | KMS user access key | ✅ |
| `AWS_SECRET_ACCESS_KEY` | KMS user secret | ✅ |
| `AWS_KMS_KEY_ID` | Platform guardian key | ✅ |
| `HEDERA_NETWORK` | testnet or mainnet | ✅ |
| `HEDERA_TREASURY_ACCOUNT_ID` | Platform treasury | ✅ |
| `HEDERA_TREASURY_PRIVATE_KEY` | Treasury key | ✅ |

---

## 8. Database Schema Reference

### Core Tables

#### profiles
```sql
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  hedera_account_id TEXT UNIQUE,
  kms_key_id TEXT UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### user_roles
```sql
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('uploader', 'transcriber', 'translator', 'reviewer', 'admin', 'buyer')),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, role)
);
```

#### audio_clips
```sql
CREATE TABLE audio_clips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  uploader_id UUID REFERENCES profiles ON DELETE CASCADE,
  dialect TEXT NOT NULL,
  duration_seconds NUMERIC NOT NULL,
  file_path TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'uploaded',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### audit_logs
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Row Level Security (RLS)

All tables have RLS enabled. Key policies:

**profiles:**
- Users can read their own profile
- Users can update their own profile
- Service role has full access

**audio_clips:**
- Uploaders can insert their own clips
- Reviewers can read clips in review status
- Transcribers can read claimed clips
- Buyers can read purchased clips

**audit_logs:**
- Users can read their own logs
- Admins can read all logs
- System can insert (via service role)

### Database Triggers

#### Profile Creation Trigger
```sql
CREATE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

#### Updated Timestamp Trigger
```sql
CREATE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## Troubleshooting

### Common Issues

**1. Supabase Connection Errors**
- Check `.env.local` has correct URL and keys
- Verify Supabase project is running
- Check RLS policies allow your operation

**2. KMS Permission Errors**
- Verify IAM policy is attached
- Check AWS credentials are correct
- Ensure KMS key exists in correct region

**3. Hedera Account Creation Fails**
- Verify treasury account has sufficient HBAR
- Check network (testnet vs mainnet)
- Ensure KMS keys are `ECC_SECG_P256K1`

**4. Proxy/Middleware Not Working**
- Ensure file is named `proxy.ts` (not `middleware.ts`)
- Check export is `export default async function proxy()`
- Verify matcher config excludes static files

### Debug Commands

```bash
# Check environment variables
npm run env:check

# Test database connection
npm run db:test

# Test Hedera configuration
npm run test:hedera

# Check build for errors
npm run build

# View logs
npm run dev
```

---

## Additional Resources

- [Hedera Documentation](https://docs.hedera.com)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js 16 Documentation](https://nextjs.org/docs)
- [AWS KMS Documentation](https://docs.aws.amazon.com/kms/)

**For questions or support:**
- GitHub Issues: https://github.com/snjiraini/afridialect/issues
- Email: support@afridialect.ai
