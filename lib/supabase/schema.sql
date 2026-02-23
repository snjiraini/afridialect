-- ========================================
-- Afridialect.ai Database Schema
-- ========================================
-- This schema defines all tables, relationships, and security policies
-- for the Afridialect.ai platform
--
-- Version: 1.0.0
-- Created: February 23, 2026
-- ========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========================================
-- 1. USERS & ROLES
-- ========================================

-- User profiles (extends Supabase auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  hedera_account_id TEXT UNIQUE,
  kms_key_id TEXT, -- AWS KMS key for signing
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- User roles (many-to-many)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('uploader', 'transcriber', 'translator', 'reviewer', 'buyer', 'admin')),
  granted_at TIMESTAMPTZ DEFAULT NOW(),
  granted_by UUID REFERENCES public.profiles(id),
  UNIQUE(user_id, role)
);

-- ========================================
-- 2. DIALECTS & REFERENCE DATA
-- ========================================

-- Supported dialects
CREATE TABLE public.dialects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  code TEXT UNIQUE NOT NULL, -- e.g., 'kikuyu', 'swahili'
  name TEXT NOT NULL, -- e.g., 'Kikuyu', 'Swahili'
  country_code TEXT NOT NULL, -- ISO 3166-1 alpha-2 (e.g., 'KE')
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========================================
-- 3. AUDIO CLIPS & LIFECYCLE
-- ========================================

-- Main audio clips table
CREATE TABLE public.audio_clips (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  dialect_id UUID NOT NULL REFERENCES public.dialects(id),
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'uploaded' CHECK (
    status IN (
      'uploaded',
      'audio_qc',
      'audio_rejected',
      'transcription_ready',
      'transcription_in_progress',
      'transcript_qc',
      'transcript_rejected',
      'translation_ready',
      'translation_in_progress',
      'translation_qc',
      'translation_rejected',
      'mint_ready',
      'ipfs_pinned',
      'minted',
      'sellable'
    )
  ),
  
  -- Audio metadata
  audio_url TEXT, -- Supabase Storage URL (staging)
  audio_cid TEXT, -- IPFS CID (after pinning)
  duration_seconds NUMERIC(10, 2) NOT NULL,
  sample_rate INTEGER,
  file_size_bytes INTEGER,
  
  -- Speaker information
  speaker_count INTEGER,
  speaker_gender TEXT CHECK (speaker_gender IN ('male', 'female', 'mixed', 'unknown')),
  speaker_age_range TEXT CHECK (speaker_age_range IN ('child', 'teen', 'adult', 'senior', 'mixed')),
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  tags TEXT[] DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  rejected_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ
);

-- Create indexes for performance
CREATE INDEX idx_audio_clips_uploader ON public.audio_clips(uploader_id);
CREATE INDEX idx_audio_clips_dialect ON public.audio_clips(dialect_id);
CREATE INDEX idx_audio_clips_status ON public.audio_clips(status);
CREATE INDEX idx_audio_clips_created_at ON public.audio_clips(created_at DESC);

-- ========================================
-- 4. TRANSCRIPTIONS
-- ========================================

CREATE TABLE public.transcriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audio_clip_id UUID NOT NULL REFERENCES public.audio_clips(id) ON DELETE CASCADE,
  transcriber_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Transcription content
  content TEXT NOT NULL,
  
  -- Metadata
  speaker_count INTEGER,
  speaker_turns INTEGER,
  tags TEXT[] DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  
  -- Storage
  transcript_url TEXT, -- Supabase Storage URL (staging)
  transcript_cid TEXT, -- IPFS CID (after pinning)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: one transcription per clip
  UNIQUE(audio_clip_id)
);

CREATE INDEX idx_transcriptions_audio_clip ON public.transcriptions(audio_clip_id);
CREATE INDEX idx_transcriptions_transcriber ON public.transcriptions(transcriber_id);

-- ========================================
-- 5. TRANSLATIONS
-- ========================================

CREATE TABLE public.translations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audio_clip_id UUID NOT NULL REFERENCES public.audio_clips(id) ON DELETE CASCADE,
  translator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Translation content (English)
  content TEXT NOT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Storage
  translation_url TEXT, -- Supabase Storage URL (staging)
  translation_cid TEXT, -- IPFS CID (after pinning)
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: one translation per clip
  UNIQUE(audio_clip_id)
);

CREATE INDEX idx_translations_audio_clip ON public.translations(audio_clip_id);
CREATE INDEX idx_translations_translator ON public.translations(translator_id);

-- ========================================
-- 6. TASKS & CLAIMS
-- ========================================

CREATE TABLE public.tasks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audio_clip_id UUID NOT NULL REFERENCES public.audio_clips(id) ON DELETE CASCADE,
  
  -- Task details
  task_type TEXT NOT NULL CHECK (
    task_type IN ('audio_qc', 'transcription', 'transcript_qc', 'translation', 'translation_qc')
  ),
  status TEXT NOT NULL DEFAULT 'available' CHECK (
    status IN ('available', 'claimed', 'submitted', 'approved', 'rejected')
  ),
  
  -- Claim information
  claimed_by UUID REFERENCES public.profiles(id),
  claimed_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  submitted_at TIMESTAMPTZ,
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: prevent multiple tasks of same type for same clip
  UNIQUE(audio_clip_id, task_type)
);

CREATE INDEX idx_tasks_audio_clip ON public.tasks(audio_clip_id);
CREATE INDEX idx_tasks_status ON public.tasks(status);
CREATE INDEX idx_tasks_claimed_by ON public.tasks(claimed_by);
CREATE INDEX idx_tasks_expires_at ON public.tasks(expires_at);

-- ========================================
-- 7. QC REVIEWS
-- ========================================

CREATE TABLE public.qc_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audio_clip_id UUID NOT NULL REFERENCES public.audio_clips(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Review details
  review_type TEXT NOT NULL CHECK (
    review_type IN ('audio_qc', 'transcript_qc', 'translation_qc')
  ),
  decision TEXT NOT NULL CHECK (decision IN ('approve', 'reject')),
  
  -- Rejection reasons (if applicable)
  reasons TEXT[] DEFAULT '{}',
  notes TEXT,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_qc_reviews_audio_clip ON public.qc_reviews(audio_clip_id);
CREATE INDEX idx_qc_reviews_reviewer ON public.qc_reviews(reviewer_id);
CREATE INDEX idx_qc_reviews_type ON public.qc_reviews(review_type);

-- ========================================
-- 8. NFT RECORDS
-- ========================================

CREATE TABLE public.nft_records (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  audio_clip_id UUID NOT NULL REFERENCES public.audio_clips(id) ON DELETE CASCADE,
  
  -- NFT details
  nft_type TEXT NOT NULL CHECK (nft_type IN ('audio', 'transcript', 'translation')),
  token_id TEXT NOT NULL, -- Hedera token ID
  serial_numbers INTEGER[] NOT NULL, -- Array of 300 serial numbers
  
  -- Contributor who receives the NFTs
  contributor_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- IPFS reference
  ipfs_cid TEXT NOT NULL,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  
  -- Timestamps
  minted_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Constraint: one NFT record per type per clip
  UNIQUE(audio_clip_id, nft_type)
);

CREATE INDEX idx_nft_records_audio_clip ON public.nft_records(audio_clip_id);
CREATE INDEX idx_nft_records_contributor ON public.nft_records(contributor_id);
CREATE INDEX idx_nft_records_token ON public.nft_records(token_id);

-- ========================================
-- 9. NFT BURNS (for dataset purchases)
-- ========================================

CREATE TABLE public.nft_burns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nft_record_id UUID NOT NULL REFERENCES public.nft_records(id) ON DELETE CASCADE,
  serial_number INTEGER NOT NULL,
  purchase_id UUID NOT NULL, -- References dataset_purchases
  burned_at TIMESTAMPTZ DEFAULT NOW(),
  transaction_id TEXT, -- Hedera transaction ID
  
  UNIQUE(nft_record_id, serial_number)
);

CREATE INDEX idx_nft_burns_purchase ON public.nft_burns(purchase_id);
CREATE INDEX idx_nft_burns_burned_at ON public.nft_burns(burned_at DESC);

-- ========================================
-- 10. DATASET PURCHASES
-- ========================================

CREATE TABLE public.dataset_purchases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  buyer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Purchase details
  sample_count INTEGER NOT NULL,
  price_usd NUMERIC(10, 2) NOT NULL,
  price_hbar NUMERIC(20, 8) NOT NULL,
  
  -- Filters used
  filters JSONB NOT NULL,
  
  -- Audio clips included (array of UUIDs)
  audio_clip_ids UUID[] NOT NULL,
  
  -- Export information
  export_url TEXT, -- Signed URL to download
  export_cid TEXT, -- IPFS CID of the export
  export_expires_at TIMESTAMPTZ,
  
  -- Payment
  payment_transaction_id TEXT, -- Hedera transaction ID
  payment_status TEXT DEFAULT 'pending' CHECK (
    payment_status IN ('pending', 'completed', 'failed', 'refunded')
  ),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  downloaded_at TIMESTAMPTZ
);

CREATE INDEX idx_dataset_purchases_buyer ON public.dataset_purchases(buyer_id);
CREATE INDEX idx_dataset_purchases_status ON public.dataset_purchases(payment_status);
CREATE INDEX idx_dataset_purchases_created_at ON public.dataset_purchases(created_at DESC);

-- ========================================
-- 11. PAYOUTS
-- ========================================

CREATE TABLE public.payouts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  purchase_id UUID NOT NULL REFERENCES public.dataset_purchases(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  
  -- Payout details
  payout_type TEXT NOT NULL CHECK (
    payout_type IN ('audio', 'transcription', 'translation', 'qc_review')
  ),
  amount_usd NUMERIC(10, 2) NOT NULL,
  amount_hbar NUMERIC(20, 8) NOT NULL,
  
  -- NFT reference (for audio/transcript/translation payouts)
  nft_record_id UUID REFERENCES public.nft_records(id),
  burned_serial_number INTEGER,
  
  -- Transaction details
  transaction_id TEXT, -- Hedera transaction ID
  transaction_status TEXT DEFAULT 'pending' CHECK (
    transaction_status IN ('pending', 'completed', 'failed')
  ),
  
  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX idx_payouts_purchase ON public.payouts(purchase_id);
CREATE INDEX idx_payouts_recipient ON public.payouts(recipient_id);
CREATE INDEX idx_payouts_status ON public.payouts(transaction_status);
CREATE INDEX idx_payouts_created_at ON public.payouts(created_at DESC);

-- ========================================
-- 12. AUDIT LOGS
-- ========================================

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  
  -- Actor
  user_id UUID REFERENCES public.profiles(id),
  
  -- Action details
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  
  -- Details
  details JSONB DEFAULT '{}',
  
  -- Context
  ip_address INET,
  user_agent TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);

-- ========================================
-- 13. UPDATED_AT TRIGGER
-- ========================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to relevant tables
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_audio_clips_updated_at
  BEFORE UPDATE ON public.audio_clips
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_transcriptions_updated_at
  BEFORE UPDATE ON public.transcriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_translations_updated_at
  BEFORE UPDATE ON public.translations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
