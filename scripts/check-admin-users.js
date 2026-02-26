#!/usr/bin/env node

/**
 * Check Admin Users
 * 
 * This script checks if there are any admin users in the database
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing Supabase credentials')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function checkAdminUsers() {
  console.log('🔍 Checking for admin users...\n')
  
  try {
    // Get all users with admin role
    const { data: adminRoles, error: rolesError } = await supabase
      .from('user_roles')
      .select('user_id, role')
      .eq('role', 'admin')
    
    if (rolesError) {
      console.error('❌ Error fetching roles:', rolesError.message)
      process.exit(1)
    }
    
    if (!adminRoles || adminRoles.length === 0) {
      console.log('❌ No admin users found in the database.\n')
      console.log('═══════════════════════════════════════════════')
      console.log('You need to assign admin role to a user.')
      console.log('═══════════════════════════════════════════════\n')
      console.log('Option 1: Use SQL in Supabase Dashboard')
      console.log('─────────────────────────────────────────────')
      console.log('1. Go to: https://supabase.com/dashboard/project/phjgebfpybxcbfkxnckb/sql/new')
      console.log('2. Find your user ID:')
      console.log('   SELECT id, email FROM auth.users;')
      console.log('3. Assign admin role:')
      console.log('   INSERT INTO public.user_roles (user_id, role)')
      console.log('   VALUES (\'YOUR-USER-ID\', \'admin\');')
      console.log('')
      console.log('Option 2: Use the create test user API')
      console.log('─────────────────────────────────────────────')
      console.log('Create a dedicated admin account via the admin creation form.\n')
      process.exit(0)
    }
    
    console.log(`✅ Found ${adminRoles.length} admin user(s):\n`)
    
    // Get user details for each admin
    for (const role of adminRoles) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('full_name, email')
        .eq('id', role.user_id)
        .single()
      
      if (profile) {
        console.log(`  👤 ${profile.full_name || 'No name'}`)
        console.log(`     Email: ${profile.email}`)
        console.log(`     ID: ${role.user_id}\n`)
      }
    }
    
    // Also check all users and their roles
    console.log('═══════════════════════════════════════════════')
    console.log('📋 All users and their roles:')
    console.log('═══════════════════════════════════════════════\n')
    
    const { data: allUsers, error: usersError } = await supabase
      .from('profiles')
      .select('id, email, full_name')
    
    if (usersError) {
      console.error('Error fetching users:', usersError.message)
    } else if (allUsers) {
      for (const user of allUsers) {
        const { data: userRoles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
        
        const roles = userRoles?.map(r => r.role).join(', ') || 'No roles'
        const name = user.full_name || 'No name'
        console.log(`  • ${user.email}`)
        console.log(`    Name: ${name}`)
        console.log(`    Roles: ${roles}\n`)
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    process.exit(1)
  }
}

checkAdminUsers()
