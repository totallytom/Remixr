-- Fix Storage Buckets and Policies
-- This script ensures all necessary storage buckets exist and have proper RLS policies

-- Create storage bucket for music files (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('music-files', 'music-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for post files (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('post-files', 'post-files', true)
ON CONFLICT (id) DO NOTHING;

-- Enable RLS on storage.objects if not already enabled
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Drop existing storage policies to recreate them
DROP POLICY IF EXISTS "Anyone can view music files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload music files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own music files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own music files" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view post files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload post files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own post files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own post files" ON storage.objects;

-- Storage policies for music files
CREATE POLICY "Anyone can view music files" ON storage.objects
  FOR SELECT USING (bucket_id = 'music-files');

CREATE POLICY "Authenticated users can upload music files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'music-files' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own music files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'music-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own music files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'music-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Storage policies for post files
CREATE POLICY "Anyone can view post files" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-files');

CREATE POLICY "Authenticated users can upload post files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'post-files' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Users can update their own post files" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'post-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Users can delete their own post files" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'post-files' 
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- Alternative simpler policies for testing (if the above don't work)
-- Uncomment these if you're still having issues:

/*
-- Simple policies that allow all authenticated users to upload to music-files
CREATE POLICY "Allow authenticated uploads to music-files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'music-files' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Allow authenticated uploads to post-files" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'post-files' 
    AND auth.role() = 'authenticated'
  );

CREATE POLICY "Allow viewing music files" ON storage.objects
  FOR SELECT USING (bucket_id = 'music-files');

CREATE POLICY "Allow viewing post files" ON storage.objects
  FOR SELECT USING (bucket_id = 'post-files');
*/ 

-- Add Stripe Connect and boost/affiliate fields migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS stripe_account_id VARCHAR(255);
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS boosted BOOLEAN DEFAULT FALSE;
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS boost_expiry TIMESTAMP;
ALTER TABLE store_items ADD COLUMN IF NOT EXISTS affiliate_link TEXT; 