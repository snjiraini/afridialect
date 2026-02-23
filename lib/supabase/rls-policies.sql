-- ========================================
-- Row Level Security (RLS) Policies
-- ========================================
-- These policies enforce access control at the database level
-- ensuring users can only access data they're authorized to see
--
-- Version: 1.0.0
-- Created: February 23, 2026
-- ========================================

-- ========================================
-- 1. PROFILES
-- ========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- Anyone can view public profile info (for collaboration)
CREATE POLICY "Public profiles viewable"
  ON public.profiles
  FOR SELECT
  USING (true);

-- ========================================
-- 2. USER_ROLES
-- ========================================

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Users can view their own roles
CREATE POLICY "Users can view own roles"
  ON public.user_roles
  FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can manage all roles (admin operations use service role)

-- ========================================
-- 3. DIALECTS
-- ========================================

ALTER TABLE public.dialects ENABLE ROW LEVEL SECURITY;

-- Everyone can read enabled dialects
CREATE POLICY "Anyone can view enabled dialects"
  ON public.dialects
  FOR SELECT
  USING (enabled = true);

-- ========================================
-- 4. AUDIO_CLIPS
-- ========================================

ALTER TABLE public.audio_clips ENABLE ROW LEVEL SECURITY;

-- Uploaders can view their own clips
CREATE POLICY "Uploaders can view own clips"
  ON public.audio_clips
  FOR SELECT
  USING (auth.uid() = uploader_id);

-- Uploaders can insert their own clips
CREATE POLICY "Uploaders can insert own clips"
  ON public.audio_clips
  FOR INSERT
  WITH CHECK (auth.uid() = uploader_id);

-- Uploaders can update their own clips (metadata only, not status)
CREATE POLICY "Uploaders can update own clips"
  ON public.audio_clips
  FOR UPDATE
  USING (auth.uid() = uploader_id);

-- Contributors can view clips they're working on
CREATE POLICY "Contributors can view claimed clips"
  ON public.audio_clips
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.audio_clip_id = audio_clips.id
        AND tasks.claimed_by = auth.uid()
        AND tasks.status IN ('claimed', 'submitted')
    )
  );

-- Reviewers can view clips in QC
CREATE POLICY "Reviewers can view clips for QC"
  ON public.audio_clips
  FOR SELECT
  USING (
    status IN ('audio_qc', 'transcript_qc', 'translation_qc')
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'reviewer'
    )
  );

-- Buyers can view sellable clips
CREATE POLICY "Buyers can view sellable clips"
  ON public.audio_clips
  FOR SELECT
  USING (
    status = 'sellable'
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('buyer', 'admin')
    )
  );

-- ========================================
-- 5. TRANSCRIPTIONS
-- ========================================

ALTER TABLE public.transcriptions ENABLE ROW LEVEL SECURITY;

-- Transcribers can view their own transcriptions
CREATE POLICY "Transcribers can view own transcriptions"
  ON public.transcriptions
  FOR SELECT
  USING (auth.uid() = transcriber_id);

-- Transcribers can insert transcriptions for claimed tasks
CREATE POLICY "Transcribers can insert transcriptions"
  ON public.transcriptions
  FOR INSERT
  WITH CHECK (
    auth.uid() = transcriber_id
    AND EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.audio_clip_id = transcriptions.audio_clip_id
        AND tasks.task_type = 'transcription'
        AND tasks.claimed_by = auth.uid()
        AND tasks.status = 'claimed'
    )
  );

-- Transcribers can update their own transcriptions (before submission)
CREATE POLICY "Transcribers can update own transcriptions"
  ON public.transcriptions
  FOR UPDATE
  USING (
    auth.uid() = transcriber_id
    AND EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.audio_clip_id = transcriptions.audio_clip_id
        AND tasks.task_type = 'transcription'
        AND tasks.claimed_by = auth.uid()
        AND tasks.status = 'claimed'
    )
  );

-- Reviewers can view transcriptions for QC
CREATE POLICY "Reviewers can view transcriptions for QC"
  ON public.transcriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.audio_clips
      WHERE audio_clips.id = transcriptions.audio_clip_id
        AND audio_clips.status = 'transcript_qc'
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'reviewer'
    )
  );

-- Translators can view approved transcriptions for their claimed tasks
CREATE POLICY "Translators can view transcriptions for translation"
  ON public.transcriptions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.audio_clip_id = transcriptions.audio_clip_id
        AND tasks.task_type = 'translation'
        AND tasks.claimed_by = auth.uid()
        AND tasks.status IN ('claimed', 'submitted')
    )
  );

-- ========================================
-- 6. TRANSLATIONS
-- ========================================

ALTER TABLE public.translations ENABLE ROW LEVEL SECURITY;

-- Translators can view their own translations
CREATE POLICY "Translators can view own translations"
  ON public.translations
  FOR SELECT
  USING (auth.uid() = translator_id);

-- Translators can insert translations for claimed tasks
CREATE POLICY "Translators can insert translations"
  ON public.translations
  FOR INSERT
  WITH CHECK (
    auth.uid() = translator_id
    AND EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.audio_clip_id = translations.audio_clip_id
        AND tasks.task_type = 'translation'
        AND tasks.claimed_by = auth.uid()
        AND tasks.status = 'claimed'
    )
  );

-- Translators can update their own translations (before submission)
CREATE POLICY "Translators can update own translations"
  ON public.translations
  FOR UPDATE
  USING (
    auth.uid() = translator_id
    AND EXISTS (
      SELECT 1 FROM public.tasks
      WHERE tasks.audio_clip_id = translations.audio_clip_id
        AND tasks.task_type = 'translation'
        AND tasks.claimed_by = auth.uid()
        AND tasks.status = 'claimed'
    )
  );

-- Reviewers can view translations for QC
CREATE POLICY "Reviewers can view translations for QC"
  ON public.translations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.audio_clips
      WHERE audio_clips.id = translations.audio_clip_id
        AND audio_clips.status = 'translation_qc'
    )
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'reviewer'
    )
  );

-- ========================================
-- 7. TASKS
-- ========================================

ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;

-- Users can view available tasks for their roles
CREATE POLICY "Users can view available tasks"
  ON public.tasks
  FOR SELECT
  USING (
    status = 'available'
    AND (
      (task_type = 'transcription' AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
          AND user_roles.role = 'transcriber'
      ))
      OR
      (task_type = 'translation' AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
          AND user_roles.role = 'translator'
      ))
      OR
      (task_type IN ('audio_qc', 'transcript_qc', 'translation_qc') AND EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = auth.uid()
          AND user_roles.role = 'reviewer'
      ))
    )
  );

-- Users can view their own claimed tasks
CREATE POLICY "Users can view own claimed tasks"
  ON public.tasks
  FOR SELECT
  USING (auth.uid() = claimed_by);

-- Users can claim available tasks
CREATE POLICY "Users can claim tasks"
  ON public.tasks
  FOR UPDATE
  USING (
    status = 'available'
    AND claimed_by IS NULL
  )
  WITH CHECK (
    claimed_by = auth.uid()
    AND status = 'claimed'
  );

-- Users can update their own claimed tasks
CREATE POLICY "Users can update own claimed tasks"
  ON public.tasks
  FOR UPDATE
  USING (auth.uid() = claimed_by);

-- ========================================
-- 8. QC_REVIEWS
-- ========================================

ALTER TABLE public.qc_reviews ENABLE ROW LEVEL SECURITY;

-- Reviewers can view their own reviews
CREATE POLICY "Reviewers can view own reviews"
  ON public.qc_reviews
  FOR SELECT
  USING (auth.uid() = reviewer_id);

-- Reviewers can insert reviews
CREATE POLICY "Reviewers can insert reviews"
  ON public.qc_reviews
  FOR INSERT
  WITH CHECK (
    auth.uid() = reviewer_id
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'reviewer'
    )
  );

-- Contributors can view reviews of their work
CREATE POLICY "Contributors can view reviews of their work"
  ON public.qc_reviews
  FOR SELECT
  USING (
    -- Uploader can see audio QC reviews
    (review_type = 'audio_qc' AND EXISTS (
      SELECT 1 FROM public.audio_clips
      WHERE audio_clips.id = qc_reviews.audio_clip_id
        AND audio_clips.uploader_id = auth.uid()
    ))
    OR
    -- Transcriber can see transcript QC reviews
    (review_type = 'transcript_qc' AND EXISTS (
      SELECT 1 FROM public.transcriptions
      WHERE transcriptions.audio_clip_id = qc_reviews.audio_clip_id
        AND transcriptions.transcriber_id = auth.uid()
    ))
    OR
    -- Translator can see translation QC reviews
    (review_type = 'translation_qc' AND EXISTS (
      SELECT 1 FROM public.translations
      WHERE translations.audio_clip_id = qc_reviews.audio_clip_id
        AND translations.translator_id = auth.uid()
    ))
  );

-- ========================================
-- 9. NFT_RECORDS
-- ========================================

ALTER TABLE public.nft_records ENABLE ROW LEVEL SECURITY;

-- Contributors can view their own NFT records
CREATE POLICY "Contributors can view own NFT records"
  ON public.nft_records
  FOR SELECT
  USING (auth.uid() = contributor_id);

-- Anyone can view NFT records for sellable clips (marketplace)
CREATE POLICY "Anyone can view NFT records for sellable clips"
  ON public.nft_records
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.audio_clips
      WHERE audio_clips.id = nft_records.audio_clip_id
        AND audio_clips.status = 'sellable'
    )
  );

-- ========================================
-- 10. NFT_BURNS
-- ========================================

ALTER TABLE public.nft_burns ENABLE ROW LEVEL SECURITY;

-- Contributors can view burns of their NFTs
CREATE POLICY "Contributors can view own NFT burns"
  ON public.nft_burns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.nft_records
      WHERE nft_records.id = nft_burns.nft_record_id
        AND nft_records.contributor_id = auth.uid()
    )
  );

-- Buyers can view burns from their purchases
CREATE POLICY "Buyers can view burns from own purchases"
  ON public.nft_burns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.dataset_purchases
      WHERE dataset_purchases.id = nft_burns.purchase_id
        AND dataset_purchases.buyer_id = auth.uid()
    )
  );

-- ========================================
-- 11. DATASET_PURCHASES
-- ========================================

ALTER TABLE public.dataset_purchases ENABLE ROW LEVEL SECURITY;

-- Buyers can view their own purchases
CREATE POLICY "Buyers can view own purchases"
  ON public.dataset_purchases
  FOR SELECT
  USING (auth.uid() = buyer_id);

-- Buyers can insert purchases
CREATE POLICY "Buyers can insert purchases"
  ON public.dataset_purchases
  FOR INSERT
  WITH CHECK (
    auth.uid() = buyer_id
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('buyer', 'admin')
    )
  );

-- ========================================
-- 12. PAYOUTS
-- ========================================

ALTER TABLE public.payouts ENABLE ROW LEVEL SECURITY;

-- Recipients can view their own payouts
CREATE POLICY "Recipients can view own payouts"
  ON public.payouts
  FOR SELECT
  USING (auth.uid() = recipient_id);

-- ========================================
-- 13. AUDIT_LOGS
-- ========================================

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Users can view their own audit logs
CREATE POLICY "Users can view own audit logs"
  ON public.audit_logs
  FOR SELECT
  USING (auth.uid() = user_id);

-- Anyone can insert audit logs (system-wide)
CREATE POLICY "Anyone can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK (true);

-- Audit logs are immutable (no updates or deletes)

-- ========================================
-- HELPER FUNCTIONS
-- ========================================

-- Function to check if user has a specific role
CREATE OR REPLACE FUNCTION user_has_role(role_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid()
      AND role = role_name
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN user_has_role('admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
