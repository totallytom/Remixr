-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing triggers first (if they exist)
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
DROP TRIGGER IF EXISTS update_tracks_updated_at ON tracks;
DROP TRIGGER IF EXISTS update_comments_updated_at ON comments;
DROP TRIGGER IF EXISTS update_playlists_updated_at ON playlists;
DROP TRIGGER IF EXISTS update_posts_updated_at ON posts;
DROP TRIGGER IF EXISTS update_store_items_updated_at ON store_items;
DROP TRIGGER IF EXISTS update_orders_updated_at ON orders;

-- Drop existing policies (if they exist)
DROP POLICY IF EXISTS "Users can view all public profiles" ON users;
DROP POLICY IF EXISTS "Users can update their own profile" ON users;
DROP POLICY IF EXISTS "Users can insert their own profile" ON users;

DROP POLICY IF EXISTS "Anyone can view public tracks" ON tracks;
DROP POLICY IF EXISTS "Users can create their own tracks" ON tracks;
DROP POLICY IF EXISTS "Users can update their own tracks" ON tracks;
DROP POLICY IF EXISTS "Users can delete their own tracks" ON tracks;

DROP POLICY IF EXISTS "Anyone can view comments" ON comments;
DROP POLICY IF EXISTS "Authenticated users can create comments" ON comments;
DROP POLICY IF EXISTS "Users can update their own comments" ON comments;
DROP POLICY IF EXISTS "Users can delete their own comments" ON comments;

DROP POLICY IF EXISTS "Anyone can view public playlists" ON playlists;
DROP POLICY IF EXISTS "Users can create their own playlists" ON playlists;
DROP POLICY IF EXISTS "Users can update their own playlists" ON playlists;
DROP POLICY IF EXISTS "Users can delete their own playlists" ON playlists;

DROP POLICY IF EXISTS "Anyone can view playlist tracks for public playlists" ON playlist_tracks;
DROP POLICY IF EXISTS "Playlist owners can manage tracks" ON playlist_tracks;

DROP POLICY IF EXISTS "Users can view messages they sent or received" ON messages;
DROP POLICY IF EXISTS "Users can send messages" ON messages;
DROP POLICY IF EXISTS "Users can delete their own messages" ON messages;

DROP POLICY IF EXISTS "Anyone can view posts" ON posts;
DROP POLICY IF EXISTS "Users can create their own posts" ON posts;
DROP POLICY IF EXISTS "Users can update their own posts" ON posts;
DROP POLICY IF EXISTS "Users can delete their own posts" ON posts;

DROP POLICY IF EXISTS "Anyone can view store items" ON store_items;
DROP POLICY IF EXISTS "Users can create their own store items" ON store_items;
DROP POLICY IF EXISTS "Users can update their own store items" ON store_items;
DROP POLICY IF EXISTS "Users can delete their own store items" ON store_items;

DROP POLICY IF EXISTS "Users can view their own orders" ON orders;
DROP POLICY IF EXISTS "Users can create their own orders" ON orders;
DROP POLICY IF EXISTS "Users can update their own orders" ON orders;

DROP POLICY IF EXISTS "Anyone can view music files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload music files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own music files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own music files" ON storage.objects;

DROP POLICY IF EXISTS "Anyone can view post files" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload post files" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own post files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own post files" ON storage.objects;

-- Create users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  avatar TEXT DEFAULT 'https://api.dicebear.com/7.x/avataaars/svg?seed=default',
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  role VARCHAR(20) CHECK (role IN ('musician', 'consumer')) DEFAULT 'consumer',
  is_verified BOOLEAN DEFAULT FALSE,
  is_private BOOLEAN DEFAULT FALSE,
  artist_name VARCHAR(100),
  bio TEXT,
  genres TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create tracks table
CREATE TABLE IF NOT EXISTS tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  album VARCHAR(255) NOT NULL,
  duration INTEGER NOT NULL, -- in seconds
  cover TEXT NOT NULL,
  audio_url TEXT NOT NULL,
  price DECIMAL(10,2),
  genre VARCHAR(100) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create comments table
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  likes INTEGER DEFAULT 0,
  liked_by UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create playlists table
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  cover TEXT,
  created_by UUID REFERENCES users(id) ON DELETE CASCADE,
  is_public BOOLEAN DEFAULT TRUE,
  followers INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create playlist_tracks junction table
CREATE TABLE IF NOT EXISTS playlist_tracks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  playlist_id UUID REFERENCES playlists(id) ON DELETE CASCADE,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  position INTEGER NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(playlist_id, track_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id UUID REFERENCES users(id) ON DELETE CASCADE,
  receiver_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  type VARCHAR(20) CHECK (type IN ('text', 'audio', 'image')) DEFAULT 'text',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create posts table
CREATE TABLE IF NOT EXISTS posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  caption TEXT NOT NULL,
  image_url TEXT,
  music_url TEXT,
  likes INTEGER DEFAULT 0,
  liked_by UUID[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create store_items table
CREATE TABLE IF NOT EXISTS store_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(255) NOT NULL,
  artist VARCHAR(255) NOT NULL,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  image_url TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN ('music', 'merchandise', 'accessories', 'digital')),
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  artist_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  audio_url TEXT,
  in_stock BOOLEAN DEFAULT TRUE,
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  items JSONB NOT NULL, -- Array of order items
  total DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')) DEFAULT 'pending',
  payment_intent_id VARCHAR(255),
  shipping_address JSONB, -- Shipping address object
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_tracks_user_id ON tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_tracks_created_at ON tracks(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_track_id ON comments(track_id);
CREATE INDEX IF NOT EXISTS idx_comments_created_at ON comments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_playlists_created_by ON playlists(created_by);
CREATE INDEX IF NOT EXISTS idx_playlist_tracks_playlist_id ON playlist_tracks(playlist_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_user_id ON posts(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_store_items_artist_id ON store_items(artist_id);
CREATE INDEX IF NOT EXISTS idx_store_items_category ON store_items(category);
CREATE INDEX IF NOT EXISTS idx_store_items_created_at ON store_items(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_user_id ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at DESC);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tracks_updated_at BEFORE UPDATE ON tracks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_comments_updated_at BEFORE UPDATE ON comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_playlists_updated_at BEFORE UPDATE ON playlists
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON posts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_store_items_updated_at BEFORE UPDATE ON store_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlists ENABLE ROW LEVEL SECURITY;
ALTER TABLE playlist_tracks ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

-- Users policies
CREATE POLICY "Users can view all public profiles" ON users
  FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" ON users
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" ON users
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Tracks policies
CREATE POLICY "Anyone can view public tracks" ON tracks
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own tracks" ON tracks
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tracks" ON tracks
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tracks" ON tracks
  FOR DELETE USING (auth.uid() = user_id);

-- Comments policies
CREATE POLICY "Anyone can view comments" ON comments
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create comments" ON comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own comments" ON comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON comments
  FOR DELETE USING (auth.uid() = user_id);

-- Playlists policies
CREATE POLICY "Anyone can view public playlists" ON playlists
  FOR SELECT USING (is_public = true OR auth.uid() = created_by);

CREATE POLICY "Users can create their own playlists" ON playlists
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Users can update their own playlists" ON playlists
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Users can delete their own playlists" ON playlists
  FOR DELETE USING (auth.uid() = created_by);

-- Playlist tracks policies
CREATE POLICY "Anyone can view playlist tracks for public playlists" ON playlist_tracks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM playlists 
      WHERE playlists.id = playlist_tracks.playlist_id 
      AND (playlists.is_public = true OR playlists.created_by = auth.uid())
    )
  );

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

-- Messages policies
CREATE POLICY "Users can view messages they sent or received" ON messages
  FOR SELECT USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

CREATE POLICY "Users can send messages" ON messages
  FOR INSERT WITH CHECK (auth.uid() = sender_id);

CREATE POLICY "Users can update their own messages" ON messages
  FOR UPDATE USING (auth.uid() = sender_id);

CREATE POLICY "Users can delete their own messages" ON messages
  FOR DELETE USING (auth.uid() = sender_id);

-- Posts policies
CREATE POLICY "Anyone can view posts" ON posts
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own posts" ON posts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own posts" ON posts
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own posts" ON posts
  FOR DELETE USING (auth.uid() = user_id);

-- Store items policies
CREATE POLICY "Anyone can view store items" ON store_items
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own store items" ON store_items
  FOR INSERT WITH CHECK (auth.uid() = artist_id);

CREATE POLICY "Users can update their own store items" ON store_items
  FOR UPDATE USING (auth.uid() = artist_id);

CREATE POLICY "Users can delete their own store items" ON store_items
  FOR DELETE USING (auth.uid() = artist_id);

-- Orders policies
CREATE POLICY "Users can view their own orders" ON orders
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders" ON orders
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own orders" ON orders
  FOR UPDATE USING (auth.uid() = user_id);

-- Create storage bucket for music files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('music-files', 'music-files', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for post files
INSERT INTO storage.buckets (id, name, public) 
VALUES ('post-files', 'post-files', true)
ON CONFLICT (id) DO NOTHING;

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

-- Create functions for common operations

-- Function to get user's tracks with pagination
CREATE OR REPLACE FUNCTION get_user_tracks(
  user_uuid UUID,
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(255),
  artist VARCHAR(255),
  album VARCHAR(255),
  duration INTEGER,
  cover TEXT,
  audio_url TEXT,
  price DECIMAL(10,2),
  genre VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.artist,
    t.album,
    t.duration,
    t.cover,
    t.audio_url,
    t.price,
    t.genre,
    t.created_at
  FROM tracks t
  WHERE t.user_id = user_uuid
  ORDER BY t.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get playlist with tracks
CREATE OR REPLACE FUNCTION get_playlist_with_tracks(playlist_uuid UUID)
RETURNS TABLE (
  playlist_id UUID,
  playlist_name VARCHAR(255),
  playlist_description TEXT,
  playlist_cover TEXT,
  playlist_created_by UUID,
  playlist_is_public BOOLEAN,
  playlist_followers INTEGER,
  playlist_created_at TIMESTAMP WITH TIME ZONE,
  track_id UUID,
  track_title VARCHAR(255),
  track_artist VARCHAR(255),
  track_album VARCHAR(255),
  track_duration INTEGER,
  track_cover TEXT,
  track_audio_url TEXT,
  track_price DECIMAL(10,2),
  track_genre VARCHAR(100),
  "position" INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id as playlist_id,
    p.name as playlist_name,
    p.description as playlist_description,
    p.cover as playlist_cover,
    p.created_by as playlist_created_by,
    p.is_public as playlist_is_public,
    p.followers as playlist_followers,
    p.created_at as playlist_created_at,
    t.id as track_id,
    t.title as track_title,
    t.artist as track_artist,
    t.album as track_album,
    t.duration as track_duration,
    t.cover as track_cover,
    t.audio_url as track_audio_url,
    t.price as track_price,
    t.genre as track_genre,
    pt."position"
  FROM playlists p
  LEFT JOIN playlist_tracks pt ON p.id = pt.playlist_id
  LEFT JOIN tracks t ON pt.track_id = t.id
  WHERE p.id = playlist_uuid
  ORDER BY pt."position" ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to search tracks
CREATE OR REPLACE FUNCTION search_tracks(
  search_query TEXT,
  limit_count INTEGER DEFAULT 50,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(255),
  artist VARCHAR(255),
  album VARCHAR(255),
  duration INTEGER,
  cover TEXT,
  audio_url TEXT,
  price DECIMAL(10,2),
  genre VARCHAR(100),
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.artist,
    t.album,
    t.duration,
    t.cover,
    t.audio_url,
    t.price,
    t.genre,
    t.user_id,
    t.created_at
  FROM tracks t
  WHERE 
    t.title ILIKE '%' || search_query || '%' OR
    t.artist ILIKE '%' || search_query || '%' OR
    t.album ILIKE '%' || search_query || '%' OR
    t.genre ILIKE '%' || search_query || '%'
  ORDER BY t.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add user statistics tables
CREATE TABLE IF NOT EXISTS user_play_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id UUID REFERENCES tracks(id) ON DELETE CASCADE,
  played_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  play_duration INTEGER DEFAULT 0, -- seconds played
  completed BOOLEAN DEFAULT FALSE -- whether they finished the track
);

CREATE TABLE IF NOT EXISTS user_follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  following_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  followed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

CREATE TABLE IF NOT EXISTS user_listening_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_start TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  session_end TIMESTAMP WITH TIME ZONE,
  total_duration INTEGER DEFAULT 0, -- total seconds in session
  tracks_played INTEGER DEFAULT 0
);

-- Add indexes for statistics
CREATE INDEX IF NOT EXISTS idx_play_history_user_id ON user_play_history(user_id);
CREATE INDEX IF NOT EXISTS idx_play_history_played_at ON user_play_history(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower_id ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following_id ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_listening_sessions_user_id ON user_listening_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_listening_sessions_session_start ON user_listening_sessions(session_start DESC);

-- Enable RLS on store_items
ALTER TABLE store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_play_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_listening_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing store policies if they exist
DROP POLICY IF EXISTS "Anyone can view store items" ON store_items;
DROP POLICY IF EXISTS "Users can create their own store items" ON store_items;
DROP POLICY IF EXISTS "Users can update their own store items" ON store_items;
DROP POLICY IF EXISTS "Users can delete their own store items" ON store_items;

-- Create store items policies
CREATE POLICY "Anyone can view store items" ON store_items
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own store items" ON store_items
  FOR INSERT WITH CHECK (auth.uid() = artist_id);

CREATE POLICY "Users can update their own store items" ON store_items
  FOR UPDATE USING (auth.uid() = artist_id);

CREATE POLICY "Users can delete their own store items" ON store_items
  FOR DELETE USING (auth.uid() = artist_id);

-- Create play history policies
CREATE POLICY "Users can view their own play history" ON user_play_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own play history" ON user_play_history
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create follows policies
CREATE POLICY "Anyone can view follows" ON user_follows
  FOR SELECT USING (true);

CREATE POLICY "Users can create their own follows" ON user_follows
  FOR INSERT WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "Users can delete their own follows" ON user_follows
  FOR DELETE USING (auth.uid() = follower_id);

-- Allow profile owner to remove a follower (delete where they are the one being followed)
CREATE POLICY "Users can remove followers from their profile" ON user_follows
  FOR DELETE USING (auth.uid() = following_id);

-- Create listening sessions policies
CREATE POLICY "Users can view their own listening sessions" ON user_listening_sessions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own listening sessions" ON user_listening_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own listening sessions" ON user_listening_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Create functions for statistics
CREATE OR REPLACE FUNCTION get_user_stats(user_uuid UUID)
RETURNS TABLE (
  tracks_played INTEGER,
  artists_followed INTEGER,
  listening_time_hours DECIMAL(10,2),
  this_month_listening_hours DECIMAL(10,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    -- Total tracks played
    COALESCE(COUNT(DISTINCT ph.track_id), 0)::INTEGER as tracks_played,
    
    -- Artists followed
    COALESCE(COUNT(DISTINCT uf.following_id), 0)::INTEGER as artists_followed,
    
    -- Total listening time in hours
    COALESCE(SUM(ph.play_duration) / 3600.0, 0)::DECIMAL(10,2) as listening_time_hours,
    
    -- This month listening time in hours
    COALESCE(
      SUM(CASE 
        WHEN ph.played_at >= date_trunc('month', CURRENT_DATE) 
        THEN ph.play_duration 
        ELSE 0 
      END) / 3600.0, 0
    )::DECIMAL(10,2) as this_month_listening_hours
    
  FROM auth.users u
  LEFT JOIN user_play_history ph ON u.id = ph.user_id
  LEFT JOIN user_follows uf ON u.id = uf.follower_id
  WHERE u.id = user_uuid
  GROUP BY u.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 

-- Enhanced recommendation function
CREATE OR REPLACE FUNCTION get_recommended_tracks(
  user_uuid UUID,
  limit_count INTEGER DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(255),
  artist VARCHAR(255),
  album VARCHAR(255),
  duration INTEGER,
  cover TEXT,
  audio_url TEXT,
  price DECIMAL(10,2),
  genre VARCHAR(100),
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  recommendation_score DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  WITH user_preferences AS (
    -- Get user's preferred genres
    SELECT unnest(genres) as preferred_genre
    FROM users
    WHERE id = user_uuid
  ),
  user_play_history AS (
    -- Get user's play history with genre info
    SELECT 
      ph.track_id,
      t.genre,
      COUNT(*) as play_count,
      MAX(ph.played_at) as last_played
    FROM user_play_history ph
    JOIN tracks t ON ph.track_id = t.id
    WHERE ph.user_id = user_uuid
    GROUP BY ph.track_id, t.genre
  ),
  genre_weights AS (
    -- Calculate genre preferences based on play history
    SELECT 
      genre,
      SUM(play_count) as total_plays,
      COUNT(*) as unique_tracks
    FROM user_play_history
    GROUP BY genre
  ),
  recommended_tracks AS (
    SELECT 
      t.*,
      -- Calculate recommendation score
      CASE 
        -- Higher score for user's preferred genres
        WHEN EXISTS (SELECT 1 FROM user_preferences up WHERE up.preferred_genre = t.genre) THEN 10.0
        -- Medium score for genres user has played before
        WHEN EXISTS (SELECT 1 FROM genre_weights gw WHERE gw.genre = t.genre AND gw.total_plays > 0) THEN 5.0
        -- Lower score for new genres
        ELSE 1.0
      END +
      -- Bonus for recent tracks
      CASE 
        WHEN t.created_at >= NOW() - INTERVAL '30 days' THEN 2.0
        WHEN t.created_at >= NOW() - INTERVAL '90 days' THEN 1.0
        ELSE 0.0
      END as recommendation_score
    FROM tracks t
    WHERE t.user_id != user_uuid  -- Don't recommend user's own tracks
  )
  SELECT 
    rt.id,
    rt.title,
    rt.artist,
    rt.album,
    rt.duration,
    rt.cover,
    rt.audio_url,
    rt.price,
    rt.genre,
    rt.user_id,
    rt.created_at,
    rt.recommendation_score
  FROM recommended_tracks rt
  ORDER BY rt.recommendation_score DESC, rt.created_at DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get tracks by genre with popularity
CREATE OR REPLACE FUNCTION get_tracks_by_genre(
  genre_filter VARCHAR(100),
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(255),
  artist VARCHAR(255),
  album VARCHAR(255),
  duration INTEGER,
  cover TEXT,
  audio_url TEXT,
  price DECIMAL(10,2),
  genre VARCHAR(100),
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  play_count BIGINT,
  preview_start_sec NUMERIC,
  preview_duration_sec NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.artist,
    t.album,
    t.duration,
    t.cover,
    t.audio_url,
    t.price,
    t.genre,
    t.user_id,
    t.created_at,
    COALESCE(COUNT(ph.id), 0) as play_count,
    t.preview_start_sec,
    t.preview_duration_sec
  FROM tracks t
  LEFT JOIN user_play_history ph ON t.id = ph.track_id
  WHERE t.genre = genre_filter
  GROUP BY t.id, t.title, t.artist, t.album, t.duration, t.cover, t.audio_url, t.price, t.genre, t.user_id, t.created_at, t.preview_start_sec, t.preview_duration_sec
  ORDER BY play_count DESC, t.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get popular tracks across all genres
CREATE OR REPLACE FUNCTION get_popular_tracks(
  limit_count INTEGER DEFAULT 20,
  offset_count INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID,
  title VARCHAR(255),
  artist VARCHAR(255),
  album VARCHAR(255),
  duration INTEGER,
  cover TEXT,
  audio_url TEXT,
  price DECIMAL(10,2),
  genre VARCHAR(100),
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE,
  play_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.id,
    t.title,
    t.artist,
    t.album,
    t.duration,
    t.cover,
    t.audio_url,
    t.price,
    t.genre,
    t.user_id,
    t.created_at,
    COALESCE(COUNT(ph.id), 0) as play_count
  FROM tracks t
  LEFT JOIN user_play_history ph ON t.id = ph.track_id
  GROUP BY t.id, t.title, t.artist, t.album, t.duration, t.cover, t.audio_url, t.price, t.genre, t.user_id, t.created_at
  ORDER BY play_count DESC, t.created_at DESC
  LIMIT limit_count
  OFFSET offset_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 