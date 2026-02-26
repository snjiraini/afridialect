-- ========================================
-- Supabase Storage Bucket Configuration
-- ========================================
-- Execute this in Supabase SQL Editor
--
-- Creates storage buckets and RLS policies
-- for secure audio file management
-- ========================================

-- ========================================
-- 1. CREATE STORAGE BUCKETS
-- ========================================

-- Insert buckets (if not exist)
-- Note: Run these manually in Supabase Dashboard > Storage
-- Or use the Supabase CLI

-- audio-staging: Private bucket for uploaded audio files
-- Accessed by: uploaders (their files), reviewers, admins
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'audio-staging',
  'audio-staging',
  false,
  52428800, -- 50MB in bytes
  ARRAY[
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/mp4',
    'audio/x-m4a',
    'audio/ogg',
    'audio/webm'
  ]::text[]
)
ON CONFLICT (id) DO NOTHING;

-- transcript-staging: Private bucket for transcript files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'transcript-staging',
  'transcript-staging',
  false,
  5242880, -- 5MB in bytes
  ARRAY['text/plain', 'application/json']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- translation-staging: Private bucket for translation files
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'translation-staging',
  'translation-staging',
  false,
  5242880, -- 5MB in bytes
  ARRAY['text/plain', 'application/json']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- dataset-exports: Private bucket for buyer downloads
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'dataset-exports',
  'dataset-exports',
  false,
  1073741824, -- 1GB in bytes
  ARRAY['application/zip', 'application/x-tar', 'application/gzip']::text[]
)
ON CONFLICT (id) DO NOTHING;

-- ========================================
-- 2. STORAGE RLS POLICIES
-- ========================================

-- Enable RLS on storage.objects
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- ========================================
-- AUDIO-STAGING POLICIES
-- ========================================

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
-- NOTES
-- ========================================
-- 
-- File naming convention:
-- audio-staging: {user_id}/{clip_id}.{ext}
-- transcript-staging: {user_id}/{clip_id}.txt
-- translation-staging: {user_id}/{clip_id}.txt
-- dataset-exports: {user_id}/{purchase_id}.zip
--
-- Storage folder names use array indexing:
-- (storage.foldername(name))[1] = first folder
-- (storage.foldername(name))[2] = second folder
--
-- ========================================
