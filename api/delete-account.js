const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Using service role for admin operations
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // Verify user exists
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (userError) {
      console.error('Error checking user:', userError);
      return res.status(500).json({ error: 'Failed to verify user' });
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Delete user data in proper order (to handle foreign key constraints)
    console.log(`Starting account deletion for user: ${userId}`);

    // 1. Delete comments first (they reference posts and tracks)
    const { error: commentsError } = await supabase
      .from('comments')
      .delete()
      .eq('user_id', userId);
    if (commentsError) console.warn('Error deleting comments:', commentsError);

    // 2. Delete boosted tracks
    const { error: boostedTracksError } = await supabase
      .from('boosted_tracks')
      .delete()
      .eq('user_id', userId);
    if (boostedTracksError) console.warn('Error deleting boosted tracks:', boostedTracksError);

    // 3. Delete boost subscriptions
    const { error: boostSubError } = await supabase
      .from('boost_subscriptions')
      .delete()
      .eq('user_id', userId);
    if (boostSubError) console.warn('Error deleting boost subscriptions:', boostSubError);

    // 4. Delete store items
    const { error: storeItemsError } = await supabase
      .from('store_items')
      .delete()
      .eq('user_id', userId);
    if (storeItemsError) console.warn('Error deleting store items:', storeItemsError);

    // 5. Delete user follows (as follower or following)
    const { error: followsError } = await supabase
      .from('user_follows')
      .delete()
      .or(`follower_id.eq.${userId},following_id.eq.${userId}`);
    if (followsError) console.warn('Error deleting follows:', followsError);

    // 6. Delete follow requests
    const { error: followRequestsError } = await supabase
      .from('follow_requests')
      .delete()
      .or(`requester_id.eq.${userId},requested_id.eq.${userId}`);
    if (followRequestsError) console.warn('Error deleting follow requests:', followRequestsError);

    // 7. Delete messages (as sender or receiver)
    const { error: messagesError } = await supabase
      .from('messages')
      .delete()
      .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
    if (messagesError) console.warn('Error deleting messages:', messagesError);

    // 8. Delete posts
    const { error: postsError } = await supabase
      .from('posts')
      .delete()
      .eq('user_id', userId);
    if (postsError) console.warn('Error deleting posts:', postsError);

    // 9. Delete playlists
    const { error: playlistsError } = await supabase
      .from('playlists')
      .delete()
      .eq('created_by', userId);
    if (playlistsError) console.warn('Error deleting playlists:', playlistsError);

    // 10. Delete tracks
    const { error: tracksError } = await supabase
      .from('tracks')
      .delete()
      .eq('user_id', userId);
    if (tracksError) console.warn('Error deleting tracks:', tracksError);

    // 11. Delete user profile from database
    const { error: userDeleteError } = await supabase
      .from('users')
      .delete()
      .eq('id', userId);
    if (userDeleteError) {
      console.error('Error deleting user profile:', userDeleteError);
      return res.status(500).json({ error: 'Failed to delete user profile' });
    }

    // 12. Finally, delete from Supabase Auth (this requires admin privileges)
    const { error: authDeleteError } = await supabase.auth.admin.deleteUser(userId);
    if (authDeleteError) {
      console.error('Error deleting from Supabase Auth:', authDeleteError);
      // Note: At this point the user data is already deleted, but auth record remains
      // This might be acceptable depending on your requirements
      return res.status(500).json({ error: 'Failed to delete authentication record' });
    }

    console.log(`Account deletion completed for user: ${userId}`);
    res.json({ success: true, message: 'Account deleted successfully' });

  } catch (error) {
    console.error('Account deletion failed:', error);
    res.status(500).json({ 
      error: 'Account deletion failed', 
      details: error.message 
    });
  }
}; 