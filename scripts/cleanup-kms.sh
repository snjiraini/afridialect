#!/bin/bash

# Cleanup script for Hedera KMS resources
# This removes all AWS resources created by setup-kms.sh

set -e

# Disable AWS CLI pager to prevent interactive prompts
export AWS_PAGER=""

echo "=========================================="
echo "KMS Cleanup for Afridialect.ai"
echo "=========================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo -e "${RED}Error: AWS CLI is not installed${NC}"
    exit 1
fi

# Check credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Configuration
IAM_USER_NAME="afridialect-kms-user"
POLICY_NAME="AfridialectKMSSigningPolicy"
POLICY_ARN="arn:aws:iam::${ACCOUNT_ID}:policy/${POLICY_NAME}"
ALIAS_NAME="alias/afridialect-hedera-signing"

echo -e "${YELLOW}This will delete:${NC}"
echo "  - KMS Key and alias"
echo "  - IAM User: $IAM_USER_NAME"
echo "  - IAM Policy: $POLICY_NAME"
echo "  - All access keys"
echo ""
read -p "Are you sure? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "Cleanup cancelled"
    exit 0
fi

# Get KMS Key ID from alias
echo "Looking up KMS key..."
KMS_KEY_ID=$(aws kms describe-alias --alias-name $ALIAS_NAME --query 'AliasArn' --output text 2>/dev/null | sed 's/.*alias\///' || echo "")

if [ -n "$KMS_KEY_ID" ]; then
    # Delete alias
    echo "Deleting KMS alias: $ALIAS_NAME"
    aws kms delete-alias --alias-name $ALIAS_NAME 2>/dev/null || true
    echo -e "${GREEN}✓ Alias deleted${NC}"
    
    # Schedule key deletion
    echo "Scheduling KMS key deletion (7 day waiting period)..."
    aws kms schedule-key-deletion --key-id $KMS_KEY_ID --pending-window-in-days 7
    echo -e "${GREEN}✓ KMS key scheduled for deletion${NC}"
else
    echo -e "${YELLOW}KMS key not found, skipping${NC}"
fi
echo ""

# Delete access keys
echo "Deleting IAM access keys..."
ACCESS_KEYS=$(aws iam list-access-keys --user-name $IAM_USER_NAME --query 'AccessKeyMetadata[].AccessKeyId' --output text 2>/dev/null || echo "")
if [ -n "$ACCESS_KEYS" ]; then
    for KEY_ID in $ACCESS_KEYS; do
        aws iam delete-access-key --user-name $IAM_USER_NAME --access-key-id $KEY_ID
        echo "  Deleted: $KEY_ID"
    done
    echo -e "${GREEN}✓ Access keys deleted${NC}"
else
    echo -e "${YELLOW}No access keys found${NC}"
fi
echo ""

# Detach policy
echo "Detaching policy from user..."
aws iam detach-user-policy --user-name $IAM_USER_NAME --policy-arn $POLICY_ARN 2>/dev/null || true
echo -e "${GREEN}✓ Policy detached${NC}"
echo ""

# Delete policy versions (if any non-default versions exist)
echo "Deleting policy versions..."
VERSIONS=$(aws iam list-policy-versions --policy-arn $POLICY_ARN --query 'Versions[?!IsDefaultVersion].VersionId' --output text 2>/dev/null || echo "")
if [ -n "$VERSIONS" ]; then
    for VERSION in $VERSIONS; do
        aws iam delete-policy-version --policy-arn $POLICY_ARN --version-id $VERSION
        echo "  Deleted version: $VERSION"
    done
fi

# Delete policy
echo "Deleting IAM policy..."
aws iam delete-policy --policy-arn $POLICY_ARN 2>/dev/null || true
echo -e "${GREEN}✓ Policy deleted${NC}"
echo ""

# Delete user
echo "Deleting IAM user..."
aws iam delete-user --user-name $IAM_USER_NAME 2>/dev/null || true
echo -e "${GREEN}✓ IAM user deleted${NC}"
echo ""

echo "=========================================="
echo "Cleanup Complete! ✓"
echo "=========================================="
echo ""
echo -e "${YELLOW}Note: KMS key will be permanently deleted in 7 days${NC}"
echo "You can cancel the deletion within 7 days using:"
echo "  aws kms cancel-key-deletion --key-id <KEY_ID>"
echo ""
echo "To remove AWS KMS variables from .env.local, edit the file manually."
echo ""
