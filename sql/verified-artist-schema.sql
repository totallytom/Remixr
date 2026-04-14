-- Verified artist: when true, user skips metadata/hash and ACRCloud copyright checks (Option 1).
-- Admins turn this on in the dashboard; no SQL needed day to day.
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query → paste → Run).
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified_artist BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN users.is_verified_artist IS 'When true, this user is a verified rights holder; copyright checks are skipped for their uploads.';
