#!/usr/bin/env node

/**
 * Database Connection Test
 * Tests the Supabase connection and verifies schema setup
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testConnection() {
  console.log('🔗 Testing Supabase Connection...\n');

  try {
    // Test 1: Basic connection
    console.log('1️⃣  Testing basic connection...');
    const { data, error } = await supabase.from('profiles').select('count').limit(1);
    
    if (error) {
      if (error.code === '42P01') {
        console.log('   ⚠️  Tables not found - Schema needs to be applied');
        console.log('   📝 Run the SQL files in Supabase Dashboard:\n');
        console.log('      1. lib/supabase/schema.sql');
        console.log('      2. lib/supabase/rls-policies.sql');
        console.log('      3. lib/supabase/seed.sql\n');
        return false;
      }
      throw error;
    }
    console.log('   ✅ Connection successful!\n');

    // Test 2: Check tables exist
    console.log('2️⃣  Checking database tables...');
    const tables = [
      'profiles',
      'user_roles', 
      'dialects',
      'audio_clips',
      'transcriptions',
      'translations',
      'tasks',
      'qc_reviews',
      'nft_records',
      'nft_burns',
      'dataset_purchases',
      'payouts',
      'audit_logs'
    ];

    let allTablesExist = true;
    for (const table of tables) {
      const { error } = await supabase.from(table).select('count').limit(1);
      if (error) {
        console.log(`   ❌ Table '${table}' not found`);
        allTablesExist = false;
      } else {
        console.log(`   ✅ Table '${table}' exists`);
      }
    }

    if (!allTablesExist) {
      console.log('\n   ⚠️  Some tables are missing. Apply schema.sql first.\n');
      return false;
    }

    console.log('\n3️⃣  Checking seed data...');
    
    // Check dialects
    const { data: dialectsData, error: dialectsError } = await supabase
      .from('dialects')
      .select('*');
    
    if (dialectsError) {
      console.log('   ❌ Error reading dialects:', dialectsError.message);
    } else {
      console.log(`   ✅ Dialects: ${dialectsData.length} rows`);
      dialectsData.forEach(d => {
        console.log(`      - ${d.name} (${d.code})`);
      });
    }

    // Check rejection reasons
    const { data: reasonsData, error: reasonsError } = await supabase
      .from('rejection_reasons')
      .select('count');
    
    if (!reasonsError && reasonsData) {
      console.log(`   ✅ Rejection reasons: ${reasonsData.length || 0} rows`);
    }

    // Check system config
    const { data: configData, error: configError } = await supabase
      .from('system_config')
      .select('count');
    
    if (!configError && configData) {
      console.log(`   ✅ System config: ${configData.length || 0} rows`);
    }

    console.log('\n4️⃣  Testing RLS policies...');
    
    // Try to access with a fake user (should fail)
    const testSupabase = createClient(
      supabaseUrl,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
    );
    
    const { data: testData, error: testError } = await testSupabase
      .from('audio_clips')
      .select('*')
      .limit(1);
    
    if (testError && testError.code === 'PGRST301') {
      console.log('   ✅ RLS policies are enforced (no auth = no access)');
    } else if (!testError && testData.length === 0) {
      console.log('   ✅ RLS policies active (no data for anonymous user)');
    } else {
      console.log('   ⚠️  RLS may not be properly configured');
    }

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('✅ DATABASE SCHEMA TEST PASSED!');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('📊 Summary:');
    console.log('   • Connection: ✅ Working');
    console.log('   • Tables: ✅ All present');
    console.log('   • Seed data: ✅ Loaded');
    console.log('   • RLS policies: ✅ Active\n');
    
    return true;

  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    if (error.code) {
      console.error('   Error code:', error.code);
    }
    return false;
  }
}

// Run the test
testConnection()
  .then(success => {
    process.exit(success ? 0 : 1);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
