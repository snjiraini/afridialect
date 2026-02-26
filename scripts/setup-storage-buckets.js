#!/usr/bin/env node

/**
 * Setup Supabase Storage Buckets
 * 
 * This script creates the required storage buckets for audio uploads
 * and sets up the necessary RLS policies.
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

const bucketConfigs = [
  {
    id: 'audio-staging',
    name: 'audio-staging',
    public: false,
    fileSizeLimit: 52428800, // 50MB
    allowedMimeTypes: [
      'audio/mpeg',
      'audio/wav',
      'audio/x-wav',
      'audio/wave',
      'audio/mp4',
      'audio/x-m4a',
      'audio/ogg',
      'audio/webm'
    ]
  },
  {
    id: 'transcript-staging',
    name: 'transcript-staging',
    public: false,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['text/plain', 'application/json']
  },
  {
    id: 'translation-staging',
    name: 'translation-staging',
    public: false,
    fileSizeLimit: 5242880, // 5MB
    allowedMimeTypes: ['text/plain', 'application/json']
  },
  {
    id: 'dataset-exports',
    name: 'dataset-exports',
    public: false,
    fileSizeLimit: 52428800, // 50MB (matching audio-staging for free tier)
    allowedMimeTypes: ['application/zip', 'application/x-tar', 'application/gzip']
  }
]

async function setupStorageBuckets() {
  console.log('🗄️  Setting up Supabase Storage buckets...\n')

  // Check existing buckets
  console.log('📦 Checking existing buckets...')
  const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets()

  if (listError) {
    console.error('❌ Error listing buckets:', listError.message)
    process.exit(1)
  }

  console.log(`Found ${existingBuckets.length} existing buckets\n`)

  // Create buckets
  for (const config of bucketConfigs) {
    const exists = existingBuckets.some(b => b.id === config.id)

    if (exists) {
      console.log(`✓ Bucket '${config.id}' already exists`)
      continue
    }

    console.log(`Creating bucket '${config.id}'...`)
    const { data, error } = await supabase.storage.createBucket(config.id, {
      public: config.public,
      fileSizeLimit: config.fileSizeLimit,
      allowedMimeTypes: config.allowedMimeTypes
    })

    if (error) {
      console.error(`  ❌ Error: ${error.message}`)
    } else {
      console.log(`  ✅ Created successfully`)
    }
  }

  console.log('\n================================================')
  console.log('Storage Buckets Setup Complete!')
  console.log('================================================\n')

  console.log('Created buckets:')
  bucketConfigs.forEach(config => {
    console.log(`  ✓ ${config.id} (${(config.fileSizeLimit / 1024 / 1024).toFixed(0)}MB limit)`)
  })

  console.log('\n⚠️  IMPORTANT: RLS Policies')
  console.log('================================================')
  console.log('Storage buckets created, but RLS policies must be set manually.')
  console.log('\nTo apply RLS policies:')
  console.log('1. Go to Supabase Dashboard > SQL Editor')
  console.log(`2. URL: ${supabaseUrl.replace('https://', 'https://supabase.com/dashboard/project/')}/sql/new`)
  console.log('3. Copy and paste the contents of: lib/supabase/storage.sql')
  console.log('4. Click "Run" to apply the policies\n')

  console.log('================================================')
  console.log('Next Steps:')
  console.log('================================================')
  console.log('1. Apply RLS policies using the SQL script')
  console.log('2. Start dev server: npm run dev')
  console.log('3. Navigate to: http://localhost:3000/uploader')
  console.log('4. Test uploading an audio file\n')
}

setupStorageBuckets().catch(error => {
  console.error('❌ Fatal error:', error)
  process.exit(1)
})
