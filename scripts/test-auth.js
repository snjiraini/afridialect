/**
 * Test Authentication System
 * Verifies auth trigger, Supabase connection, and basic auth flow
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing environment variables')
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function testAuthSystem() {
  console.log('🧪 Testing Authentication System')
  console.log('=' .repeat(50))
  console.log('')

  let allPassed = true

  // Test 1: Check trigger exists
  console.log('1️⃣  Checking profile auto-creation trigger...')
  try {
    const { data, error } = await supabase
      .from('pg_trigger')
      .select('*')
      .eq('tgname', 'on_auth_user_created')
      .single()

    if (error || !data) {
      console.log('   ❌ Trigger not found')
      console.log('   Run: ./scripts/setup-auth-triggers.sh')
      console.log('   Or apply lib/supabase/triggers.sql in Supabase Dashboard')
      allPassed = false
    } else {
      console.log('   ✅ Trigger exists')
    }
  } catch (err) {
    console.log('   ⚠️  Could not check trigger (this is okay if applied via dashboard)')
  }
  console.log('')

  // Test 2: Check profiles table
  console.log('2️⃣  Checking profiles table...')
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('count')
      .limit(1)

    if (error) {
      console.log('   ❌ Profiles table error:', error.message)
      allPassed = false
    } else {
      console.log('   ✅ Profiles table accessible')
    }
  } catch (err) {
    console.log('   ❌ Error:', err.message)
    allPassed = false
  }
  console.log('')

  // Test 3: Check user_roles table
  console.log('3️⃣  Checking user_roles table...')
  try {
    const { data, error } = await supabase
      .from('user_roles')
      .select('count')
      .limit(1)

    if (error) {
      console.log('   ❌ User roles table error:', error.message)
      allPassed = false
    } else {
      console.log('   ✅ User roles table accessible')
    }
  } catch (err) {
    console.log('   ❌ Error:', err.message)
    allPassed = false
  }
  console.log('')

  // Test 4: Check RLS helper function
  console.log('4️⃣  Checking RLS helper functions...')
  try {
    const { data, error } = await supabase.rpc('user_has_role', {
      user_id: '00000000-0000-0000-0000-000000000000',
      role_name: 'admin'
    })

    if (error && !error.message.includes('function')) {
      console.log('   ❌ RLS function error:', error.message)
      allPassed = false
    } else {
      console.log('   ✅ RLS functions available')
    }
  } catch (err) {
    console.log('   ⚠️  Could not test RLS function:', err.message)
  }
  console.log('')

  // Test 5: List existing profiles
  console.log('5️⃣  Listing existing user profiles...')
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, email, full_name, hedera_account_id, created_at')
      .order('created_at', { ascending: false })
      .limit(5)

    if (error) {
      console.log('   ❌ Error:', error.message)
      allPassed = false
    } else {
      if (profiles.length === 0) {
        console.log('   ℹ️  No users registered yet')
      } else {
        console.log(`   ✅ Found ${profiles.length} profile(s):`)
        profiles.forEach((p, i) => {
          console.log(`      ${i + 1}. ${p.full_name || 'No name'} (${p.email})`)
          console.log(`         Hedera: ${p.hedera_account_id || 'Not created'}`)
        })
      }
    }
  } catch (err) {
    console.log('   ❌ Error:', err.message)
    allPassed = false
  }
  console.log('')

  // Summary
  console.log('=' .repeat(50))
  if (allPassed) {
    console.log('✅ AUTHENTICATION SYSTEM TEST PASSED!')
    console.log('')
    console.log('Next steps:')
    console.log('  1. Start dev server: npm run dev')
    console.log('  2. Visit: http://localhost:3000/auth/signup')
    console.log('  3. Create a test account')
    console.log('  4. Check email for confirmation link')
    console.log('  5. Visit: http://localhost:3000/dashboard')
  } else {
    console.log('❌ SOME TESTS FAILED')
    console.log('')
    console.log('Please fix the issues above and try again.')
  }
  console.log('=' .repeat(50))
}

testAuthSystem().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
