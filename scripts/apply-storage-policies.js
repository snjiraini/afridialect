#!/usr/bin/env node

/**
 * Apply Supabase Storage RLS Policies
 * 
 * This script reads the storage.sql file and executes it
 * to apply RLS policies to storage buckets.
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Error: Missing required environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function applyStoragePolicies() {
  console.log('🔒 Applying Storage RLS Policies...\n')

  // Read the SQL file
  const sqlPath = path.join(__dirname, '..', 'lib', 'supabase', 'storage.sql')
  
  if (!fs.existsSync(sqlPath)) {
    console.error('❌ Error: storage.sql not found at:', sqlPath)
    process.exit(1)
  }

  const sql = fs.readFileSync(sqlPath, 'utf8')

  console.log('📄 SQL file loaded:', sqlPath)
  console.log(`   Size: ${(sql.length / 1024).toFixed(2)}KB\n`)

  // Split into individual statements
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'))

  console.log(`Found ${statements.length} SQL statements to execute\n`)

  // Execute each statement
  let successCount = 0
  let errorCount = 0

  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i]
    
    // Skip comments and empty lines
    if (statement.startsWith('--') || statement.trim() === '') {
      continue
    }

    // Extract policy/table name for better logging
    let actionName = 'SQL statement'
    if (statement.includes('CREATE POLICY')) {
      const match = statement.match(/CREATE POLICY "([^"]+)"/)
      actionName = match ? `Policy: ${match[1]}` : 'CREATE POLICY'
    } else if (statement.includes('ALTER TABLE')) {
      const match = statement.match(/ALTER TABLE\s+(\S+)/)
      actionName = match ? `ALTER TABLE: ${match[1]}` : 'ALTER TABLE'
    } else if (statement.includes('INSERT INTO')) {
      const match = statement.match(/INSERT INTO\s+(\S+)/)
      actionName = match ? `INSERT INTO: ${match[1]}` : 'INSERT INTO'
    }

    process.stdout.write(`  [${i + 1}/${statements.length}] ${actionName}...`)

    const { data, error } = await supabase.rpc('exec_sql', { sql: statement + ';' })

    if (error) {
      // Some errors are expected (e.g., policy already exists)
      if (error.message.includes('already exists') || 
          error.message.includes('duplicate')) {
        process.stdout.write(' ⚠️  Already exists\n')
      } else {
        process.stdout.write(' ❌ Error\n')
        console.log(`      ${error.message}\n`)
        errorCount++
      }
    } else {
      process.stdout.write(' ✅\n')
      successCount++
    }
  }

  console.log('\n================================================')
  console.log('Storage RLS Policies Application Complete!')
  console.log('================================================\n')
  console.log(`✅ Success: ${successCount}`)
  console.log(`⚠️  Warnings: ${statements.length - successCount - errorCount}`)
  console.log(`❌ Errors: ${errorCount}\n`)

  if (errorCount === 0) {
    console.log('✅ All policies applied successfully!')
  } else {
    console.log('⚠️  Some errors occurred. Please check the output above.')
    console.log('   If policies already exist, you can safely ignore those errors.')
  }

  console.log('\n================================================')
  console.log('Next Steps:')
  console.log('================================================')
  console.log('1. Start dev server: npm run dev')
  console.log('2. Navigate to: http://localhost:3000/uploader')
  console.log('3. Test uploading an audio file')
  console.log('4. Check Supabase Dashboard > Storage to verify upload\n')
}

// Check if exec_sql RPC exists
async function checkRpcSupport() {
  console.log('🔍 Checking Supabase RPC support...\n')
  
  const { data, error } = await supabase.rpc('version', {})
  
  if (error && error.message.includes('not found')) {
    console.log('⚠️  RPC method not available in Supabase client.\n')
    console.log('The Supabase JavaScript client does not support executing arbitrary SQL.')
    console.log('You must apply the RLS policies manually:\n')
    console.log('1. Go to Supabase Dashboard > SQL Editor')
    console.log(`2. URL: ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/sql/new`)
    console.log('3. Copy and paste the contents of: lib/supabase/storage.sql')
    console.log('4. Click "Run" to apply the policies\n')
    console.log('================================================\n')
    return false
  }
  
  return true
}

async function main() {
  const canUseRpc = await checkRpcSupport()
  
  if (!canUseRpc) {
    console.log('📋 Manual setup required. See instructions above.')
    process.exit(0)
  }
  
  await applyStoragePolicies()
}

main().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
