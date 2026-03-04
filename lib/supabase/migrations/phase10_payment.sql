-- ============================================================
-- Phase 10: Hedera Contributor Payments — Database additions
-- ============================================================
-- Adds on-chain payment tracking to purchases and payouts.
-- Also extends payouts to cover the audio QC reviewer ($1.00).
-- Safe to run on top of existing Phase 9 schema.
--
-- Run in: Supabase Dashboard → SQL Editor
-- ============================================================

-- 1. Ensure dataset_purchases.payment_transaction_id exists
--    (may already exist from base schema; IF NOT EXISTS guards are safe).
ALTER TABLE public.dataset_purchases
  ADD COLUMN IF NOT EXISTS payment_transaction_id TEXT;

-- 2. Add hashscan URL for quick audit access
ALTER TABLE public.dataset_purchases
  ADD COLUMN IF NOT EXISTS hashscan_url TEXT;

-- 3. Ensure payouts.transaction_id and payouts.processed_at exist
ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS transaction_id TEXT;

ALTER TABLE public.payouts
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ;

-- 4. Widen the payout_type CHECK constraint to allow all QC types.
--    The original constraint only listed 'qc_review' as a single bucket.
--    Audio QC reviewer payouts use payout_type = 'qc_review' (same as
--    transcript/translation QC) so no schema change is needed here for
--    the type value — the discriminator is the purchase's clip context.
--    This comment documents the intentional re-use of 'qc_review'.

-- 5. Index: quickly find all payouts for a given Hedera transaction
CREATE INDEX IF NOT EXISTS idx_payouts_transaction_id
  ON public.payouts(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- 6. Index: purchases by payment_transaction_id for audit queries
CREATE INDEX IF NOT EXISTS idx_dataset_purchases_payment_tx
  ON public.dataset_purchases(payment_transaction_id)
  WHERE payment_transaction_id IS NOT NULL;
