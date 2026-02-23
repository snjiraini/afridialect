#!/bin/bash

# ========================================
# Supabase Database Migration Script
# ========================================
# This script applies the database schema to your Supabase project
#
# Usage: ./scripts/migrate-database.sh
#
# Prerequisites:
# - Supabase project created
# - NEXT_PUBLIC_SUPABASE_URL set in .env.local
# - SUPABASE_SECRET_KEY set in .env.local
# ========================================

set -e

echo "🗄️  Afridialect Database Migration"
echo "=================================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found"
    echo "Please create .env.local with your Supabase credentials"
    exit 1
fi

# Source environment variables
source .env.local

# Check if required variables are set
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "❌ Error: NEXT_PUBLIC_SUPABASE_URL not set in .env.local"
    exit 1
fi

if [ -z "$SUPABASE_SECRET_KEY" ]; then
    echo "❌ Error: SUPABASE_SECRET_KEY not set in .env.local"
    exit 1
fi

echo "✅ Environment variables loaded"
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "⚠️  Warning: psql not found. Using curl to execute SQL..."
    echo ""
    USE_CURL=true
else
    echo "✅ psql found"
    USE_CURL=false
fi

# Extract database connection details from Supabase URL
PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed -E 's|https://([^.]+)\.supabase\.co|\1|')
DB_HOST="db.${PROJECT_REF}.supabase.co"
DB_PORT="5432"
DB_NAME="postgres"
DB_USER="postgres"

echo "📡 Connecting to Supabase project: $PROJECT_REF"
echo ""

# Function to execute SQL file
execute_sql() {
    local file=$1
    local description=$2
    
    echo "📝 $description..."
    
    if [ "$USE_CURL" = true ]; then
        # Use Supabase REST API to execute SQL
        response=$(curl -s -X POST \
            "${NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql" \
            -H "apikey: ${SUPABASE_SECRET_KEY}" \
            -H "Authorization: Bearer ${SUPABASE_SECRET_KEY}" \
            -H "Content-Type: application/json" \
            -d "{\"query\": \"$(cat $file | sed 's/"/\\"/g' | tr '\n' ' ')\"}")
        
        if echo "$response" | grep -q "error"; then
            echo "❌ Error executing $file"
            echo "$response"
            exit 1
        fi
    else
        # Use psql for better error reporting
        PGPASSWORD="${SUPABASE_SECRET_KEY}" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -f "$file" \
            --set ON_ERROR_STOP=1
        
        if [ $? -ne 0 ]; then
            echo "❌ Error executing $file"
            exit 1
        fi
    fi
    
    echo "✅ $description complete"
    echo ""
}

# Migration steps
echo "🚀 Starting database migration..."
echo ""

# Step 1: Apply schema
execute_sql "lib/supabase/schema.sql" "Creating tables and indexes"

# Step 2: Apply RLS policies
execute_sql "lib/supabase/rls-policies.sql" "Applying Row Level Security policies"

# Step 3: Seed data
execute_sql "lib/supabase/seed.sql" "Inserting seed data and creating functions"

echo "=================================="
echo "✅ Database migration complete!"
echo ""
echo "📊 Your database now includes:"
echo "   • 13 core tables with relationships"
echo "   • Row Level Security policies"
echo "   • Helper functions and triggers"
echo "   • Reference data (dialects, rejection reasons)"
echo ""
echo "🔗 Next steps:"
echo "   1. Verify tables in Supabase Dashboard → Table Editor"
echo "   2. Check RLS policies in Authentication → Policies"
echo "   3. Continue with Phase 3: Authentication & User Management"
echo ""
