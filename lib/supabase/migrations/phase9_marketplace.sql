-- ============================================================
-- Phase 9: Marketplace & Dataset Builder — Database additions
-- ============================================================
-- Run this in Supabase Dashboard → SQL Editor
-- Safe to run on top of the existing Phase 8 schema.
-- ============================================================

-- 1. Add hbar_rate snapshot to dataset_purchases so we record the
--    exact rate used at checkout time (USD→HBAR).
ALTER TABLE public.dataset_purchases
  ADD COLUMN IF NOT EXISTS hbar_rate NUMERIC(20, 8);

-- 2. Add dialect_ids array to dataset_purchases for fast filter replay.
ALTER TABLE public.dataset_purchases
  ADD COLUMN IF NOT EXISTS dialect_ids UUID[];

-- 3. Index to power the marketplace browse query:
--    clips must be 'minted' or 'sellable' to appear in the catalogue.
CREATE INDEX IF NOT EXISTS idx_audio_clips_sellable
  ON public.audio_clips(status, dialect_id, duration_seconds)
  WHERE status IN ('minted', 'sellable');

-- 4. RLS for dataset_purchases
ALTER TABLE public.dataset_purchases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Buyers can read their own purchases" ON public.dataset_purchases;
DROP POLICY IF EXISTS "Buyers can insert their own purchases" ON public.dataset_purchases;
DROP POLICY IF EXISTS "Admins can do anything on dataset_purchases" ON public.dataset_purchases;

-- Buyers see only their own purchases
CREATE POLICY "Buyers can read their own purchases"
  ON public.dataset_purchases
  FOR SELECT
  USING (buyer_id = auth.uid());

-- Buyers can create purchases (INSERT)
CREATE POLICY "Buyers can insert their own purchases"
  ON public.dataset_purchases
  FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

-- Buyers can update their own purchases (e.g. mark downloaded)
CREATE POLICY "Buyers can update their own purchases"
  ON public.dataset_purchases
  FOR UPDATE
  USING (buyer_id = auth.uid());

-- Admins full access
CREATE POLICY "Admins can do anything on dataset_purchases"
  ON public.dataset_purchases
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 5. RLS for payouts
ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Recipients can read their own payouts" ON public.payouts;
DROP POLICY IF EXISTS "Admins can do anything on payouts" ON public.payouts;

CREATE POLICY "Recipients can read their own payouts"
  ON public.payouts
  FOR SELECT
  USING (recipient_id = auth.uid());

CREATE POLICY "Admins can do anything on payouts"
  ON public.payouts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );
