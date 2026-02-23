#!/bin/bash

# ========================================
# Supabase Database Setup Script (CLI)
# ========================================
# This script applies the database schema using Supabase CLI
#
# Prerequisites:
# - Supabase CLI installed
# - .env.local configured with credentials
# ========================================

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         SUPABASE DATABASE SETUP (CLI)                         ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Load environment variables
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found"
    echo "   Please create .env.local with your Supabase credentials"
    exit 1
fi

source .env.local

# Check required variables
if [ -z "$NEXT_PUBLIC_SUPABASE_URL" ]; then
    echo "❌ Error: NEXT_PUBLIC_SUPABASE_URL not set in .env.local"
    exit 1
fi

if [ -z "$SUPABASE_DB_PASSWORD" ] && [ -z "$SUPABASE_SECRET_KEY" ]; then
    echo "❌ Error: Database password not found"
    echo "   Please set either SUPABASE_DB_PASSWORD or SUPABASE_SECRET_KEY"
    exit 1
fi

echo "✅ Environment variables loaded"
echo ""

# Extract project ref from URL
PROJECT_REF=$(echo $NEXT_PUBLIC_SUPABASE_URL | sed -E 's|https://([^.]+)\.supabase\.co|\1|')
echo "📡 Project: $PROJECT_REF"
echo ""

# Check if supabase CLI is available
if ! command -v supabase &> /dev/null; then
    if ! command -v npx &> /dev/null; then
        echo "❌ Error: Neither 'supabase' nor 'npx' found"
        echo "   Please install Supabase CLI: npm install -g supabase"
        exit 1
    fi
    SUPABASE_CMD="npx supabase"
    echo "📦 Using npx supabase"
else
    SUPABASE_CMD="supabase"
    echo "📦 Using installed supabase CLI"
fi

echo ""

# Link to remote project if not already linked
echo "🔗 Linking to Supabase project..."
$SUPABASE_CMD link --project-ref $PROJECT_REF 2>/dev/null || echo "   (Already linked or skipping)"
echo ""

# Function to execute SQL file
execute_sql_file() {
    local file=$1
    local description=$2
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📝 $description"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    
    if [ ! -f "$file" ]; then
        echo "❌ Error: File not found: $file"
        return 1
    fi
    
    echo "📄 File: $file"
    echo "📊 Size: $(du -h $file | cut -f1)"
    echo ""
    
    # Use Supabase CLI to execute the SQL
    echo "⏳ Executing SQL..."
    if $SUPABASE_CMD db execute --file "$file" --project-ref $PROJECT_REF; then
        echo "✅ Success!"
        echo ""
        return 0
    else
        echo "❌ Failed to execute $file"
        echo ""
        return 1
    fi
}

# Main execution
echo "🚀 Starting database setup..."
echo ""

# Step 1: Schema
if execute_sql_file "lib/supabase/schema.sql" "Step 1/3: Creating tables, indexes, and triggers"; then
    SCHEMA_SUCCESS=true
else
    SCHEMA_SUCCESS=false
    echo "⚠️  Warning: Schema creation had errors"
    echo "   This might be OK if tables already exist"
    echo ""
fi

# Step 2: RLS Policies
if execute_sql_file "lib/supabase/rls-policies.sql" "Step 2/3: Applying Row Level Security policies"; then
    RLS_SUCCESS=true
else
    RLS_SUCCESS=false
    echo "⚠️  Warning: RLS policy creation had errors"
    echo "   This might be OK if policies already exist"
    echo ""
fi

# Step 3: Seed Data
if execute_sql_file "lib/supabase/seed.sql" "Step 3/3: Inserting seed data and helper functions"; then
    SEED_SUCCESS=true
else
    SEED_SUCCESS=false
    echo "⚠️  Warning: Seed data insertion had errors"
    echo "   This might be OK if data already exists"
    echo ""
fi

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📊 SETUP SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Schema:       $([ "$SCHEMA_SUCCESS" = true ] && echo "✅ Success" || echo "⚠️  Had errors")"
echo "RLS Policies: $([ "$RLS_SUCCESS" = true ] && echo "✅ Success" || echo "⚠️  Had errors")"
echo "Seed Data:    $([ "$SEED_SUCCESS" = true ] && echo "✅ Success" || echo "⚠️  Had errors")"
echo ""

# Run test
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 RUNNING DATABASE TEST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if node scripts/test-database.js; then
    echo ""
    echo "╔════════════════════════════════════════════════════════════════╗"
    echo "║         DATABASE SETUP COMPLETE ✅                             ║"
    echo "╚════════════════════════════════════════════════════════════════╝"
    echo ""
    echo "🎉 Your database is ready!"
    echo ""
    echo "📋 What was created:"
    echo "   • 13 core tables + 2 reference tables"
    echo "   • 35+ Row Level Security policies"
    echo "   • 7 helper functions"
    echo "   • 5 automatic triggers"
    echo "   • Seed data (dialects, rejection reasons, config)"
    echo ""
    echo "🔜 Next steps:"
    echo "   • Continue with Phase 3: Authentication"
    echo "   • See PROJECT_PROGRESS.md for details"
    echo ""
    exit 0
else
    echo ""
    echo "⚠️  Database test failed"
    echo ""
    echo "🔍 Troubleshooting:"
    echo "   1. Check Supabase Dashboard → SQL Editor for errors"
    echo "   2. Verify all SQL files were executed"
    echo "   3. Check logs: $SUPABASE_CMD db logs"
    echo "   4. See docs/DATABASE_SETUP.md for manual setup"
    echo ""
    exit 1
fi
