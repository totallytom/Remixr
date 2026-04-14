-- Boost subscription table
CREATE TABLE IF NOT EXISTS boost_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  next_billing_date TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '30 days'),
  monthly_amount DECIMAL(10,2) DEFAULT 10.00,
  tracks_remaining INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Boosted tracks table
CREATE TABLE IF NOT EXISTS boosted_tracks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  track_id UUID NOT NULL REFERENCES tracks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  boost_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  boost_priority INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(track_id, user_id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_boost_subscriptions_user_id ON boost_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_boost_subscriptions_active ON boost_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_boosted_tracks_user_id ON boosted_tracks(user_id);
CREATE INDEX IF NOT EXISTS idx_boosted_tracks_track_id ON boosted_tracks(track_id);
CREATE INDEX IF NOT EXISTS idx_boosted_tracks_expires ON boosted_tracks(boost_expires_at);
CREATE INDEX IF NOT EXISTS idx_boosted_tracks_priority ON boosted_tracks(boost_priority);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for boost_subscriptions
CREATE TRIGGER update_boost_subscriptions_updated_at 
    BEFORE UPDATE ON boost_subscriptions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security (RLS) policies
ALTER TABLE boost_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE boosted_tracks ENABLE ROW LEVEL SECURITY;

-- Policies for boost_subscriptions
CREATE POLICY "Users can view their own boost subscriptions" ON boost_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own boost subscriptions" ON boost_subscriptions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own boost subscriptions" ON boost_subscriptions
    FOR UPDATE USING (auth.uid() = user_id);

-- Policies for boosted_tracks
CREATE POLICY "Anyone can view boosted tracks" ON boosted_tracks
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own boosted tracks" ON boosted_tracks
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own boosted tracks" ON boosted_tracks
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own boosted tracks" ON boosted_tracks
    FOR DELETE USING (auth.uid() = user_id);

-- Function to get boosted tracks for recommendations
CREATE OR REPLACE FUNCTION get_boosted_tracks(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  id UUID,
  title TEXT,
  artist TEXT,
  album TEXT,
  duration INTEGER,
  cover TEXT,
  audio_url TEXT,
  price DECIMAL(10,2),
  genre TEXT,
  boosted BOOLEAN,
  boost_expires_at TIMESTAMP WITH TIME ZONE,
  boost_priority INTEGER,
  boost_user_id UUID
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
    true as boosted,
    bt.boost_expires_at,
    bt.boost_priority,
    bt.user_id as boost_user_id
  FROM boosted_tracks bt
  JOIN tracks t ON bt.track_id = t.id
  WHERE bt.boost_expires_at > NOW()
  ORDER BY bt.boost_priority DESC, bt.boost_expires_at ASC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- Function to check if user has active boost subscription
CREATE OR REPLACE FUNCTION has_active_boost_subscription(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM boost_subscriptions 
    WHERE user_id = user_uuid AND is_active = true
  );
END;
$$ LANGUAGE plpgsql;

-- Function to get user's boost subscription
CREATE OR REPLACE FUNCTION get_user_boost_subscription(user_uuid UUID)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  is_active BOOLEAN,
  start_date TIMESTAMP WITH TIME ZONE,
  next_billing_date TIMESTAMP WITH TIME ZONE,
  monthly_amount DECIMAL(10,2),
  tracks_remaining INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    bs.id,
    bs.user_id,
    bs.is_active,
    bs.start_date,
    bs.next_billing_date,
    bs.monthly_amount,
    bs.tracks_remaining
  FROM boost_subscriptions bs
  WHERE bs.user_id = user_uuid AND bs.is_active = true;
END;
$$ LANGUAGE plpgsql; 

-- Table: follow_requests
CREATE TABLE IF NOT EXISTS follow_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  target_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (requester_id, target_id)
); 