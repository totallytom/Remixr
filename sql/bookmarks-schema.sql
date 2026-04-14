-- Bookmarks Schema for saving tracks
-- This schema supports users bookmarking tracks
-- 
-- IMPORTANT: Run this SQL file in your Supabase SQL Editor to create the bookmarks table
-- Go to: Supabase Dashboard > SQL Editor > New Query > Paste this file > Run

-- Enable necessary extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing table if it exists (CASCADE will also drop policies and dependencies)
DROP TABLE IF EXISTS bookmarks CASCADE;

-- Create bookmarks table
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure one bookmark per user per track
  UNIQUE(user_id, track_id)
);

-- Create indexes for better performance
CREATE INDEX idx_bookmarks_user_id ON bookmarks(user_id);
CREATE INDEX idx_bookmarks_track_id ON bookmarks(track_id);
CREATE INDEX idx_bookmarks_created_at ON bookmarks(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;

-- RLS Policies for bookmarks
-- Users can view their own bookmarks
CREATE POLICY "Users can view their own bookmarks" ON bookmarks
  FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own bookmarks
CREATE POLICY "Users can create their own bookmarks" ON bookmarks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can delete their own bookmarks
CREATE POLICY "Users can delete their own bookmarks" ON bookmarks
  FOR DELETE USING (auth.uid() = user_id);

-- Function to check if a track is bookmarked by a user
CREATE OR REPLACE FUNCTION is_track_bookmarked(track_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM bookmarks
    WHERE track_id = track_uuid AND user_id = user_uuid
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
