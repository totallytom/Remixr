-- Playlist Invitations Schema
-- This schema supports users inviting others to collaborate on playlists
-- 
-- IMPORTANT: Run this SQL file in your Supabase SQL Editor to create the playlist_invitations table
-- Go to: Supabase Dashboard > SQL Editor > New Query > Paste this file > Run

-- Enable necessary extensions (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing table if it exists (CASCADE will also drop policies and dependencies)
DROP TABLE IF EXISTS playlist_invitations CASCADE;

-- Create playlist_invitations table
CREATE TABLE playlist_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  inviter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status VARCHAR(20) CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure one invitation per playlist per invitee
  UNIQUE(playlist_id, invitee_id)
);

-- Create indexes for better performance
CREATE INDEX idx_playlist_invitations_playlist_id ON playlist_invitations(playlist_id);
CREATE INDEX idx_playlist_invitations_inviter_id ON playlist_invitations(inviter_id);
CREATE INDEX idx_playlist_invitations_invitee_id ON playlist_invitations(invitee_id);
CREATE INDEX idx_playlist_invitations_status ON playlist_invitations(status);
CREATE INDEX idx_playlist_invitations_created_at ON playlist_invitations(created_at DESC);

-- Enable Row Level Security (RLS)
ALTER TABLE playlist_invitations ENABLE ROW LEVEL SECURITY;

-- RLS Policies for playlist_invitations
-- Users can view invitations they sent or received
CREATE POLICY "Users can view their own invitations" ON playlist_invitations
  FOR SELECT USING (auth.uid() = inviter_id OR auth.uid() = invitee_id);

-- Users can create invitations for playlists they own
CREATE POLICY "Playlist owners can create invitations" ON playlist_invitations
  FOR INSERT WITH CHECK (
    auth.uid() = inviter_id AND
    EXISTS (
      SELECT 1 FROM playlists 
      WHERE playlists.id = playlist_invitations.playlist_id 
      AND playlists.created_by = auth.uid()
    )
  );

-- Invitees can update their own invitations (accept/decline)
CREATE POLICY "Invitees can update their invitations" ON playlist_invitations
  FOR UPDATE USING (auth.uid() = invitee_id);

-- Playlist owners can delete invitations they sent
CREATE POLICY "Playlist owners can delete their invitations" ON playlist_invitations
  FOR DELETE USING (auth.uid() = inviter_id);

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_playlist_invitations_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_playlist_invitations_updated_at
  BEFORE UPDATE ON playlist_invitations
  FOR EACH ROW
  EXECUTE FUNCTION update_playlist_invitations_updated_at();

-- Function to check if user has access to playlist (owner or accepted invitee)
CREATE OR REPLACE FUNCTION user_has_playlist_access(playlist_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM playlists
    WHERE id = playlist_uuid AND created_by = user_uuid
  ) OR EXISTS (
    SELECT 1 FROM playlist_invitations
    WHERE playlist_id = playlist_uuid 
    AND invitee_id = user_uuid 
    AND status = 'accepted'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Update playlist_tracks policy to allow invitees to add tracks
DROP POLICY IF EXISTS "Playlist owners can manage tracks" ON playlist_tracks;

CREATE POLICY "Playlist owners and invitees can manage tracks" ON playlist_tracks
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM playlists 
      WHERE playlists.id = playlist_tracks.playlist_id 
      AND (
        playlists.created_by = auth.uid() OR
        EXISTS (
          SELECT 1 FROM playlist_invitations
          WHERE playlist_invitations.playlist_id = playlists.id
          AND playlist_invitations.invitee_id = auth.uid()
          AND playlist_invitations.status = 'accepted'
        )
      )
    )
  );
