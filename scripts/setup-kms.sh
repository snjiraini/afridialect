#!/bin/bash

# Hedera KMS Setup Script for Afridialect.ai
# This script sets up AWS KMS for signing Hedera transactions

set -e  # Exit on error

# Disable AWS CLI pager to prevent interactive prompts
export AWS_PAGER=""

echo "=========================================="
echo "Hedera KMS Setup for Afridialect.ai"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    echo "Please install it first: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
fi

echo -e "${GREEN}✓ AWS CLI is installed${NC}"
echo ""

# Check if AWS is configured
echo "Checking AWS credentials..."
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${YELLOW}AWS credentials not configured${NC}"
    echo ""
    echo "Please run: aws configure"
    echo ""
    echo "You'll need:"
    echo "  - AWS Access Key ID"
    echo "  - AWS Secret Access Key"
    echo "  - Default region (e.g., us-east-1)"
    echo ""
    echo "To get AWS credentials:"
    echo "1. Log into AWS Console: https://console.aws.amazon.com/"
    echo "2. Click your username → Security credentials"
    echo "3. Create access key → CLI"
    echo "4. Save both keys (secret key shown only once!)"
    echo ""
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
CALLER_ARN=$(aws sts get-caller-identity --query Arn --output text)
echo -e "${GREEN}✓ AWS credentials are configured${NC}"
echo "Account ID: $ACCOUNT_ID"
echo "Caller: $CALLER_ARN"
echo ""

# Step 1: Create IAM User
echo "=========================================="
echo "Step 1: Create IAM User for KMS"
echo "=========================================="
echo ""

IAM_USER_NAME="afridialect-kms-user"

if aws iam get-user --user-name $IAM_USER_NAME &> /dev/null; then
    echo -e "${YELLOW}IAM user '$IAM_USER_NAME' already exists${NC}"
else
    echo "Creating IAM user: $IAM_USER_NAME"
    aws iam create-user --user-name $IAM_USER_NAME
    echo -e "${GREEN}✓ IAM user created${NC}"
fi
echo ""

# Step 2: Create and Attach Policy
echo "=========================================="
echo "Step 2: Create KMS Policy"
echo "=========================================="
echo ""

POLICY_NAME="AfridialectKMSSigningPolicy"
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"

# Check if policy exists
if aws iam get-policy --policy-arn $POLICY_ARN &> /dev/null; then
    echo -e "${YELLOW}Policy '$POLICY_NAME' already exists${NC}"
else
    echo "Creating KMS policy from docs/hedera-kms-policy.json"
    aws iam create-policy \
        --policy-name $POLICY_NAME \
        --policy-document file://docs/hedera-kms-policy.json
    echo -e "${GREEN}✓ Policy created${NC}"
fi
echo ""

# Attach policy to user
echo "Attaching policy to user..."
if aws iam list-attached-user-policies --user-name $IAM_USER_NAME | grep -q $POLICY_NAME; then
    echo -e "${YELLOW}Policy already attached${NC}"
else
    aws iam attach-user-policy \
        --user-name $IAM_USER_NAME \
        --policy-arn $POLICY_ARN
    echo -e "${GREEN}✓ Policy attached to user${NC}"
fi
echo ""

# Step 3: Create KMS Key
echo "=========================================="
echo "Step 3: Create KMS Key (secp256k1)"
echo "=========================================="
echo ""

ALIAS_NAME="alias/afridialect-hedera-signing"

# Check if alias already exists by listing aliases
EXISTING_ALIAS=$(aws kms list-aliases --query "Aliases[?AliasName=='$ALIAS_NAME'].TargetKeyId" --output text)

if [ -n "$EXISTING_ALIAS" ]; then
    echo -e "${YELLOW}KMS key alias already exists${NC}"
    # Get the existing key ID from the alias
    KMS_KEY_ID=$EXISTING_ALIAS
    KMS_KEY_ARN=$(aws kms describe-key --key-id $KMS_KEY_ID --query 'KeyMetadata.Arn' --output text)
    echo "Using existing key:"
    echo "Key ID: $KMS_KEY_ID"
    echo "Key ARN: $KMS_KEY_ARN"
else
    echo "Creating KMS key with secp256k1 curve (Hedera-compatible)..."
    KMS_KEY_OUTPUT=$(aws kms create-key \
        --key-spec ECC_SECG_P256K1 \
        --key-usage SIGN_VERIFY \
        --description "Afridialect.ai Hedera Transaction Signing Key" \
        --output json)

    KMS_KEY_ID=$(echo $KMS_KEY_OUTPUT | jq -r '.KeyMetadata.KeyId')
    KMS_KEY_ARN=$(echo $KMS_KEY_OUTPUT | jq -r '.KeyMetadata.Arn')

    echo -e "${GREEN}✓ KMS Key created${NC}"
    echo "Key ID: $KMS_KEY_ID"
    echo "Key ARN: $KMS_KEY_ARN"
    echo ""

    # Create alias for easier reference
    echo "Creating alias: $ALIAS_NAME"
    aws kms create-alias \
        --alias-name $ALIAS_NAME \
        --target-key-id $KMS_KEY_ID
    echo -e "${GREEN}✓ Alias created${NC}"
fi
echo ""

# Verify key
echo "Verifying key configuration..."
KEY_SPEC=$(aws kms describe-key --key-id $KMS_KEY_ID --query 'KeyMetadata.KeySpec' --output text)
KEY_USAGE=$(aws kms describe-key --key-id $KMS_KEY_ID --query 'KeyMetadata.KeyUsage' --output text)

if [ "$KEY_SPEC" = "ECC_SECG_P256K1" ] && [ "$KEY_USAGE" = "SIGN_VERIFY" ]; then
    echo -e "${GREEN}✓ Key configured correctly${NC}"
    echo "  - Key Spec: $KEY_SPEC"
    echo "  - Key Usage: $KEY_USAGE"
else
    echo -e "${RED}✗ Key configuration error${NC}"
    exit 1
fi
echo ""

# Get public key
echo "Extracting public key..."
PUBLIC_KEY_HEX=$(aws kms get-public-key --key-id $KMS_KEY_ID --output text --query 'PublicKey' | base64 -d | od -An -tx1 | tr -d ' \n')
echo -e "${GREEN}✓ Public key extracted${NC}"
echo "Public Key (hex): ${PUBLIC_KEY_HEX:0:80}..."
echo ""

# Step 4: Create Access Keys
echo "=========================================="
echo "Step 4: Create IAM Access Keys"
echo "=========================================="
echo ""

# Check if access keys already exist
EXISTING_KEYS=$(aws iam list-access-keys --user-name $IAM_USER_NAME --query 'AccessKeyMetadata' --output json)
KEY_COUNT=$(echo $EXISTING_KEYS | jq length)

if [ "$KEY_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}Access keys already exist for this user${NC}"
    echo "Existing access keys:"
    echo $EXISTING_KEYS | jq -r '.[] | "  - \(.AccessKeyId) (Created: \(.CreateDate))"'
    echo ""
    echo -e "${YELLOW}Note: You can have max 2 access keys per IAM user${NC}"
    echo "Using existing key. If you need the credentials, check your .env.local"
    echo "or delete old keys and re-run the script."
    
    # Try to get the key ID from existing keys
    AWS_ACCESS_KEY_ID=$(echo $EXISTING_KEYS | jq -r '.[0].AccessKeyId')
    AWS_SECRET_ACCESS_KEY="<already-configured-check-env-file>"
else
    echo "Creating access keys for IAM user..."
    ACCESS_KEY_OUTPUT=$(aws iam create-access-key --user-name $IAM_USER_NAME --output json)

    AWS_ACCESS_KEY_ID=$(echo $ACCESS_KEY_OUTPUT | jq -r '.AccessKey.AccessKeyId')
    AWS_SECRET_ACCESS_KEY=$(echo $ACCESS_KEY_OUTPUT | jq -r '.AccessKey.SecretAccessKey')
    
    echo -e "${GREEN}✓ Access keys created${NC}"
fi
echo ""

# Step 5: Update .env file
echo "=========================================="
echo "Step 5: Update .env File"
echo "=========================================="
echo ""

ENV_FILE=".env.local"

# Create .env.local if it doesn't exist
if [ ! -f "$ENV_FILE" ]; then
    echo "Creating $ENV_FILE from .env.example..."
    cp .env.example $ENV_FILE
fi

# Remove existing AWS KMS variables if they exist
sed -i.bak '/^AWS_REGION=/d' $ENV_FILE
sed -i.bak '/^AWS_ACCESS_KEY_ID=/d' $ENV_FILE
sed -i.bak '/^AWS_SECRET_ACCESS_KEY=/d' $ENV_FILE
sed -i.bak '/^AWS_KMS_KEY_ID=/d' $ENV_FILE

# Append new AWS KMS configuration
cat >> $ENV_FILE << EOF

# ===========================================
# AWS KMS Configuration (Generated: $(date))
# ===========================================
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=$AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY=$AWS_SECRET_ACCESS_KEY
AWS_KMS_KEY_ID=$KMS_KEY_ID
EOF

echo -e "${GREEN}✓ Environment variables saved to $ENV_FILE${NC}"
echo ""

# Cleanup backup
rm -f ${ENV_FILE}.bak

# Step 6: Summary
echo "=========================================="
echo "Setup Complete! ✓"
echo "=========================================="
echo ""
echo -e "${GREEN}Your KMS key is ready for Hedera transaction signing${NC}"
echo ""
echo "Configuration Summary:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "IAM User:          $IAM_USER_NAME"
echo "Policy:            $POLICY_NAME"
echo "KMS Key ID:        $KMS_KEY_ID"
echo "KMS Key Alias:     $ALIAS_NAME"
echo "AWS Region:        us-east-1"
echo "Config File:       $ENV_FILE"
echo ""
echo "Access Credentials:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Access Key ID:     $AWS_ACCESS_KEY_ID"
echo "Secret Access Key: ${AWS_SECRET_ACCESS_KEY:0:10}...${AWS_SECRET_ACCESS_KEY: -10}"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Save these credentials securely!${NC}"
echo "The secret access key cannot be retrieved again."
echo ""
echo "Next Steps:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "1. Verify your $ENV_FILE file has all AWS KMS variables"
echo "2. Test the KMS key with a Hedera transaction"
echo "3. Configure your Hedera account credentials in $ENV_FILE"
echo ""
echo "Security Reminders:"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✓ Never commit .env.local to git (already in .gitignore)"
echo "✓ The KMS private key never leaves AWS infrastructure"
echo "✓ Only signatures are returned when signing transactions"
echo "✓ All KMS operations are logged in AWS CloudTrail"
echo ""
echo "Cleanup (if needed in future):"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "To remove these resources later, run:"
echo "  ./scripts/cleanup-kms.sh"
echo ""
