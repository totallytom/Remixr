-- Test Storage Setup
-- Run this in your Supabase SQL editor to verify storage configuration

-- Check if storage buckets exist
SELECT * FROM storage.buckets WHERE id IN ('music-files', 'post-files');

-- Check if RLS is enabled on storage.objects
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'storage' AND tablename = 'objects';

-- Check existing storage policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies 
WHERE schemaname = 'storage' AND tablename = 'objects'
ORDER BY policyname;

-- Test if authenticated users can upload (this should return true if policies are correct)
-- Note: This is just a syntax check, actual testing requires authentication
SELECT 
  bucket_id = 'music-files' AND auth.role() = 'authenticated' as can_upload_music,
  bucket_id = 'post-files' AND auth.role() = 'authenticated' as can_upload_posts
FROM storage.objects 
LIMIT 1; 