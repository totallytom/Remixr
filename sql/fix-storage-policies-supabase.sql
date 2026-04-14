-- Fix Storage Buckets and Policies for Supabase
-- This script works with Supabase's storage system

-- Create storage bucket for music files (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('music-files', 'music-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for post files (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('post-files', 'post-files', true)
ON CONFLICT (id) DO NOTHING;

-- Note: We cannot directly modify storage.objects table as it's managed by Supabase
-- Instead, we need to create policies through the Supabase dashboard or use the correct syntax

-- Drop existing storage policies (if they exist)
DROP POLICY IF EXISTS "Anyone can view music files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload music files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own music files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own music files" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view post files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload post files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own post files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own post files" ON storage.objects;

-- Create simple, permissive policies for testing
-- These policies allow any authenticated user to upload to the buckets

-- Music files policies
CREATE POLICY "Allow authenticated uploads to music-files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'music-files' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Allow viewing music files" ON storage.objects
  FOR SELECT USING (bucket_id = 'music-files');

CREATE POLICY "Allow authenticated users to update music files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'music-files' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Allow authenticated users to delete music files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'music-files' 
    AND auth.role() = 'authenticated'
  );

-- Post files policies
CREATE POLICY "Allow authenticated uploads to post-files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'post-files' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Allow viewing post files" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-files');

CREATE POLICY "Allow authenticated users to update post files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'post-files' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Allow authenticated users to delete post files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'post-files' 
    AND auth.role() = 'authenticated'
  ); 