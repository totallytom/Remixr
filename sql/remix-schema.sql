-- Remix & collaboration schema (run after main schema)
-- Adds: remix parent link, version label, remix open flag, timestamped comments

-- Tracks: remix relationship and versioning
ALTER TABLE tracks
  ADD COLUMN IF NOT EXISTS remix_parent_id UUID REFERENCES tracks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS version_label VARCHAR(50),
  ADD COLUMN IF NOT EXISTS remix_open BOOLEAN DEFAULT true;

CREATE INDEX IF NOT EXISTS idx_tracks_remix_parent_id ON tracks(remix_parent_id);

-- Comments: playback timestamp for timestamp-based comments
ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS timestamp_seconds NUMERIC(10,2);

CREATE INDEX IF NOT EXISTS idx_comments_timestamp_seconds ON comments(track_id, timestamp_seconds)
  WHERE timestamp_seconds IS NOT NULL;

COMMENT ON COLUMN tracks.remix_parent_id IS 'Parent track when this track is a remix/fork';
COMMENT ON COLUMN tracks.version_label IS 'e.g. v1, v2, draft';
COMMENT ON COLUMN tracks.remix_open IS 'Whether others can remix this track';
COMMENT ON COLUMN comments.timestamp_seconds IS 'Playback time in seconds for timestamped comments';
