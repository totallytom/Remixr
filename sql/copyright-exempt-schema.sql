-- Copyright exemption for verified rights holders (e.g. artists who own their music on Spotify).
-- When true, metadata/hash and ACRCloud checks are skipped for this user's uploads.
ALTER TABLE users ADD COLUMN IF NOT EXISTS copyright_exempt BOOLEAN DEFAULT FALSE;
COMMENT ON COLUMN users.copyright_exempt IS 'If true, user is a verified rights holder; copyright checks are skipped for their uploads.';
