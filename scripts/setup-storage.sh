#!/bin/bash

# ========================================
# Supabase Storage Bucket Setup Script
# ========================================
# This script creates storage buckets and RLS policies
# Run this after setting up the database schema
# ========================================

echo "🗄️  Setting up Supabase Storage buckets..."
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
  echo "❌ Error: .env.local file not found"
  echo "Please create .env.local with your Supabase credentials"
  exit 1
fi

# Load environment variables
source .env.local

# Check required variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ] || [ -z "$SUPABASE_SECRET_KEY" ]; then
  echo "❌ Error: Missing required environment variables"
  echo "Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY"
  exit 1
fi

echo "📦 Supabase URL: $NEXT_PUBLIC_SUPABASE_URL"
echo ""

# Extract project ID from URL
PROJECT_ID=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed -E 's|https://([^.]+)\.supabase\.co|\1|')
echo "🔑 Project ID: $PROJECT_ID"
echo ""

echo "================================================"
echo "Please run the following SQL in Supabase Dashboard:"
echo "================================================"
echo ""
echo "1. Go to: https://supabase.com/dashboard/project/$PROJECT_ID/sql/new"
echo "2. Copy and paste the contents of: lib/supabase/storage.sql"
echo "3. Click 'Run' to create the buckets and policies"
echo ""
echo "The script will create:"
echo "  ✓ audio-staging bucket (50MB limit)"
echo "  ✓ transcript-staging bucket (5MB limit)"
echo "  ✓ translation-staging bucket (5MB limit)"
echo "  ✓ dataset-exports bucket (1GB limit)"
echo "  ✓ RLS policies for each bucket"
echo ""
echo "================================================"
echo ""

# Verify storage is accessible via API
echo "🔍 Checking if Storage API is accessible..."
STORAGE_URL="$NEXT_PUBLIC_SUPABASE_URL/storage/v1/bucket"

RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" -H "Authorization: Bearer $SUPABASE_SECRET_KEY" "$STORAGE_URL")

if [ "$RESPONSE" = "200" ]; then
  echo "✅ Storage API is accessible"
  echo ""
  
  # List existing buckets
  echo "📦 Existing buckets:"
  curl -s -H "Authorization: Bearer $SUPABASE_SECRET_KEY" "$STORAGE_URL" | python3 -m json.tool 2>/dev/null || echo "Unable to parse response"
  echo ""
else
  echo "⚠️  Storage API returned status: $RESPONSE"
  echo "   This may be normal if buckets don't exist yet"
  echo ""
fi

echo "================================================"
echo "Next Steps:"
echo "================================================"
echo ""
echo "1. Run the SQL script as described above"
echo "2. Test upload with: npm run dev"
echo "3. Navigate to: http://localhost:3000/uploader"
echo "4. Upload a test audio file"
echo ""
echo "✅ Setup instructions complete!"
