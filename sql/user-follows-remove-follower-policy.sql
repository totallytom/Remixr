-- Migration: Allow profile owner to remove followers (permanent Remove button on followers list).
-- Run this in Supabase SQL Editor if your project was created before this policy existed.
-- Unfollow (follower_id = auth.uid()) was already allowed by "Users can delete their own follows".

-- Drop if re-running
DROP POLICY IF EXISTS "Users can remove followers from their profile" ON user_follows;

-- Profile owner can delete rows where they are the one being followed (remove a follower)
CREATE POLICY "Users can remove followers from their profile" ON user_follows
  FOR DELETE USING (auth.uid() = following_id);
