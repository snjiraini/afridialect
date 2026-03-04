-- ============================================================
-- Phase 11: Admin-Configurable Payout Structure
-- ============================================================
-- Adds a payout_structure table so admins can set contributor
-- and platform payout amounts without code changes.
-- Removes the hardcoded USD values from the payment logic.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Create the payout_structure table
CREATE TABLE IF NOT EXISTS public.payout_structure (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  role        TEXT NOT NULL UNIQUE CHECK (
    role IN (
      'audio_uploader',
      'audio_qc_reviewer',
      'transcriber',
      'translator',
      'transcript_qc_reviewer',
      'translation_qc_reviewer',
      'platform_markup'
    )
  ),
  amount_usd  NUMERIC(10, 4) NOT NULL DEFAULT 0,
  description TEXT,
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_by  UUID REFERENCES public.profiles(id)
);

-- 2. Seed default values matching PRD §6.6.3 ($6.00 per sample total)
INSERT INTO public.payout_structure (role, amount_usd, description) VALUES
  ('audio_uploader',           0.50, 'Audio recording contributor'),
  ('audio_qc_reviewer',        1.00, 'Audio quality control reviewer'),
  ('transcriber',              1.00, 'Transcription contributor'),
  ('translator',               1.00, 'English translation contributor'),
  ('transcript_qc_reviewer',   1.00, 'Transcript quality control reviewer'),
  ('translation_qc_reviewer',  1.00, 'Translation quality control reviewer'),
  ('platform_markup',          0.50, 'Platform fee retained by Afridialect')
ON CONFLICT (role) DO NOTHING;

-- 3. RLS — only admins can read/write
ALTER TABLE public.payout_structure ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access payout_structure" ON public.payout_structure;
CREATE POLICY "Admin full access payout_structure"
  ON public.payout_structure
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 4. Trigger to update updated_at on payout_structure changes
CREATE OR REPLACE FUNCTION update_payout_structure_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_payout_structure_updated_at ON public.payout_structure;
CREATE TRIGGER trg_payout_structure_updated_at
  BEFORE UPDATE ON public.payout_structure
  FOR EACH ROW EXECUTE FUNCTION update_payout_structure_updated_at();

-- 5. Add download_count column to dataset_purchases for tracking
ALTER TABLE public.dataset_purchases
  ADD COLUMN IF NOT EXISTS download_count INTEGER DEFAULT 0;

-- 6. Mark download_deleted to track auto-cleanup of the training package
ALTER TABLE public.dataset_purchases
  ADD COLUMN IF NOT EXISTS package_deleted_at TIMESTAMPTZ;

-- 7. Staging cleanup tracking — mark when staging files are removed after minting
ALTER TABLE public.audio_clips
  ADD COLUMN IF NOT EXISTS staging_cleaned_at TIMESTAMPTZ;

ALTER TABLE public.transcriptions
  ADD COLUMN IF NOT EXISTS staging_cleaned_at TIMESTAMPTZ;

ALTER TABLE public.translations
  ADD COLUMN IF NOT EXISTS staging_cleaned_at TIMESTAMPTZ;

-- 8. Add ipfs_pin_logs table if not exists (for download IPFS tracking)
CREATE TABLE IF NOT EXISTS public.ipfs_pin_logs (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audio_clip_id    UUID NOT NULL REFERENCES public.audio_clips(id) ON DELETE CASCADE,
  nft_type         TEXT NOT NULL CHECK (nft_type IN ('audio','transcript','translation','metadata_audio','metadata_transcript','metadata_translation')),
  cid              TEXT NOT NULL,
  pin_size_bytes   INTEGER,
  pinned_at        TIMESTAMPTZ DEFAULT NOW(),
  last_verified_at TIMESTAMPTZ,
  verified_pinned  BOOLEAN,
  unpinned_at      TIMESTAMPTZ,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(audio_clip_id, nft_type)
);

CREATE INDEX IF NOT EXISTS idx_ipfs_pin_logs_clip ON public.ipfs_pin_logs(audio_clip_id);
CREATE INDEX IF NOT EXISTS idx_ipfs_pin_logs_cid  ON public.ipfs_pin_logs(cid);

ALTER TABLE public.ipfs_pin_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Admin full access ipfs_pin_logs" ON public.ipfs_pin_logs;
CREATE POLICY "Admin full access ipfs_pin_logs"
  ON public.ipfs_pin_logs FOR ALL
  USING (EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'));
