# Afridialect Technical Documentation

**Last Updated:** March 4, 2026

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

### Email Configuration

#### Supabase Email Rate Limits

**Free Tier:**
- 3 emails per hour per email address
- 30 emails per hour total

**Solutions:**
1. **For Development:** 
   - Disable email confirmation in Supabase Dashboard → Authentication → Providers → Email → Confirm email: OFF
   - Use different email addresses for testing
   
2. **For Production:**
   - Configure custom SMTP (see below)
   - Upgrade to paid tier for higher limits

#### Configure Custom SMTP (Production)

1. **Get SMTP credentials** (recommended providers):
   - SendGrid (free tier: 100 emails/day)
   - AWS SES (0.10 per 1000 emails)
   - Mailgun, Postmark, etc.

2. **Configure in Supabase:**
   - Dashboard → Project Settings → Auth → SMTP Settings
   - Enter SMTP server, port, username, password
   - Test email delivery

3. **Update email templates:**
   - Dashboard → Authentication → Email Templates
   - Customize signup, password reset, magic link templates

#### Disable Email Verification & Domain Validation (Development Only)

**Quick Setup:**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **Authentication** → **Settings**
4. Scroll to **Email Auth** section
5. Find **"Enable email confirmations"** → **Toggle it OFF**
6. Find **"Secure email change"** → **Toggle it OFF** (if present)
7. Find **"Enable domain validation"** or **"Validate email domains"** → **Toggle it OFF**
8. Click **Save**

**Alternative (if toggle not available):**
If you don't see a "Validate email domains" toggle, you can work around it by:
- Using real email domains that have MX records (gmail.com, yahoo.com, outlook.com)
- Using test email services like:
  - `user@mailinator.com` (public inbox)
  - `user@guerrillamail.com` (temporary emails)
  - `user@10minutemail.com` (disposable emails)
- Contact Supabase support to disable domain validation for your project

**What This Changes:**

Before (Email Verification Enabled):
```
User Signs Up → Email Sent → User Clicks Link → Email Confirmed → User Can Login
```

After (Email Verification Disabled):
```
User Signs Up → User Can Login Immediately ✓
```

**Current App Implementation:**
- ✅ Signup redirects directly to dashboard (`/app/auth/signup/page.tsx`)
- ✅ No email confirmation messages shown in UI
- ✅ Profile page has no verification warnings (`/app/profile/page.tsx`)
- ✅ Auth hook configured for immediate access (`/hooks/useAuth.tsx`)

**Testing After Disabling:**
1. Visit `/auth/signup`
2. Create account with any email
3. Should redirect to `/dashboard` immediately
4. Can login without email verification

**⚠️ Security Note:**
- Users can signup with any email (even if they don't own it)
- Higher risk of spam/fake accounts
- **Recommended:** Only disable for development/testing
- **For Production:** Keep enabled or use social login (Google, GitHub)

#### Create Test Users (Admin Only)

For testing purposes, admins can create users with **any email address** (doesn't need to exist) using the Admin Panel:

1. **Access:** Go to `/admin/users` (must be logged in as admin)
2. **Find:** "Create Test User" form at the top
3. **Features:**
   - Requires valid email format (user@domain.ext)
   - Email doesn't need to actually exist
   - Examples: `testuser123@myemail.com`, `john@example.com`, `test@fake.local`
   - Auto-confirms email (no verification needed)
   - Click "Generate" for random test email
4. **Usage:**
   ```
   Email: testuser123@myemail.com  ✅ Valid format
   Email: test@test.local          ✅ Valid format
   Email: invalid-email            ❌ Invalid format (no @ or domain)
   Password: password123
   Full Name: Test User (optional)
   ```

**How It Works:**
- Uses Supabase Admin API (`auth.admin.createUser`)
- Validates email format but Supabase also checks domain MX records
- Sets `email_confirm: true` automatically
- Logs action in audit_logs table

**Workaround for Domain Validation:**
Since Supabase validates email domains, use one of these approaches:

1. **Use Real Email Domains (Recommended for Testing):**
   ```
   test123@gmail.com          ✅ Works (gmail has valid MX records)
   user456@yahoo.com          ✅ Works (yahoo has valid MX records)
   demo@outlook.com           ✅ Works (outlook has valid MX records)
   ```

2. **Use Test Email Services:**
   ```
   test@mailinator.com        ✅ Works (public inbox, no password needed)
   test@guerrillamail.com     ✅ Works (temporary email service)
   ```

3. **Use Your Actual Domain (if configured):**
   ```
   test@afridialect.ai        ✅ Works only if afridialect.ai has MX records
   ```

**What Won't Work:**
```
test@fake.local              ❌ Fails (no MX records)
test@myemail.com             ❌ Fails (no MX records unless you own domain)
test@test.test               ❌ Fails (no MX records)
```

**API Endpoint:**
```typescript
POST /api/admin/create-user
Authorization: Admin role required
Body: { email: string, password: string, fullName?: string }
```

**Regular Signup Form:**
The standard `/auth/signup` form validates email format and domain:
- Must look like valid email: `user@domain.ext`
- Domain must have valid DNS/MX records
- Email doesn't need to exist (won't receive actual emails)
- Examples: `test@gmail.com`, `demo@yahoo.com`, `user@outlook.com`
- Use test email services like mailinator.com for throwaway accounts

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
   - **Disable email confirmation requirement** (Optional):
     - Go to Authentication → Settings
     - Under "Email Auth", uncheck "Enable email confirmations"
     - This allows users to login immediately after signup

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

### KMS Transaction Signing (`signForHedera`)

Hedera's `TransferTransaction` debits the buyer's account, which is protected by a ThresholdKey (2-of-2). Both keys must sign before `execute()` is called. Because both keys live in AWS KMS (never in memory), signing uses a custom signer passed to the SDK's `signWith()` callback.

#### Why the signer works this way

The Hedera SDK's `signWith(publicKey, signerFn)` passes raw **protobuf `bodyBytes`** to `signerFn` and expects a **raw 64-byte r‖s signature** back. AWS KMS returns DER-encoded signatures. These two facts drive the three-step process below.

#### Key setup

```typescript
const kmsClient = new KMSClient({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
  region: process.env.AWS_REGION || 'us-east-1',
})
```

#### The signer (`signForHedera` in `lib/aws/kms.ts`)

```typescript
const signer = async (message: Uint8Array): Promise<Uint8Array> => {
  // 1. Send raw transaction bytes to KMS — KMS applies SHA-256 internally
  //    before signing with ECDSA_SHA_256 (MessageType:'RAW')
  const { Signature } = await kmsClient.send(new SignCommand({
    KeyId: keyId,
    Message: message,
    MessageType: 'RAW',          // KMS hashes with SHA-256 internally
    SigningAlgorithm: 'ECDSA_SHA_256',
  }))

  // 2. DER-decode the signature → raw 64-byte r‖s
  //    DER structure: 0x30 [len] 0x02 [rLen] [r] 0x02 [sLen] [s]
  //    DER may zero-pad r or s to 33 bytes when the high bit is set.
  //    We right-align each component into a fixed 32-byte slot.
  const der = Buffer.from(Signature!)
  // ... (parse offset, rLen, sLen, right-align into Uint8Array(64))

  return result  // 64 bytes: r (32) || s (32)
}
```

#### Attaching both ThresholdKey signatures

```typescript
// Freeze first — required before any signWith calls
transferTx.freezeWith(client)

// Key 1: buyer's KMS key
const buyerPub = PublicKey.fromBytes(await getPublicKey(buyerKmsKeyId))
await transferTx.signWith(buyerPub, (msg) => signForHedera(buyerKmsKeyId, msg))

// Key 2: platform guardian KMS key
const guardianPub = PublicKey.fromBytes(await getPublicKey(guardianKmsKeyId))
await transferTx.signWith(guardianPub, (msg) => signForHedera(guardianKmsKeyId, msg))

// execute() adds the operator fee-payer signature (HEDERA_OPERATOR_PRIVATE_KEY)
// — this is separate from the ThresholdKey and does NOT replace Key 2 above
const result = await transferTx.execute(client)
```

#### Critical notes

| Point | Detail |
|---|---|
| Key spec | `ECC_SECG_P256K1` (secp256k1) — required for Hedera ECDSA accounts |
| `MessageType` | `'RAW'` — KMS SHA-256 hashes internally, matching what Hedera SDK verifies |
| DER decode | r and s right-aligned into 32-byte slots; handles 33-byte zero-padded values |
| Two `signWith` calls | One per KMS key in the ThresholdKey — both required before `execute()` |
| Operator ≠ Guardian | `HEDERA_OPERATOR_PRIVATE_KEY` pays network fees only; it is NOT Key 2 of the ThresholdKey |

#### Reference implementation (working KMS + Hedera integration)

This is the canonical reference for how KMS signing, public key extraction, and Hedera transaction signing fit together. Key points that differ from naive approaches:

- **`keccak256`** is used to hash the message before sending to KMS as `DIGEST` (not SHA-256)
- **`elliptic`** is used to strip the ASN.1 DER prefix from the KMS public key before passing it to Hedera
- **`PublicKey.fromBytesECDSA`** is used with the compressed point (not `PublicKey.fromBytes` with the full DER blob)
- **`asn1.js`** decodes the DER signature — `decoded.r.toArray("be", 32)` correctly right-pads to 32 bytes regardless of leading zeros

```javascript
const { KMSClient, SignCommand, GetPublicKeyCommand } = require("@aws-sdk/client-kms");
const {
  Client,
  Hbar,
  AccountCreateTransaction,
  PublicKey,
  AccountBalanceQuery,
  TransferTransaction,
} = require("@hashgraph/sdk");
const elliptic = require("elliptic");
const keccak256 = require("keccak256");
const asn1 = require("asn1.js");
require("dotenv").config();

// Initialize KMS client
const kmsClient = new KMSClient({
  credentials: {
    accessKeyId: process.env.AWS_KMS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_KMS_SECRET_ACCESS_KEY,
  },
  region: process.env.AWS_KMS_REGION,
});

// ASN.1 parser for ECDSA signatures (KMS returns DER-encoded signatures)
const EcdsaSigAsnParse = asn1.define("EcdsaSig", function () {
  this.seq().obj(this.key("r").int(), this.key("s").int());
});

/**
 * Creates a KMS signer with its associated public key.
 *
 * Steps:
 * 1. Fetch DER-encoded public key from KMS
 * 2. Strip the ASN.1 prefix (fixed 26-byte header for secp256k1 SubjectPublicKeyInfo)
 * 3. Compress the uncompressed EC point using elliptic
 * 4. Load into Hedera as PublicKey.fromBytesECDSA (compressed, 33 bytes)
 * 5. Build signer: keccak256(message) → KMS Sign (DIGEST) → asn1 decode → r‖s
 */
async function createKmsSigner(keyId) {
  // Get public key from KMS (DER-encoded SubjectPublicKeyInfo)
  const response = await kmsClient.send(new GetPublicKeyCommand({ KeyId: keyId }));

  // Strip the fixed ASN.1 prefix for ECC_SECG_P256K1 keys to get the raw 65-byte uncompressed point
  const ec = new elliptic.ec("secp256k1");
  let hexKey = Buffer.from(response.PublicKey).toString("hex");
  hexKey = hexKey.replace("3056301006072a8648ce3d020106052b8104000a034200", "");

  // Compress the public key (65 bytes uncompressed → 33 bytes compressed)
  const ecKey = ec.keyFromPublic(hexKey, "hex");
  const publicKey = PublicKey.fromBytesECDSA(
    Buffer.from(ecKey.getPublic().encodeCompressed("hex"), "hex")
  );

  // Signer function — called by Hedera SDK's signWith() for each transaction body
  const signer = async (message) => {
    // Hedera ECDSA accounts expect keccak256, not SHA-256
    const hash = keccak256(Buffer.from(message));

    const signResponse = await kmsClient.send(
      new SignCommand({
        KeyId: keyId,
        Message: hash,
        MessageType: "DIGEST",      // hash already computed — KMS signs directly
        SigningAlgorithm: "ECDSA_SHA_256",
      })
    );

    // Decode DER signature; toArray("be", 32) right-aligns to exactly 32 bytes
    const decoded = EcdsaSigAsnParse.decode(Buffer.from(signResponse.Signature), "der");
    const signature = new Uint8Array(64);
    signature.set(decoded.r.toArray("be", 32), 0);   // r at bytes 0–31
    signature.set(decoded.s.toArray("be", 32), 32);  // s at bytes 32–63

    return signature;
  };

  return { publicKey, signer };
}

async function main() {
  const { publicKey, signer } = await createKmsSigner(process.env.AWS_KMS_KEY_ID);
  console.log("KMS Public Key:", publicKey.toStringRaw());

  // Operator client — pays for account creation (treasury key, not KMS)
  const operatorClient = Client.forTestnet();
  operatorClient.setOperator(process.env.HEDERA_ACCOUNT_ID, process.env.HEDERA_PRIVATE_KEY);

  // Create new account with KMS public key as the sole account key
  const createTx = await new AccountCreateTransaction()
    .setKey(publicKey)
    .setInitialBalance(Hbar.fromTinybars(200000))
    .execute(operatorClient);

  const receipt = await createTx.getReceipt(operatorClient);
  const newAccountId = receipt.accountId;
  console.log("New account ID:", newAccountId.toString());

  const balance = await new AccountBalanceQuery()
    .setAccountId(newAccountId)
    .execute(operatorClient);
  console.log("Account balance:", balance.hbars.toString());

  // setOperatorWith — KMS signer signs ALL transactions from this client automatically
  const kmsSignedClient = Client.forTestnet();
  kmsSignedClient.setOperatorWith(newAccountId, publicKey, signer);

  // Transfer HBAR — signed by KMS key automatically via setOperatorWith
  const transferTx = await new TransferTransaction()
    .addHbarTransfer(newAccountId, Hbar.fromTinybars(-10000))
    .addHbarTransfer("0.0.3", Hbar.fromTinybars(10000))
    .execute(kmsSignedClient);

  const transferReceipt = await transferTx.getReceipt(kmsSignedClient);
  console.log("Transfer status:", transferReceipt.status.toString());

  const txId = transferTx.transactionId
    .toString()
    .replace("@", "-")
    .replace(/\./g, "-")
    .replace(/0-/g, "0.");
  console.log("HashScan: https://hashscan.io/testnet/transaction/" + txId);
}

main().catch(console.error);
```

> **Note for Afridialect implementation:** We use `signWith()` (not `setOperatorWith()`) because the buyer's account has a ThresholdKey (2-of-2) requiring two separate KMS signers. The hash function must be **`keccak256`** — not SHA-256 — for Hedera ECDSA account key verification. Update `signForHedera` in `lib/aws/kms.ts` accordingly.

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

#### Profile Creation & Auto-Role Assignment Trigger

**Updated:** February 25, 2026 - Now automatically assigns uploader role to all new users

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Automatically assign uploader role to all new users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'uploader')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

**To update existing trigger:** Run `node scripts/update-signup-trigger.js` and follow instructions.

**To assign uploader role to existing users:**
```sql
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'uploader' FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_roles WHERE role = 'uploader')
ON CONFLICT (user_id, role) DO NOTHING;
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

---

## Phase 4: Audio Upload Setup

### Current Status
- Storage buckets created ✅
- Upload UI and API ready ✅
- RLS policies need manual application ⏳

### Apply Storage RLS Policies

**Manual step required:** Supabase JavaScript client doesn't support arbitrary SQL execution.

1. Go to Supabase Dashboard > SQL Editor:
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT_ID/sql/new
   ```

2. Copy and paste the entire contents of `lib/supabase/storage.sql`

3. Click "Run" to create the buckets and apply RLS policies

### Create Admin User

Use the helper script:
```bash
node scripts/create-admin-user.js admin@example.com SecurePass123! "Admin Name"
```

### Assign Uploader Role

**Option 1: Using Admin Dashboard**
1. Navigate to: `http://localhost:3000/admin`
2. Go to "Users" tab
3. Find your user account
4. Click username to open user detail page
5. In "Assign Role" section, select `uploader` and click "Assign Role"

**Option 2: Direct SQL**
```sql
-- Get user ID
SELECT id, email FROM auth.users WHERE email = 'your-email@example.com';

-- Assign uploader role
INSERT INTO public.user_roles (user_id, role)
VALUES ('YOUR-USER-ID', 'uploader')
ON CONFLICT (user_id, role) DO NOTHING;
```

### Test Audio Upload

1. Login at: `http://localhost:3000/auth/login`
2. Navigate to: `http://localhost:3000/uploader`
3. Upload test audio file (MP3, WAV, M4A, OGG, WebM - max 50MB)
4. Verify upload in Supabase Dashboard > Storage > audio-staging

---

## Security: Login Form Troubleshooting

### Issue: Credentials in URL

If you see `http://localhost:3000/auth/login?email=...&password=...`, this is NOT a form issue.

**Common Causes:**
- Browser password manager creating GET shortcuts
- Browser autofill triggering navigation
- Browser extensions (LastPass, 1Password, etc.)
- Bookmarked URL with credentials
- Browser history replay

**Solution:**
1. Clear browser history (Ctrl+Shift+Delete → All time)
2. Clear cookies and cache
3. Disable password manager for localhost
4. Try private/incognito window
5. Disable ALL browser extensions
6. Use the "Sign in" button, don't press Enter

**Test Form Security:**
1. Open DevTools (F12) → Network tab
2. Filter by "Fetch/XHR"
3. Fill form manually (no autofill)
4. Click "Sign in" button
5. Should see POST to Supabase, NOT GET with params

**Note:** The form correctly uses `method="post"` and `e.preventDefault()`. This is purely a browser behavior issue.

---

## Additional Resources

- [Hedera Documentation](https://docs.hedera.com)
- [Supabase Documentation](https://supabase.com/docs)
- [Next.js 16 Documentation](https://nextjs.org/docs)
- [AWS KMS Documentation](https://docs.aws.amazon.com/kms/)

**For questions or support:**
- GitHub Issues: https://github.com/snjiraini/afridialect/issues
- Email: support@afridialect.ai

---

## Hedera Contributor Payment System (Phase 11)

### Overview

Implemented in `feature/AI-ML-dataset`. The marketplace purchase flow executes a **single atomic `BatchTransaction`** on Hedera (SDK ≥ 2.80) that:

1. Returns each purchased NFT from the contributor's account back to treasury (required before burning on HTS).
2. Burns the returned NFT serials from treasury using a `TokenBurnTransaction`.
3. Distributes HBAR revenue from the buyer to every contributor and the platform treasury.

All three steps are wrapped in one `BatchTransaction` — the network commits all inner transactions or reverts all of them atomically.

### Payout Breakdown (per sample, $6.00 USD total)

| Contributor | Amount (USD) | Payout type |
|---|---|---|
| Audio uploader | $0.50 | `audio` |
| Audio QC reviewer | $1.00 | `qc_review` |
| Transcriber | $1.00 | `transcription` |
| Translator | $1.00 | `translation` |
| Transcript QC reviewer | $1.00 | `qc_review` |
| Translation QC reviewer | $1.00 | `qc_review` |
| Platform (treasury) | $0.50 | — (no payout row) |
| **Total** | **$6.00** | |

> These amounts are now **admin-configurable** via the `payout_structure` database table and `/admin/settings` UI. The values above are the PRD §6.6.3 defaults used as fallback if the table is empty.

### Key Files

```
lib/hedera/payment.ts                                — PayoutStructure interface, DEFAULT_PAYOUT_STRUCTURE, buildClipRecipients, aggregateRecipients
lib/hedera/nft.ts                                    — executeAtomicPurchaseBatch, NftBurnSlot, HbarRecipient types
app/api/marketplace/payment/route.ts                 — POST /api/marketplace/payment (executes BatchTransaction)
app/api/marketplace/purchase/route.ts                — POST /api/marketplace/purchase (creates purchase + payout records)
app/api/admin/payout-structure/route.ts              — GET/PUT /api/admin/payout-structure (admin API)
app/admin/components/PayoutStructureClient.tsx        — Admin UI for editing per-role amounts
lib/supabase/migrations/phase11_payout_structure.sql — DB migration (payout_structure, nft_burns, staging cleanup columns)
```

### Two-Step Purchase Flow

1. **POST `/api/marketplace/purchase`** — validates clips, creates `dataset_purchases` record (`payment_status = 'pending'`), inserts payout rows using admin-configured amounts, builds initial JSONL manifest.
2. **POST `/api/marketplace/payment`** — executes atomic `BatchTransaction` (NFT returns + burns + HBAR distribution), inserts `nft_burns` records, updates all payout rows to `completed`, sets `payment_transaction_id` on the purchase.

### Atomic BatchTransaction — Inner Transaction Order

```
BatchTransaction {
  // 1 tx per unique NFT contributor (may combine audio + transcript + translation NFTs)
  TransferTransaction: contributor(s) → treasury (NFT return)

  // 1 tx per unique token collection ID
  TokenBurnTransaction: treasury burns serial(s)

  // 1 tx total
  TransferTransaction: buyer → all HBAR recipients (revenue distribution)
}
```

### Why BatchTransaction Is Required for NFT Burns

HTS (Hedera Token Service) NFTs can only be burned by the account holding the **supply key** (treasury). Contributors hold their NFTs, so:
- Step 1: `TransferTransaction` moves NFTs from contributor → treasury (contributor ThresholdKey signs).
- Step 2: `TokenBurnTransaction` burns from treasury (treasury supply key signs).

Doing these as sequential transactions risks partial failure. `BatchTransaction` wraps all steps atomically.

### Signing Requirements Per Inner Transaction

| Transaction | Signers |
|---|---|
| NFT `TransferTransaction` (contributor → treasury) | Contributor KMS key + guardian KMS key (ThresholdKey 2-of-2) |
| `TokenBurnTransaction` (treasury burns) | Treasury `PrivateKey` (supply key) |
| HBAR `TransferTransaction` (buyer → recipients) | Buyer KMS key + guardian KMS key (ThresholdKey 2-of-2) |
| Outer `BatchTransaction` | Operator (treasury) — automatic via `execute()` |

### NFT Supply Limit Changed: 300 → 5

`NFT_MAX_SUPPLY` in `lib/hedera/nft.ts` was reduced from 300 to **5** serials per token collection (audio, transcript, translation). This applies to new mints only.

### Admin-Configurable Payout Structure

Admins can adjust per-role USD amounts at `/admin/settings` → "Contributor Payout Structure":
- The `payout_structure` table stores one row per role with `amount_usd`.
- The payment route loads this table at checkout time; falls back to `DEFAULT_PAYOUT_STRUCTURE` if empty.
- The `PayoutStructure` interface and `DEFAULT_PAYOUT_STRUCTURE` constant are exported from `lib/hedera/payment.ts`.

### nft_burns Table

Records every NFT serial burned as part of a purchase. Prevents the same serial from being re-used.

```sql
SELECT * FROM public.nft_burns
WHERE purchase_id = '<purchase_uuid>';
-- Returns: nft_record_id, serial_number, burned_at, transaction_id
```

### Missing Contributor Fallback

If a contributor has no Hedera account set up (`hedera_account_id = null`), their HBAR payout slot falls back to the platform treasury — funds are never lost on-chain. Their NFT burn is skipped with a warning log.

### Database Migration

Run `lib/supabase/migrations/phase11_payout_structure.sql` in Supabase Dashboard → SQL Editor. Creates:
- `payout_structure` table with RLS (admin-only) and seed defaults
- `download_count` + `package_deleted_at` columns on `dataset_purchases`
- `staging_cleaned_at` columns on `audio_clips`, `transcriptions`, `translations`
- `ipfs_pin_logs` table for tracking pinned CIDs

---

## AI/ML Dataset Download (Phase 11 + Bug Fix March 5, 2026)

### Overview

On purchase, the download endpoint builds a **HuggingFace-compatible ZIP package** assembled fresh from IPFS-pinned files and streams real-time progress to the buyer's browser via **Server-Sent Events (SSE)**. The package is stored in Supabase `dataset-exports` storage with a 24-hour signed-URL TTL and persists for the full URL window so the buyer can download it.

> **Note (March 5, 2026 fix):** An earlier implementation auto-deleted the ZIP from storage immediately after generating the signed URL (before the browser could fetch it). This has been removed. The package now persists until the signed URL expires (24 h). No auto-delete logic remains.

### SSE Streaming Endpoint

`GET /api/marketplace/download/[id]` — authenticated, buyer-only. Returns `Content-Type: text/event-stream`. Each event is a JSON object on a `data:` line:

```typescript
interface DownloadEvent {
  step:          'auth_check' | 'checking_cache' | 'loading_clips' |
                 'fetching_audio' | 'building_zip' | 'uploading' |
                 'generating_url' | 'done' | 'error'
  message:       string          // Human-readable status line
  detail?:       string          // Optional secondary detail
  current?:      number          // fetching_audio: current clip index (1-based)
  total?:        number          // fetching_audio: total clips
  downloadUrl?:  string          // done: 24h signed URL
  sampleCount?:  number          // done: number of samples in the ZIP
  downloadCount?: number         // done: how many times this purchase has been downloaded
  error?:        string          // error: description
}
```

**Step sequence:**

| Step | Description |
|---|---|
| `auth_check` | Authenticates user and verifies purchase ownership + payment status |
| `checking_cache` | Lists `dataset-exports` bucket — serves cached ZIP if it exists |
| `loading_clips` | Queries `audio_clips` with approved transcriptions and translations |
| `fetching_audio` | Downloads each audio file from Pinata IPFS gateway (emits `current`/`total` per clip) |
| `building_zip` | Assembles README.md + data.jsonl + audio + transcript + translation files into ZIP |
| `uploading` | Uploads ZIP to `dataset-exports/purchases/{purchaseId}/dataset.zip` |
| `generating_url` | Creates 24-hour signed download URL |
| `done` | Emits `downloadUrl`; buyer's browser triggers download |
| `error` | Any failure — includes `error` field with description |

**Cache hit path:** If `dataset.zip` already exists in storage, the endpoint skips straight from `checking_cache` to `generating_url`, emitting only those two steps before `done`.

### Client Component — `PrepareDatasetButton`

`app/marketplace/purchase/[id]/components/PurchaseDownloadButton.tsx` exports `PrepareDatasetButton` (default). It:

1. On click, opens a `fetch()` stream to the SSE endpoint (not `EventSource` — avoids CORS cookie issues).
2. Parses SSE events and renders a step-by-step progress checklist (⬜ → 🔄 → ✅).
3. Shows a per-clip progress bar during `fetching_audio` (`Clip X of N`).
4. On `done`: auto-triggers download via a programmatically clicked `<a>` element (more reliable than `window.open` for binary files through popup blockers).
5. Shows a fallback manual download link if the auto-trigger was blocked.
6. Retry button on error — resets all state and re-runs the full build.

```tsx
<PrepareDatasetButton purchaseId={purchaseId} sampleCount={purchase.sample_count} />
```

### Package Structure

```
dataset.zip/
├── README.md                         ← HuggingFace dataset card (YAML frontmatter + markdown)
├── data.jsonl                        ← JSONL manifest (one JSON object per sample)
├── audio/
│   └── <clip-id>.<dialect>.<ext>     ← Audio files downloaded fresh from IPFS
├── transcripts/
│   └── <clip-id>.<dialect>.txt       ← Verbatim transcriptions
└── translations/
    └── <clip-id>.en.txt              ← English translations
```

### JSONL Manifest Schema

| Field | Type | Description |
|---|---|---|
| `id` | string | Unique clip UUID |
| `dialect_code` | string | e.g. `"kikuyu"` |
| `dialect_name` | string | e.g. `"Kikuyu"` |
| `audio_file` | string | Path within ZIP |
| `audio_cid` | string | IPFS CID (permanent reference) |
| `transcript_file` | string\|null | Path within ZIP |
| `translation_file` | string\|null | Path within ZIP |
| `duration_seconds` | number | Clip length in seconds |
| `speaker_gender` | string | `male/female/mixed/unknown` |
| `speaker_age` | string | `child/teen/adult/senior/mixed` |
| `speaker_count` | number | Number of speakers |
| `transcript` | string\|null | Full transcription text (inline) |
| `translation` | string\|null | Full English translation (inline) |

### Storage Lifecycle

| Stage | Location | When |
|---|---|---|
| Raw upload | `audio-staging` | After uploader submits |
| After minting | `audio-staging` deleted | `POST /api/ipfs/cleanup` (admin-triggered) |
| On purchase download | `dataset-exports` ZIP created | `GET /api/marketplace/download/[id]` |
| During signed URL window | `dataset-exports` ZIP persists | 24 hours after generation |
| Audio always available | IPFS (Pinata) | Permanently pinned at mint |

### Staging Cleanup Endpoint

`POST /api/ipfs/cleanup` — admin only. Removes staging files (audio-staging, transcript-staging, translation-staging) for a minted clip after verifying the audio CID is pinned on Pinata. Idempotent — safe to call multiple times.

```json
{ "clipId": "uuid" }
```

Response: `{ success, clipId, removedPaths: string[] }`

### Download Tracking

- `dataset_purchases.download_count` — incremented on every download request.
- `dataset_purchases.downloaded_at` — timestamp of the first download.
- `dataset_purchases.package_deleted_at` — column exists in schema but is no longer populated (auto-delete removed March 5, 2026).
- Audit log entry: `action = 'dataset_download'` with `sample_count`, `price_usd`, `download_count`.

### Key Files

```
app/api/marketplace/download/[id]/route.ts              — SSE streaming GET endpoint: auth → cache check → IPFS fetch → ZIP build → upload → signed URL → done
app/marketplace/purchase/[id]/components/
  PurchaseDownloadButton.tsx                            — PrepareDatasetButton: SSE consumer with step list + per-clip progress bar
app/marketplace/purchase/[id]/page.tsx                  — Purchase detail page; passes purchaseId + sampleCount to PrepareDatasetButton
app/api/ipfs/cleanup/route.ts                           — POST endpoint: admin staging cleanup
lib/supabase/migrations/phase10_download.sql            — Adds download_count + package_deleted_at columns to dataset_purchases
```
