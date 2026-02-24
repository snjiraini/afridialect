#!/bin/bash

# Test Hedera Configuration
# Verifies AWS KMS and Hedera environment variables are set correctly

set -e

echo "================================"
echo "Testing Hedera Configuration"
echo "================================"
echo ""

# Load environment variables
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

all_passed=true

# Test AWS Configuration
echo "1️⃣  Checking AWS Configuration..."
if [ -z "$AWS_REGION" ]; then
  echo -e "   ${RED}❌ AWS_REGION not set${NC}"
  all_passed=false
else
  echo -e "   ${GREEN}✅ AWS_REGION: $AWS_REGION${NC}"
fi

if [ -z "$AWS_ACCESS_KEY_ID" ]; then
  echo -e "   ${RED}❌ AWS_ACCESS_KEY_ID not set${NC}"
  all_passed=false
else
  echo -e "   ${GREEN}✅ AWS_ACCESS_KEY_ID: ${AWS_ACCESS_KEY_ID:0:10}...${NC}"
fi

if [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
  echo -e "   ${RED}❌ AWS_SECRET_ACCESS_KEY not set${NC}"
  all_passed=false
else
  echo -e "   ${GREEN}✅ AWS_SECRET_ACCESS_KEY: ****${NC}"
fi

if [ -z "$AWS_KMS_KEY_ID" ]; then
  echo -e "   ${RED}❌ AWS_KMS_KEY_ID not set (Platform Guardian Key)${NC}"
  all_passed=false
else
  echo -e "   ${GREEN}✅ AWS_KMS_KEY_ID: $AWS_KMS_KEY_ID${NC}"
fi
echo ""

# Test Hedera Configuration
echo "2️⃣  Checking Hedera Configuration..."
if [ -z "$HEDERA_NETWORK" ]; then
  echo -e "   ${YELLOW}⚠️  HEDERA_NETWORK not set (defaulting to testnet)${NC}"
else
  echo -e "   ${GREEN}✅ HEDERA_NETWORK: $HEDERA_NETWORK${NC}"
fi

if [ -z "$HEDERA_OPERATOR_ACCOUNT_ID" ]; then
  echo -e "   ${RED}❌ HEDERA_OPERATOR_ACCOUNT_ID not set${NC}"
  echo -e "   ${YELLOW}   This is required to create accounts and submit transactions${NC}"
  all_passed=false
else
  echo -e "   ${GREEN}✅ HEDERA_OPERATOR_ACCOUNT_ID: $HEDERA_OPERATOR_ACCOUNT_ID${NC}"
fi

if [ -z "$HEDERA_OPERATOR_PRIVATE_KEY" ]; then
  echo -e "   ${RED}❌ HEDERA_OPERATOR_PRIVATE_KEY not set${NC}"
  echo -e "   ${YELLOW}   This is required to sign transactions${NC}"
  all_passed=false
else
  echo -e "   ${GREEN}✅ HEDERA_OPERATOR_PRIVATE_KEY: ****${NC}"
fi

if [ -z "$HEDERA_TREASURY_ACCOUNT_ID" ]; then
  echo -e "   ${YELLOW}⚠️  HEDERA_TREASURY_ACCOUNT_ID not set${NC}"
  echo -e "   ${YELLOW}   This will be needed for payments and NFT operations${NC}"
else
  echo -e "   ${GREEN}✅ HEDERA_TREASURY_ACCOUNT_ID: $HEDERA_TREASURY_ACCOUNT_ID${NC}"
fi
echo ""

# Summary
echo "================================"
if [ "$all_passed" = true ]; then
  echo -e "${GREEN}✅ HEDERA CONFIGURATION TEST PASSED!${NC}"
  echo ""
  echo "Your environment is configured for Hedera account creation."
  echo ""
  echo "Next steps:"
  echo "  1. Start dev server: npm run dev"
  echo "  2. Sign up/login at: http://localhost:3000/auth/login"
  echo "  3. Go to dashboard: http://localhost:3000/dashboard"
  echo "  4. Click 'Create Hedera Account' button"
  echo "  5. Monitor server logs for account creation details"
else
  echo -e "${RED}❌ SOME TESTS FAILED${NC}"
  echo ""
  echo "Please fix the missing environment variables in .env.local"
  echo ""
  echo "Required variables:"
  echo "  - AWS_REGION"
  echo "  - AWS_ACCESS_KEY_ID"
  echo "  - AWS_SECRET_ACCESS_KEY"
  echo "  - AWS_KMS_KEY_ID (Platform Guardian Key)"
  echo "  - HEDERA_OPERATOR_ACCOUNT_ID"
  echo "  - HEDERA_OPERATOR_PRIVATE_KEY"
  echo ""
  echo "See docs/hedera-kms-setup-guide.md for setup instructions"
fi
echo "================================"
