#!/bin/bash

# Update IAM Policy for Afridialect KMS User
# This script updates the inline policy to include all necessary KMS permissions

set -e

echo "========================================"
echo "Updating IAM Policy for KMS User"
echo "========================================"
echo ""

# Check if AWS CLI is configured
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI not found. Please install it first."
    exit 1
fi

# Configuration
IAM_USER_NAME="${IAM_USER_NAME:-afridialect-kms-user}"
POLICY_NAME="${POLICY_NAME:-AfridialectKMSPolicy}"

echo "📋 Configuration:"
echo "   IAM User: $IAM_USER_NAME"
echo "   Policy Name: $POLICY_NAME"
echo ""

# Read the policy document
POLICY_DOCUMENT=$(cat <<'EOF'
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
                "kms:ListAliases",
                "kms:ListKeys",
                "kms:TagResource",
                "kms:UntagResource",
                "kms:UpdateAlias"
            ],
            "Resource": "*"
        },
        {
            "Sid": "AllowKMSSigning",
            "Effect": "Allow",
            "Action": [
                "kms:Sign",
                "kms:Verify"
            ],
            "Resource": "*",
            "Condition": {
                "StringEquals": {
                    "kms:SigningAlgorithm": "ECDSA_SHA_256"
                }
            }
        }
    ]
}
EOF
)

echo "🔄 Updating inline policy for user: $IAM_USER_NAME"
echo ""

# Put the inline policy
aws iam put-user-policy \
    --user-name "$IAM_USER_NAME" \
    --policy-name "$POLICY_NAME" \
    --policy-document "$POLICY_DOCUMENT"

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Policy updated successfully!"
    echo ""
    echo "Permissions granted:"
    echo "  ✓ kms:CreateKey - Create new KMS keys"
    echo "  ✓ kms:CreateAlias - Create key aliases"
    echo "  ✓ kms:TagResource - Tag keys for organization"
    echo "  ✓ kms:GetPublicKey - Retrieve public keys"
    echo "  ✓ kms:Sign - Sign transactions"
    echo "  ✓ kms:DescribeKey - Get key metadata"
    echo ""
    echo "🎉 You can now create Hedera accounts with KMS keys!"
    echo ""
    echo "Test it:"
    echo "  1. npm run dev"
    echo "  2. Visit http://localhost:3000/dashboard"
    echo "  3. Click 'Create Hedera Account'"
else
    echo ""
    echo "❌ Failed to update policy"
    echo ""
    echo "Common issues:"
    echo "  - IAM user '$IAM_USER_NAME' doesn't exist"
    echo "  - You don't have IAM permissions"
    echo "  - AWS credentials not configured"
    echo ""
    echo "Verify user exists:"
    echo "  aws iam get-user --user-name $IAM_USER_NAME"
    exit 1
fi
