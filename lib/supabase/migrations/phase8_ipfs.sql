-- ============================================================
-- Phase 8: IPFS & Pinata Integration — Database additions
-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor
-- Safe to run on top of the existing Phase 7 schema.
-- ============================================================

-- 1. Track whether a clip's staging file has been cleaned up after minting.
ALTER TABLE public.audio_clips
  ADD COLUMN IF NOT EXISTS staging_cleaned_up BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for admin cleanup queue queries
CREATE INDEX IF NOT EXISTS idx_audio_clips_minted_not_cleaned
  ON public.audio_clips(status, staging_cleaned_up)
  WHERE status = 'minted' AND staging_cleaned_up = FALSE;

-- 2. IPFS pin log table — tracks every CID pinned through Afridialect,
--    its verification status, and optional unpin events.
CREATE TABLE IF NOT EXISTS public.ipfs_pin_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audio_clip_id   UUID NOT NULL REFERENCES public.audio_clips(id) ON DELETE CASCADE,
  nft_type        TEXT NOT NULL CHECK (nft_type IN ('audio', 'transcript', 'translation', 'metadata_audio', 'metadata_transcript', 'metadata_translation')),
  cid             TEXT NOT NULL,
  pin_size_bytes  BIGINT,
  pinned_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ,
  verified_pinned BOOLEAN,
  unpinned_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Unique: one log row per clip + type
CREATE UNIQUE INDEX IF NOT EXISTS idx_ipfs_pin_log_clip_type
  ON public.ipfs_pin_log(audio_clip_id, nft_type);

-- Fast CID lookups
CREATE INDEX IF NOT EXISTS idx_ipfs_pin_log_cid
  ON public.ipfs_pin_log(cid);

-- 3. RLS for ipfs_pin_log
ALTER TABLE public.ipfs_pin_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can do anything on ipfs_pin_log" ON public.ipfs_pin_log;
DROP POLICY IF EXISTS "Contributors can read their own ipfs_pin_log" ON public.ipfs_pin_log;

-- Admins have full access
CREATE POLICY "Admins can do anything on ipfs_pin_log"
  ON public.ipfs_pin_log
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Contributors can see log rows for clips they uploaded
CREATE POLICY "Contributors can read their own ipfs_pin_log"
  ON public.ipfs_pin_log
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.audio_clips ac
      WHERE ac.id = ipfs_pin_log.audio_clip_id
        AND ac.uploader_id = auth.uid()
    )
  );
