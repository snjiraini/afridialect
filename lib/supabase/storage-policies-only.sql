-- ========================================
-- Supabase Storage RLS Policies ONLY
-- ========================================
-- Run this SQL in Supabase Dashboard > SQL Editor
-- 
-- IMPORTANT: Skip the bucket creation (already done via API)
-- This only creates the RLS policies for storage.objects
-- ========================================

-- ========================================
-- STORAGE RLS POLICIES
-- ========================================

-- Enable RLS on storage.objects (if not already enabled)
--ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
--You do not need to run ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;. Supabase enables RLS on storage tables by default.

-- ========================================
-- AUDIO-STAGING POLICIES
-- ========================================

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Uploaders can upload audio files" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can view their own audio files" ON storage.objects;
DROP POLICY IF EXISTS "Reviewers can view all audio files" ON storage.objects;
DROP POLICY IF EXISTS "Admins have full access to audio-staging" ON storage.objects;
DROP POLICY IF EXISTS "Uploaders can delete their own audio files" ON storage.objects;

-- Uploaders can insert their own files
CREATE POLICY "Uploaders can upload audio files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'audio-staging' AND
    auth.uid() IN (
      SELECT user_id
      FROM public.user_roles
      WHERE role = 'uploader'
    )
  );

-- Uploaders can read their own files
CREATE POLICY "Uploaders can view their own audio files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'audio-staging' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Reviewers can read all audio files for QC
CREATE POLICY "Reviewers can view all audio files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'audio-staging' AND
    auth.uid() IN (
      SELECT user_id
      FROM public.user_roles
      WHERE role = 'reviewer'
    )
  );

-- Admins can manage all audio files
CREATE POLICY "Admins have full access to audio-staging"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'audio-staging' AND
    auth.uid() IN (
      SELECT user_id
      FROM public.user_roles
      WHERE role = 'admin'
    )
  );

-- Uploaders can delete their own files
CREATE POLICY "Uploaders can delete their own audio files"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'audio-staging' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- ========================================
-- TRANSCRIPT-STAGING POLICIES
-- ========================================

DROP POLICY IF EXISTS "Transcribers can upload transcript files" ON storage.objects;
DROP POLICY IF EXISTS "Transcribers can view their own transcript files" ON storage.objects;
DROP POLICY IF EXISTS "Reviewers can view all transcript files" ON storage.objects;
DROP POLICY IF EXISTS "Admins have full access to transcript-staging" ON storage.objects;

-- Transcribers can upload transcript files
CREATE POLICY "Transcribers can upload transcript files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'transcript-staging' AND
    auth.uid() IN (
      SELECT user_id
      FROM public.user_roles
      WHERE role = 'transcriber'
    )
  );

-- Transcribers can read their own transcript files
CREATE POLICY "Transcribers can view their own transcript files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'transcript-staging' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Reviewers can view all transcript files
CREATE POLICY "Reviewers can view all transcript files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'transcript-staging' AND
    auth.uid() IN (
      SELECT user_id
      FROM public.user_roles
      WHERE role = 'reviewer'
    )
  );

-- Admins have full access
CREATE POLICY "Admins have full access to transcript-staging"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'transcript-staging' AND
    auth.uid() IN (
      SELECT user_id
      FROM public.user_roles
      WHERE role = 'admin'
    )
  );

-- ========================================
-- TRANSLATION-STAGING POLICIES
-- ========================================

DROP POLICY IF EXISTS "Translators can upload translation files" ON storage.objects;
DROP POLICY IF EXISTS "Translators can view their own translation files" ON storage.objects;
DROP POLICY IF EXISTS "Reviewers can view all translation files" ON storage.objects;
DROP POLICY IF EXISTS "Admins have full access to translation-staging" ON storage.objects;

-- Translators can upload translation files
CREATE POLICY "Translators can upload translation files"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'translation-staging' AND
    auth.uid() IN (
      SELECT user_id
      FROM public.user_roles
      WHERE role = 'translator'
    )
  );

-- Translators can read their own translation files
CREATE POLICY "Translators can view their own translation files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'translation-staging' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Reviewers can view all translation files
CREATE POLICY "Reviewers can view all translation files"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'translation-staging' AND
    auth.uid() IN (
      SELECT user_id
      FROM public.user_roles
      WHERE role = 'reviewer'
    )
  );

-- Admins have full access
CREATE POLICY "Admins have full access to translation-staging"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'translation-staging' AND
    auth.uid() IN (
      SELECT user_id
      FROM public.user_roles
      WHERE role = 'admin'
    )
  );

-- ========================================
-- DATASET-EXPORTS POLICIES
-- ========================================

DROP POLICY IF EXISTS "Buyers can view their own dataset exports" ON storage.objects;
DROP POLICY IF EXISTS "Admins have full access to dataset-exports" ON storage.objects;

-- Buyers can read their own dataset exports
CREATE POLICY "Buyers can view their own dataset exports"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'dataset-exports' AND
    (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins have full access
CREATE POLICY "Admins have full access to dataset-exports"
  ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'dataset-exports' AND
    auth.uid() IN (
      SELECT user_id
      FROM public.user_roles
      WHERE role = 'admin'
    )
  );

-- ========================================
-- DONE!
-- ========================================
-- 
-- Your storage buckets now have RLS policies.
-- Try uploading an audio file at /uploader
-- 
-- ========================================
