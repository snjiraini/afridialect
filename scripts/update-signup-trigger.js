#!/usr/bin/env node

/**
 * Update Database Trigger for Auto-Role Assignment
 * 
 * Updates the handle_new_user() trigger to automatically assign
 * the 'uploader' role to all new users during signup.
 * 
 * Usage: node scripts/update-signup-trigger.js
 */

require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')
const fs = require('fs')
const path = require('path')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables')
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

async function updateTrigger() {
  console.log('🔧 Updating signup trigger for automatic role assignment...\n')

  const triggerSQL = `
-- Function to create profile and assign default role on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Create profile
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
  );
  
  -- Automatically assign uploader role to all new users
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'uploader')
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
`

  console.log('📝 SQL to execute:')
  console.log('─'.repeat(60))
  console.log(triggerSQL)
  console.log('─'.repeat(60))
  console.log('')

  console.log('⚠️  Note: Supabase JavaScript client cannot execute DDL statements.')
  console.log('          You must run this SQL manually in Supabase Dashboard.\n')
  
  console.log('📋 Manual Steps:')
  console.log('═'.repeat(60))
  console.log('1. Go to Supabase Dashboard > SQL Editor')
  console.log(`2. URL: ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/sql/new`)
  console.log('3. Copy and paste the SQL above')
  console.log('4. Click "Run"')
  console.log('═'.repeat(60))
  console.log('')

  console.log('✨ What This Does:')
  console.log('  • Updates handle_new_user() function')
  console.log('  • Auto-creates profile for new users')
  console.log('  • Auto-assigns "uploader" role to all new signups')
  console.log('  • Existing users are NOT affected')
  console.log('')

  console.log('🧪 Testing:')
  console.log('  1. Create a new user via signup page')
  console.log('  2. Check user_roles table for automatic assignment')
  console.log('  3. Verify new user can access /uploader page')
  console.log('')

  console.log('📌 To manually assign uploader role to existing users:')
  console.log('─'.repeat(60))
  console.log(`
-- Assign uploader role to all existing users who don't have it
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'uploader'
FROM auth.users
WHERE id NOT IN (
  SELECT user_id 
  FROM public.user_roles 
  WHERE role = 'uploader'
)
ON CONFLICT (user_id, role) DO NOTHING;
`)
  console.log('─'.repeat(60))
  console.log('')
}

updateTrigger().catch(error => {
  console.error('❌ Error:', error)
  process.exit(1)
})
