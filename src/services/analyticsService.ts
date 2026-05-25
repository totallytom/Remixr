import { supabase } from './supabase';

export interface ArtistOverview {
  totalTracks: number;
  totalAlbums: number;
  totalPlays: number;
  totalLikes: number;
  totalFollowers: number;
  playsThisMonth: number;
  newFollowersThisMonth: number;
}

export interface TrackStat {
  trackId: string;
  title: string;
  genre: string;
  createdAt: string;
  playCount: number;
  likeCount: number;
  uniqueListeners: number;
}

export interface DailyPlay {
  playDate: string;
  playCount: number;
}

export interface DailyListeners {
  playDate: string;
  uniqueListeners: number;
}

export interface TopListener {
  listenerId: string;
  username: string;
  avatar: string;
  playCount: number;
}

export const analyticsService = {
  async getOverview(artistId: string): Promise<ArtistOverview> {
    const { data, error } = await supabase
      .rpc('get_artist_overview', { artist_id: artistId });

    if (error) throw error;

    const row = data?.[0];
    return {
      totalTracks: Number(row?.total_tracks ?? 0),
      totalAlbums: Number(row?.total_albums ?? 0),
      totalPlays: Number(row?.total_plays ?? 0),
      totalLikes: Number(row?.total_likes ?? 0),
      totalFollowers: Number(row?.total_followers ?? 0),
      playsThisMonth: Number(row?.plays_this_month ?? 0),
      newFollowersThisMonth: Number(row?.new_followers_this_month ?? 0),
    };
  },

  async getTrackStats(artistId: string): Promise<TrackStat[]> {
    const { data, error } = await supabase
      .rpc('get_artist_track_stats', { artist_id: artistId });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      trackId: row.track_id,
      title: row.title,
      genre: row.genre,
      createdAt: row.created_at,
      playCount: Number(row.play_count),
      likeCount: Number(row.like_count),
      uniqueListeners: Number(row.unique_listeners),
    }));
  },

  async getDailyPlays(artistId: string, daysBack = 30): Promise<DailyPlay[]> {
    const { data, error } = await supabase
      .rpc('get_artist_daily_plays', { artist_id: artistId, days_back: daysBack });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      playDate: row.play_date,
      playCount: Number(row.play_count),
    }));
  },

  async getDailyListeners(artistId: string, daysBack = 30): Promise<DailyListeners[]> {
    const { data, error } = await supabase
      .rpc('get_artist_daily_listeners', { artist_id: artistId, days_back: daysBack });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      playDate: row.play_date,
      uniqueListeners: Number(row.unique_listeners),
    }));
  },

  async getTopListeners(artistId: string, limit = 10): Promise<TopListener[]> {
    const { data, error } = await supabase
      .rpc('get_artist_top_listeners', { artist_id: artistId, limit_count: limit });

    if (error) throw error;

    return (data ?? []).map((row: any) => ({
      listenerId: row.listener_id,
      username: row.username,
      avatar: row.avatar,
      playCount: Number(row.play_count),
    }));
  },

  async getUploadCounts(userId: string): Promise<{ trackCount: number; albumCount: number }> {
    const { data, error } = await supabase
      .rpc('get_upload_counts', { target_user_id: userId });

    if (error) throw error;

    const row = data?.[0];
    return {
      trackCount: Number(row?.track_count ?? 0),
      albumCount: Number(row?.album_count ?? 0),
    };
  },
};
