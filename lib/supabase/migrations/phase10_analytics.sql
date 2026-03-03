-- =====================================================================
-- Phase 10: Admin Panel & Analytics — DB Migration
-- Run this in the Supabase Dashboard SQL Editor
-- =====================================================================

-- 1. Ensure system_config table exists with hbar_price_usd column
CREATE TABLE IF NOT EXISTS system_config (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed default HBAR price if not already present
INSERT INTO system_config (key, value)
VALUES ('hbar_price_usd', '0.08')
ON CONFLICT (key) DO NOTHING;

-- 2. Index for analytics queries on audio_clips
-- NOTE: audio_clips uses dialect_id (UUID FK), not a dialect text column
CREATE INDEX IF NOT EXISTS idx_audio_clips_status
  ON audio_clips (status);

CREATE INDEX IF NOT EXISTS idx_audio_clips_created_at
  ON audio_clips (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audio_clips_dialect_id_status
  ON audio_clips (dialect_id, status);

-- 3. Index for qc_reviews analytics
CREATE INDEX IF NOT EXISTS idx_qc_reviews_created_at
  ON qc_reviews (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_qc_reviews_review_type_decision
  ON qc_reviews (review_type, decision);

-- 4. Index for purchases analytics
CREATE INDEX IF NOT EXISTS idx_dataset_purchases_created_at_p10
  ON dataset_purchases (created_at DESC);

-- 5. Index for payout analytics
CREATE INDEX IF NOT EXISTS idx_payouts_created_at_p10
  ON payouts (created_at DESC);

-- 6. RLS for system_config — admins only
ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access system_config" ON system_config;
CREATE POLICY "Admin full access system_config"
  ON system_config
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 7. tasks table — index for admin override queries
CREATE INDEX IF NOT EXISTS idx_tasks_status_type
  ON tasks (status, task_type);

CREATE INDEX IF NOT EXISTS idx_tasks_expires_at
  ON tasks (expires_at)
  WHERE expires_at IS NOT NULL;
