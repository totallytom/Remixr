-- Preview snippet for Discover/SwipeStack (e.g. 20-second clip)
-- Run in Supabase SQL Editor if you use snippet editing on Upload.

ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS preview_start_sec NUMERIC(10,3) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS preview_duration_sec NUMERIC(10,3) DEFAULT 20;

COMMENT ON COLUMN tracks.preview_start_sec IS 'Start time in seconds for the Discover preview snippet (0 = start of track)';
COMMENT ON COLUMN tracks.preview_duration_sec IS 'Length in seconds of the Discover preview snippet (e.g. 20)';
