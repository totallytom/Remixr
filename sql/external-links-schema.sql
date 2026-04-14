-- Profile links to other sites (e.g. Twitter, Instagram, Bandcamp). Max 6 links per user.
-- Run in Supabase SQL Editor.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS external_links TEXT[] DEFAULT '{}';

COMMENT ON COLUMN users.external_links IS 'URLs to other sites (max 6), e.g. social or music links';
