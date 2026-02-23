-- ========================================
-- Seed Data for Afridialect.ai
-- ========================================
-- Initial reference data for dialects and system setup
--
-- Version: 1.0.0
-- Created: February 23, 2026
-- ========================================

-- ========================================
-- 1. DIALECTS
-- ========================================

-- Insert supported dialects
INSERT INTO public.dialects (code, name, country_code, enabled) VALUES
  ('kikuyu', 'Kikuyu', 'KE', true),
  ('swahili', 'Swahili', 'KE', true)
ON CONFLICT (code) DO NOTHING;

-- ========================================
-- 2. MODERATION CATEGORIES
-- ========================================

-- Create a reference table for rejection reasons
CREATE TABLE IF NOT EXISTS public.rejection_reasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category TEXT NOT NULL,
  reason TEXT NOT NULL,
  applies_to TEXT[] NOT NULL, -- ['audio', 'transcript', 'translation']
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category, reason)
);

-- Enable RLS
ALTER TABLE public.rejection_reasons ENABLE ROW LEVEL SECURITY;

-- Anyone can read rejection reasons
CREATE POLICY "Anyone can view rejection reasons"
  ON public.rejection_reasons
  FOR SELECT
  USING (true);

-- Insert rejection reasons for audio QC
INSERT INTO public.rejection_reasons (category, reason, applies_to) VALUES
  ('audio_quality', 'Poor audio quality or excessive noise', ARRAY['audio']),
  ('audio_quality', 'Audio is too quiet or too loud', ARRAY['audio']),
  ('audio_quality', 'Audio contains music or background voices', ARRAY['audio']),
  ('audio_quality', 'Recording is clipped or distorted', ARRAY['audio']),
  ('content', 'Contains hate speech', ARRAY['audio', 'transcript', 'translation']),
  ('content', 'Contains threats or violence', ARRAY['audio', 'transcript', 'translation']),
  ('content', 'Contains explicit sexual content', ARRAY['audio', 'transcript', 'translation']),
  ('content', 'Contains personal identifiable information (PII)', ARRAY['audio', 'transcript', 'translation']),
  ('content', 'Wrong language or dialect', ARRAY['audio', 'transcript']),
  ('transcript', 'Transcription does not match audio', ARRAY['transcript']),
  ('transcript', 'Poor transcription quality', ARRAY['transcript']),
  ('transcript', 'Missing speaker tags', ARRAY['transcript']),
  ('transcript', 'Incorrect speaker count', ARRAY['transcript']),
  ('translation', 'Translation does not match transcript', ARRAY['translation']),
  ('translation', 'Poor translation quality', ARRAY['translation']),
  ('translation', 'Meaning not preserved', ARRAY['translation']),
  ('translation', 'Grammar or spelling errors', ARRAY['translation']),
  ('other', 'Other (see notes)', ARRAY['audio', 'transcript', 'translation'])
ON CONFLICT (category, reason) DO NOTHING;

-- ========================================
-- 3. SYSTEM CONFIGURATION
-- ========================================

-- Create system configuration table
CREATE TABLE IF NOT EXISTS public.system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS (only admins can modify)
ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Anyone can read config
CREATE POLICY "Anyone can view system config"
  ON public.system_config
  FOR SELECT
  USING (true);

-- Insert system configuration
INSERT INTO public.system_config (key, value, description) VALUES
  ('audio_constraints', '{
    "min_duration_seconds": 30,
    "max_duration_seconds": 40,
    "max_file_size_mb": 50,
    "supported_formats": ["mp3", "wav", "m4a", "ogg"]
  }', 'Audio file constraints'),
  
  ('task_timeouts', '{
    "claim_timeout_hours": 24
  }', 'Task claim timeout settings'),
  
  ('pricing', '{
    "audio_sample_usd": 0.50,
    "transcript_sample_usd": 0.50,
    "translation_sample_usd": 0.50,
    "qc_review_payout_usd": 1.00
  }', 'Pricing configuration'),
  
  ('nft_config', '{
    "supply_per_component": 300
  }', 'NFT minting configuration'),
  
  ('dataset_export', '{
    "ttl_hours": 24
  }', 'Dataset export settings'),
  
  ('hedera_config', '{
    "network": "testnet",
    "treasury_accounts": {
      "platform": null,
      "audio": null,
      "transcription": null,
      "translation": null
    }
  }', 'Hedera network configuration')
ON CONFLICT (key) DO UPDATE SET
  value = EXCLUDED.value,
  updated_at = NOW();

-- ========================================
-- 4. STATISTICS VIEW
-- ========================================

-- Create a view for platform statistics
CREATE OR REPLACE VIEW public.platform_stats AS
SELECT
  (SELECT COUNT(*) FROM public.profiles) as total_users,
  (SELECT COUNT(*) FROM public.audio_clips) as total_clips,
  (SELECT COUNT(*) FROM public.audio_clips WHERE status = 'sellable') as sellable_clips,
  (SELECT COUNT(*) FROM public.transcriptions) as total_transcriptions,
  (SELECT COUNT(*) FROM public.translations) as total_translations,
  (SELECT COUNT(*) FROM public.nft_records) as total_nfts_minted,
  (SELECT COUNT(*) FROM public.dataset_purchases WHERE payment_status = 'completed') as total_purchases,
  (SELECT SUM(sample_count) FROM public.dataset_purchases WHERE payment_status = 'completed') as total_samples_sold;

-- Enable RLS for stats view
ALTER VIEW public.platform_stats SET (security_invoker = on);

-- Create policy for stats view (readable by admins)
CREATE OR REPLACE FUNCTION get_platform_stats()
RETURNS SETOF public.platform_stats AS $$
BEGIN
  IF NOT is_admin() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  RETURN QUERY SELECT * FROM public.platform_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 5. CONTRIBUTOR STATISTICS
-- ========================================

-- Create a function for contributor stats (their own stats)
CREATE OR REPLACE FUNCTION get_contributor_stats(contributor_uuid UUID)
RETURNS TABLE(
  uploaded_clips INTEGER,
  transcriptions_completed INTEGER,
  translations_completed INTEGER,
  qc_reviews_completed INTEGER,
  total_nfts_owned INTEGER,
  total_earnings_usd NUMERIC,
  pending_tasks INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM public.audio_clips WHERE uploader_id = contributor_uuid),
    (SELECT COUNT(*)::INTEGER FROM public.transcriptions WHERE transcriber_id = contributor_uuid),
    (SELECT COUNT(*)::INTEGER FROM public.translations WHERE translator_id = contributor_uuid),
    (SELECT COUNT(*)::INTEGER FROM public.qc_reviews WHERE reviewer_id = contributor_uuid),
    (SELECT COUNT(*)::INTEGER FROM public.nft_records WHERE contributor_id = contributor_uuid),
    (SELECT COALESCE(SUM(amount_usd), 0) FROM public.payouts 
     WHERE recipient_id = contributor_uuid AND transaction_status = 'completed'),
    (SELECT COUNT(*)::INTEGER FROM public.tasks 
     WHERE claimed_by = contributor_uuid AND status IN ('claimed', 'submitted'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ========================================
-- 6. AUTO-EXPIRE TASKS FUNCTION
-- ========================================

-- Function to auto-expire tasks that have passed their timeout
CREATE OR REPLACE FUNCTION expire_old_tasks()
RETURNS void AS $$
BEGIN
  UPDATE public.tasks
  SET 
    status = 'available',
    claimed_by = NULL,
    claimed_at = NULL,
    expires_at = NULL
  WHERE 
    status = 'claimed'
    AND expires_at < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: In production, this should be called by a cron job
-- For Supabase, use pg_cron extension:
-- SELECT cron.schedule('expire-old-tasks', '*/15 * * * *', 'SELECT expire_old_tasks()');

-- ========================================
-- 7. TASK AUTO-CREATION TRIGGER
-- ========================================

-- Function to automatically create tasks when audio status changes
CREATE OR REPLACE FUNCTION create_task_on_status_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Create audio QC task when audio is uploaded
  IF NEW.status = 'audio_qc' AND OLD.status = 'uploaded' THEN
    INSERT INTO public.tasks (audio_clip_id, task_type, status)
    VALUES (NEW.id, 'audio_qc', 'available')
    ON CONFLICT (audio_clip_id, task_type) DO NOTHING;
  END IF;

  -- Create transcription task when audio QC passes
  IF NEW.status = 'transcription_ready' AND OLD.status = 'audio_qc' THEN
    INSERT INTO public.tasks (audio_clip_id, task_type, status)
    VALUES (NEW.id, 'transcription', 'available')
    ON CONFLICT (audio_clip_id, task_type) DO NOTHING;
  END IF;

  -- Create transcript QC task when transcription is submitted
  IF NEW.status = 'transcript_qc' AND OLD.status = 'transcription_in_progress' THEN
    INSERT INTO public.tasks (audio_clip_id, task_type, status)
    VALUES (NEW.id, 'transcript_qc', 'available')
    ON CONFLICT (audio_clip_id, task_type) DO NOTHING;
  END IF;

  -- Create translation task when transcript QC passes
  IF NEW.status = 'translation_ready' AND OLD.status = 'transcript_qc' THEN
    INSERT INTO public.tasks (audio_clip_id, task_type, status)
    VALUES (NEW.id, 'translation', 'available')
    ON CONFLICT (audio_clip_id, task_type) DO NOTHING;
  END IF;

  -- Create translation QC task when translation is submitted
  IF NEW.status = 'translation_qc' AND OLD.status = 'translation_in_progress' THEN
    INSERT INTO public.tasks (audio_clip_id, task_type, status)
    VALUES (NEW.id, 'translation_qc', 'available')
    ON CONFLICT (audio_clip_id, task_type) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER audio_clip_status_change_trigger
  AFTER UPDATE OF status ON public.audio_clips
  FOR EACH ROW
  EXECUTE FUNCTION create_task_on_status_change();

-- ========================================
-- 8. PREVENT DUPLICATE TASK CLAIMS
-- ========================================

-- Function to prevent users from claiming multiple tasks for the same audio clip
CREATE OR REPLACE FUNCTION prevent_duplicate_claims()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if user already has a task for this audio clip
  IF EXISTS (
    SELECT 1 FROM public.tasks
    WHERE audio_clip_id = NEW.audio_clip_id
      AND claimed_by = NEW.claimed_by
      AND id != NEW.id
      AND status IN ('claimed', 'submitted')
  ) THEN
    RAISE EXCEPTION 'User already has a task for this audio clip';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER prevent_duplicate_claims_trigger
  BEFORE UPDATE OF claimed_by ON public.tasks
  FOR EACH ROW
  WHEN (NEW.claimed_by IS NOT NULL)
  EXECUTE FUNCTION prevent_duplicate_claims();
