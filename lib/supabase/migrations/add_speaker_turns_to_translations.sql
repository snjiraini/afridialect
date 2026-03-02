-- Migration: add speaker_turns to translations table
-- The transcriptions table has this column but it was omitted from translations.
-- Run this in Supabase Dashboard → SQL Editor.

ALTER TABLE public.translations
  ADD COLUMN IF NOT EXISTS speaker_turns INTEGER;
