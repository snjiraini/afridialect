#!/usr/bin/env node

/**
 * Create Admin User Script
 * 
 * Creates an admin user with pre-confirmed email
 * Usage: node scripts/create-admin-user.js <email> <password> [full_name]
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const email = process.argv[2]
const password = process.argv[3]
const fullName = process.argv[4] || 'Admin User'

if (!email || !password) {
  console.error('❌ Usage: node scripts/create-admin-user.js <email> <password> [full_name]')
  console.error('')
  console.error('Example:')
  console.error('  node scripts/create-admin-user.js admin@afridialect.ai SecurePass123! "John Admin"')
  process.exit(1)
}

// Validate email format
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
if (!emailRegex.test(email)) {
  console.error('❌ Invalid email format')
  process.exit(1)
}

// Validate password strength
if (password.length < 8) {
  console.error('❌ Password must be at least 8 characters')
  process.exit(1)
}

// Get environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY')
  process.exit(1)
}

async function createAdminUser() {
  console.log('👤 Creating Admin User...\n')
  console.log(`Email: ${email}`)
  console.log(`Name: ${fullName}`)
  console.log('')

  try {
    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    })

    // Check if user already exists
    console.log('🔍 Checking if user exists...')
    const { data: existingUsers } = await supabase.auth.admin.listUsers()
    const userExists = existingUsers?.users?.some(u => u.email === email)

    let userId

    if (userExists) {
      console.log('⚠️  User already exists with this email')
      const existingUser = existingUsers.users.find(u => u.email === email)
      userId = existingUser.id
      console.log(`   User ID: ${userId}`)
      console.log('')
    } else {
      // Create new user
      console.log('✅ Creating new user...')
      const { data, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          full_name: fullName,
        },
      })

      if (error) {
        console.error('❌ Error creating user:', error.message)
        process.exit(1)
      }

      userId = data.user.id
      console.log(`✅ User created successfully!`)
      console.log(`   User ID: ${userId}`)
      console.log('')
    }

    // Check if admin role already assigned
    console.log('🔍 Checking existing roles...')
    const { data: existingRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)

    if (existingRoles?.some(r => r.role === 'admin')) {
      console.log('✅ Admin role already assigned')
      console.log('')
    } else {
      // Assign admin role
      console.log('👑 Assigning admin role...')
      const { error: roleError } = await supabase
        .from('user_roles')
        .insert({
          user_id: userId,
          role: 'admin'
        })

      if (roleError) {
        console.error('❌ Error assigning admin role:', roleError.message)
        process.exit(1)
      }

      console.log('✅ Admin role assigned successfully!')
      console.log('')
    }

    // Verify roles
    console.log('📋 Verifying roles...')
    const { data: allRoles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)

    if (allRoles && allRoles.length > 0) {
      console.log('✅ Current roles:')
      allRoles.forEach(r => console.log(`   • ${r.role}`))
      console.log('')
    }

    console.log('================================================')
    console.log('✅ Admin User Setup Complete!')
    console.log('================================================')
    console.log('')
    console.log('Login Details:')
    console.log(`  Email: ${email}`)
    console.log(`  Password: ${password}`)
    console.log(`  User ID: ${userId}`)
    console.log('')
    console.log('Next Steps:')
    console.log('  1. Login at: http://localhost:3000/auth/login')
    console.log('  2. Access admin panel: http://localhost:3000/admin')
    console.log('  3. Create uploader users or assign roles')
    console.log('')

  } catch (error) {
    console.error('❌ Fatal error:', error)
    process.exit(1)
  }
}

createAdminUser()
