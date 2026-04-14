-- Migration: Add likes and liked_by columns to tracks table
-- This migration adds the ability to like tracks, similar to posts and comments

-- Add likes column to tracks table
ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS likes INTEGER DEFAULT 0;

-- Add liked_by column to tracks table (array of user IDs who liked the track)
ALTER TABLE tracks 
ADD COLUMN IF NOT EXISTS liked_by UUID[] DEFAULT '{}';

-- Create index on liked_by for better query performance
CREATE INDEX IF NOT EXISTS idx_tracks_liked_by ON tracks USING GIN(liked_by);

-- Add comment
COMMENT ON COLUMN tracks.likes IS 'Number of likes the track has received';
COMMENT ON COLUMN tracks.liked_by IS 'Array of user IDs who have liked this track';
