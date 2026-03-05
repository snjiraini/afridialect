-- ============================================================
-- Phase 10: Dataset Download Tracking
-- ============================================================
-- Adds download_count and package_deleted_at columns that the
-- GET /api/marketplace/download/[id] endpoint requires.
--
-- Run in Supabase Dashboard → SQL Editor (safe to run twice).
-- ============================================================

-- Track how many times each purchase has been downloaded
ALTER TABLE public.dataset_purchases
  ADD COLUMN IF NOT EXISTS download_count INTEGER NOT NULL DEFAULT 0;

-- Timestamp set when the staging package is auto-deleted after first download
ALTER TABLE public.dataset_purchases
  ADD COLUMN IF NOT EXISTS package_deleted_at TIMESTAMPTZ;
