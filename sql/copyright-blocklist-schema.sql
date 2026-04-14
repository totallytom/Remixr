-- Optional: copyright blocklist table for storing blocked file hashes and metadata.
-- Used by the copyright automation system. Populate via admin or when ACRCloud identifies a match.
-- The API can be extended to read from this table (via COPYRIGHT_BLOCKED_HASHES or direct Supabase query).

CREATE TABLE IF NOT EXISTS copyright_blocklist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_hash VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(255),
  artist VARCHAR(255),
  source VARCHAR(50) DEFAULT 'manual',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_copyright_blocklist_hash ON copyright_blocklist(file_hash);

COMMENT ON TABLE copyright_blocklist IS 'Blocked content hashes (SHA-256) and metadata for copyright automation.';
