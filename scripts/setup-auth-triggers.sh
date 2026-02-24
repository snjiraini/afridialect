#!/bin/bash

# Apply Auth Triggers Script
# Applies the profile auto-creation trigger to Supabase

set -e

echo "================================"
echo "Applying Auth Triggers"
echo "================================"
echo ""

# Load environment variables
if [ -f .env.local ]; then
  export $(grep -v '^#' .env.local | xargs)
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ ERROR: DATABASE_URL not found in .env.local"
  echo ""
  echo "Please set your DATABASE_URL in .env.local"
  exit 1
fi

echo "📝 Applying profile auto-creation trigger..."
echo ""

# Apply the trigger
psql "$DATABASE_URL" -f lib/supabase/triggers.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Trigger applied successfully!"
  echo ""
  echo "The following trigger is now active:"
  echo "  - handle_new_user() - Auto-creates profile on user signup"
  echo ""
else
  echo ""
  echo "❌ Failed to apply trigger"
  exit 1
fi
