#!/bin/bash

# Test Hedera Account Creation API
# This script tests the /api/hedera/create-account endpoint

set -e

echo "🧪 Testing Hedera Account Creation API"
echo "======================================="
echo ""

# Check if server is running
if ! curl -s http://localhost:3000 > /dev/null; then
    echo "❌ Dev server is not running at http://localhost:3000"
    echo "Please start it with: npm run dev"
    exit 1
fi

echo "✅ Dev server is running"
echo ""

# Get session cookie (you'll need to be logged in first)
echo "📋 Testing API endpoint (requires authentication)"
echo ""

# Test the endpoint
echo "Making POST request to /api/hedera/create-account..."
curl -v -X POST http://localhost:3000/api/hedera/create-account \
  -H "Content-Type: application/json" \
  -b "$(echo $COOKIES)" \
  2>&1 | grep -E "^< HTTP|^< content-type|^\{.*\}"

echo ""
echo "Done!"
