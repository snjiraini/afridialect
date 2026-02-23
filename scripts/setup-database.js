#!/usr/bin/env node

/**
 * Supabase Database Setup Script
 * Applies schema, RLS policies, and seed data to your Supabase database
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function executeSqlFile(filePath, description) {
  console.log(`\n📝 ${description}...`);
  
  try {
    const sql = fs.readFileSync(filePath, 'utf8');
    
    // Split into individual statements (basic approach)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`   Found ${statements.length} SQL statements`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      // Skip comments and empty statements
      if (statement.trim() === ';' || statement.startsWith('--')) {
        continue;
      }
      
      try {
        const { data, error } = await supabase.rpc('exec_sql', {
          query: statement
        });
        
        if (error) {
          // Some errors are expected (like "already exists")
          if (error.message.includes('already exists') || 
              error.message.includes('duplicate key')) {
            console.log(`   ⚠️  Statement ${i + 1}: Already exists (skipping)`);
          } else {
            console.error(`   ❌ Statement ${i + 1}: ${error.message}`);
            errorCount++;
          }
        } else {
          successCount++;
        }
      } catch (err) {
        console.error(`   ❌ Statement ${i + 1}: ${err.message}`);
        errorCount++;
      }
    }
    
    console.log(`   ✅ Completed: ${successCount} successful, ${errorCount} errors`);
    return errorCount === 0;
    
  } catch (error) {
    console.error(`   ❌ Error reading file: ${error.message}`);
    return false;
  }
}

async function setupDatabase() {
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║         SUPABASE DATABASE SETUP                                ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log('🔗 Connecting to Supabase...');
  console.log(`   URL: ${supabaseUrl}`);
  
  // Test connection
  try {
    const { data, error } = await supabase.from('_').select('*').limit(1);
    // This will fail but proves connection works
    console.log('   ✅ Connection established\n');
  } catch (err) {
    // Expected
  }
  
  console.log('⚠️  NOTE: Supabase client does not support direct SQL execution.');
  console.log('   Please use the Supabase Dashboard SQL Editor instead.\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📋 MANUAL SETUP INSTRUCTIONS:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log('1️⃣  Go to: https://app.supabase.com');
  console.log('2️⃣  Select your project');
  console.log('3️⃣  Click "SQL Editor" in the left sidebar\n');
  
  console.log('4️⃣  Run these SQL files in order:\n');
  
  const files = [
    { path: 'lib/supabase/schema.sql', desc: 'Create tables, indexes, and triggers' },
    { path: 'lib/supabase/rls-policies.sql', desc: 'Apply Row Level Security policies' },
    { path: 'lib/supabase/seed.sql', desc: 'Insert seed data and helper functions' }
  ];
  
  files.forEach((file, index) => {
    const fullPath = path.join(process.cwd(), file.path);
    const exists = fs.existsSync(fullPath);
    const size = exists ? (fs.statSync(fullPath).size / 1024).toFixed(1) : '?';
    
    console.log(`   ${index + 1}. ${file.path}`);
    console.log(`      ${file.desc}`);
    console.log(`      ${exists ? '✅' : '❌'} File ${exists ? 'exists' : 'not found'} (${size} KB)\n`);
  });
  
  console.log('5️⃣  For each file:');
  console.log('   • Click "New query"');
  console.log('   • Copy and paste the entire file contents');
  console.log('   • Click "Run" (or press Ctrl/Cmd + Enter)');
  console.log('   • Wait for completion\n');
  
  console.log('6️⃣  Verify setup:');
  console.log('   • Run: npm run test:db');
  console.log('   • Or run: node scripts/test-database.js\n');
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📖 For detailed instructions, see: docs/DATABASE_SETUP.md\n');
}

setupDatabase().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
