-- ============================================================
-- Phase 7: NFT Minting — Database additions
-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor
-- This migration is safe to run on top of the existing schema.
-- ============================================================

-- 1. Add audio_cid column to audio_clips if it doesn't exist.
--    (schema.sql already defines it; this guards against partial runs)
ALTER TABLE public.audio_clips
  ADD COLUMN IF NOT EXISTS audio_cid TEXT;

-- 2. Ensure nft_records.serial_numbers is an integer array.
--    The original schema.sql defines this correctly; this is a no-op guard.
-- (no change needed)

-- 3. Add an index on nft_records.audio_clip_id + nft_type for fast lookups
--    during marketplace/burn operations.
CREATE INDEX IF NOT EXISTS idx_nft_records_clip_type
  ON public.nft_records(audio_clip_id, nft_type);

-- 4. Add RLS policies for nft_records so authenticated users can read
--    records for clips they contributed to.

-- Enable RLS (idempotent)
ALTER TABLE public.nft_records ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist (safe re-run)
DROP POLICY IF EXISTS "Admins can do anything on nft_records" ON public.nft_records;
DROP POLICY IF EXISTS "Contributors can read their own nft_records" ON public.nft_records;

-- Admins can read/write all NFT records
CREATE POLICY "Admins can do anything on nft_records"
  ON public.nft_records
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Contributors can read NFT records for clips they contributed to
CREATE POLICY "Contributors can read their own nft_records"
  ON public.nft_records
  FOR SELECT
  USING (
    contributor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.audio_clips ac
      WHERE ac.id = nft_records.audio_clip_id
        AND ac.uploader_id = auth.uid()
    )
  );

-- 5. RLS for nft_burns
ALTER TABLE public.nft_burns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can do anything on nft_burns" ON public.nft_burns;

CREATE POLICY "Admins can do anything on nft_burns"
  ON public.nft_burns
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
