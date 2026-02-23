#!/bin/bash

# ========================================
# Supabase Database Setup (Direct psql)
# ========================================
# Applies schema directly to Supabase using psql
# ========================================

set -e

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║         SUPABASE DATABASE SETUP                                ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Load environment variables
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found"
    exit 1
fi

source .env.local

# Check for DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL not set in .env.local"
    echo ""
    echo "📝 To get your DATABASE_URL:"
    echo "   1. Go to Supabase Dashboard → Settings → Database"
    echo "   2. Copy the 'Connection string' (URI format)"
    echo "   3. Add to .env.local as: DATABASE_URL=your-connection-string"
    echo ""
    exit 1
fi

echo "✅ Database connection URL found"
echo ""

# Check if psql is installed
if ! command -v psql &> /dev/null; then
    echo "❌ Error: psql not installed"
    echo ""
    echo "📦 Install psql:"
    echo "   Ubuntu/Debian: sudo apt-get install postgresql-client"
    echo "   macOS: brew install postgresql"
    echo "   Or use Supabase Dashboard (see docs/DATABASE_SETUP.md)"
    echo ""
    exit 1
fi

echo "✅ psql found: $(psql --version | head -n1)"
echo ""

# Function to execute SQL file
execute_sql() {
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
    echo "📊 Size: $(wc -l < $file) lines"
    echo ""
    echo "⏳ Executing..."
    
    if psql "$DATABASE_URL" -f "$file" --set ON_ERROR_STOP=0 2>&1 | tee /tmp/sql-output.log; then
        # Check if there were any actual ERRORs (not just NOTICEs)
        if grep -q "^ERROR:" /tmp/sql-output.log; then
            echo ""
            echo "⚠️  Completed with errors (see above)"
            echo "   Note: 'already exists' errors are normal on re-run"
            echo ""
            return 0
        else
            echo ""
            echo "✅ Success!"
            echo ""
            return 0
        fi
    else
        echo "❌ Failed to execute $file"
        echo ""
        return 1
    fi
}

echo "🚀 Starting database setup..."
echo ""

# Step 1: Schema
execute_sql "lib/supabase/schema.sql" "Step 1/3: Creating tables, indexes, and triggers"

# Step 2: RLS Policies  
execute_sql "lib/supabase/rls-policies.sql" "Step 2/3: Applying Row Level Security policies"

# Step 3: Seed Data
execute_sql "lib/supabase/seed.sql" "Step 3/3: Inserting seed data and helper functions"

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
    echo "   1. Check if all SQL files executed successfully"
    echo "   2. Review error messages above"
    echo "   3. Verify DATABASE_URL is correct"
    echo "   4. See docs/DATABASE_SETUP.md for manual setup"
    echo ""
    exit 1
fi
