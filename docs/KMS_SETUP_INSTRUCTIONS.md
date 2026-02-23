# AWS KMS Setup Guide for Afridialect.ai

This guide will help you set up AWS Key Management Service (KMS) to securely sign Hedera transactions. Your private keys will never leave AWS infrastructure - only signatures are returned.

## 🎯 What You'll Accomplish

- Create a secp256k1 KMS key (Hedera-compatible)
- Set up IAM user with proper permissions
- Configure your application to use KMS for signing
- Keep your private keys secure in AWS HSM

## 📋 Prerequisites

- ✅ AWS Account ([Sign up here](https://aws.amazon.com/))
- ✅ AWS CLI installed (already installed in your environment)
- ⏱️ Time required: ~10 minutes

## 🚀 Quick Setup (Automated)

### Step 1: Configure AWS CLI

If you haven't configured AWS CLI yet:

```bash
aws configure
```

You'll need:
- **AWS Access Key ID**: Get from AWS Console → Security credentials
- **AWS Secret Access Key**: Shown only once when creating the key
- **Default region**: Use `us-east-1` (recommended)
- **Default output format**: Use `json`

**How to get AWS credentials:**
1. Log into [AWS Console](https://console.aws.amazon.com/)
2. Click your username (top right) → **Security credentials**
3. Scroll to **Access keys** → **Create access key**
4. Choose **Command Line Interface (CLI)**
5. ⚠️ **SAVE BOTH KEYS IMMEDIATELY** - Secret key shown only once!

### Step 2: Run the Setup Script

```bash
./scripts/setup-kms.sh
```

This automated script will:
1. ✅ Create IAM user: `afridialect-kms-user`
2. ✅ Create KMS policy with signing permissions
3. ✅ Create KMS key with secp256k1 curve (Hedera-compatible)
4. ✅ Generate access keys for the IAM user
5. ✅ Update your `.env.local` file automatically

### Step 3: Verify the Setup

After the script completes, verify your `.env.local` has these variables:

```bash
grep -A 5 "AWS KMS Configuration" .env.local
```

You should see:
```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...
AWS_KMS_KEY_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

## 🔐 What Was Created

### 1. KMS Key
- **Type**: Asymmetric
- **Curve**: ECC_SECG_P256K1 (Hedera-compatible)
- **Usage**: SIGN_VERIFY
- **Algorithm**: ECDSA_SHA_256
- **Alias**: `alias/afridialect-hedera-signing`

### 2. IAM User
- **Name**: `afridialect-kms-user`
- **Permissions**: Sign, GetPublicKey, DescribeKey on KMS

### 3. IAM Policy
- **Name**: `AfridialectKMSSigningPolicy`
- **Actions**: `kms:Sign`, `kms:GetPublicKey`, `kms:DescribeKey`

## 🧪 Testing the KMS Key

Verify the KMS key is working:

```bash
# Get your KMS Key ID from .env.local
KMS_KEY_ID=$(grep AWS_KMS_KEY_ID .env.local | cut -d '=' -f2)

# Describe the key
aws kms describe-key --key-id $KMS_KEY_ID

# Get the public key
aws kms get-public-key --key-id $KMS_KEY_ID
```

Expected output should show:
- `"Enabled": true`
- `"KeySpec": "ECC_SECG_P256K1"`
- `"KeyUsage": "SIGN_VERIFY"`

## 📝 Manual Setup (Alternative)

If you prefer to set up manually or the script fails:

### 1. Create IAM User

```bash
aws iam create-user --user-name afridialect-kms-user
```

### 2. Create and Attach Policy

```bash
# Create policy
aws iam create-policy \
    --policy-name AfridialectKMSSigningPolicy \
    --policy-document file://docs/hedera-kms-policy.json

# Get your account ID
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Attach policy
aws iam attach-user-policy \
    --user-name afridialect-kms-user \
    --policy-arn arn:aws:iam::${ACCOUNT_ID}:policy/AfridialectKMSSigningPolicy
```

### 3. Create KMS Key

```bash
# Create the key and capture the Key ID
KMS_KEY_ID=$(aws kms create-key \
    --key-spec ECC_SECG_P256K1 \
    --key-usage SIGN_VERIFY \
    --description "Afridialect.ai Hedera Transaction Signing Key" \
    --query 'KeyMetadata.KeyId' \
    --output text)

echo "Your KMS Key ID: $KMS_KEY_ID"

# Create an alias for easier reference
aws kms create-alias \
    --alias-name alias/afridialect-hedera-signing \
    --target-key-id $KMS_KEY_ID
```

### 4. Create Access Keys

```bash
aws iam create-access-key --user-name afridialect-kms-user
```

⚠️ **Save the output!** You'll need both `AccessKeyId` and `SecretAccessKey`.

### 5. Update .env.local

Add these variables to your `.env.local`:

```bash
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-access-key-id
AWS_SECRET_ACCESS_KEY=your-secret-access-key
AWS_KMS_KEY_ID=your-kms-key-id
```

## 🔒 Security Best Practices

### ✅ DO:
- Use the dedicated IAM user (`afridialect-kms-user`) in your application
- Keep `.env.local` in `.gitignore` (already configured)
- Rotate access keys periodically
- Monitor KMS usage in CloudTrail
- Use the KMS key ID from environment variables

### ❌ DON'T:
- Don't commit `.env.local` to git
- Don't use root AWS credentials in your application
- Don't share your secret access key
- Don't give unnecessary permissions to the IAM user

## 🔍 How KMS Signing Works

```
┌─────────────────┐      ┌──────────────┐      ┌─────────────────┐
│  Your App       │      │   AWS KMS    │      │  Hedera Network │
│                 │      │              │      │                 │
│ 1. Create TX    │─────▶│ 2. Sign Hash │─────▶│ 3. Verify &     │
│    & Hash it    │      │   (secp256k1)│      │    Execute TX   │
│                 │◀─────│ Return Sig   │      │                 │
└─────────────────┘      └──────────────┘      └─────────────────┘
```

**Key Points:**
- Private key **NEVER** leaves AWS HSM
- Only the transaction hash is sent to KMS
- KMS returns a signature
- Your app submits the signature to Hedera

## 🧹 Cleanup (When Needed)

To remove all KMS resources:

```bash
./scripts/cleanup-kms.sh
```

This will:
- Schedule KMS key for deletion (7-day waiting period)
- Delete the alias
- Remove IAM user and access keys
- Delete the IAM policy

⚠️ **Note:** KMS keys have a mandatory 7-day waiting period before deletion. You can cancel deletion within this period.

## 📊 Monitoring & Auditing

### View KMS Operations

```bash
# List recent KMS Sign operations
aws cloudtrail lookup-events \
    --lookup-attributes AttributeKey=EventName,AttributeValue=Sign \
    --max-results 10
```

### Check Key Usage

```bash
# Describe your key
aws kms describe-key --key-id alias/afridialect-hedera-signing

# List all your KMS keys
aws kms list-keys
```

## 🆘 Troubleshooting

### Error: "Credentials could not be loaded"
```bash
# Reconfigure AWS CLI
aws configure
```

### Error: "User already exists"
```bash
# Use the existing user or delete it first
aws iam delete-user --user-name afridialect-kms-user
```

### Error: "AccessDeniedException"
```bash
# Verify your AWS credentials have permission to create IAM users and KMS keys
aws iam get-user
```

### Error: "Invalid key spec"
```bash
# Make sure you're using ECC_SECG_P256K1 (not P256)
aws kms describe-key --key-id YOUR_KEY_ID
```

### Verify KMS Key Configuration
```bash
KMS_KEY_ID=$(grep AWS_KMS_KEY_ID .env.local | cut -d '=' -f2)

# Should show: "KeySpec": "ECC_SECG_P256K1"
aws kms describe-key --key-id $KMS_KEY_ID | grep KeySpec

# Should show: "KeyUsage": "SIGN_VERIFY"
aws kms describe-key --key-id $KMS_KEY_ID | grep KeyUsage
```

## 💰 Cost Estimate

AWS KMS pricing (as of 2026):
- **Key storage**: ~$1/month per key
- **Sign operations**: $0.03 per 10,000 requests
- **GetPublicKey**: Free

For typical usage (100 transactions/day):
- Monthly cost: ~$1.10/month

## 📚 Additional Resources

- [AWS KMS Documentation](https://docs.aws.amazon.com/kms/)
- [Hedera SDK Documentation](https://docs.hedera.com/hedera/sdks-and-apis/sdks)
- [secp256k1 Curve Information](https://en.bitcoin.it/wiki/Secp256k1)
- [AWS KMS Best Practices](https://docs.aws.amazon.com/kms/latest/developerguide/best-practices.html)

## ✅ Next Steps

After KMS setup is complete:

1. **Test the integration** - Create a test Hedera transaction using KMS
2. **Configure Hedera accounts** - Set up your treasury and operator accounts
3. **Implement signing logic** - Use the KMS key in your Hedera service
4. **Monitor usage** - Set up CloudWatch alerts for KMS operations

---

**Setup Status:** Ready to run `./scripts/setup-kms.sh`  
**Documentation:** See `docs/hedera-kms-setup-guide.md` for detailed workshop  
**Support:** Check troubleshooting section above
