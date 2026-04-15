import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Play, Bookmark, Share2, Clock, TrendingUp, Loader, Zap, Star, Users, Music, List, MessageCircle, X, CreditCard, Lock, CheckCircle, AlertCircle, ThumbsUp, FolderOpen } from 'lucide-react';
import { useStore } from '../store/useStore';
import TrackCard from '../components/music/TrackCard';
import UserCard from '../components/social/UserCard';
import { Track, User } from '../store/useStore';
import { MusicService } from '../services/musicService';
import { AlbumService, Album } from '../services/albumService';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../services/supabase';
import { safeLog } from '../utils/debugUtils';
import SubscribeButton from '../components/SubscribeButton';


const Home: React.FC = () => {
  const { playTrack, addToQueue, player, user } = useStore();
  const [recommendedTracks, setRecommendedTracks] = useState<Track[]>([]);
  const [recentTracks, setRecentTracks] = useState<{ track: Track, playedAt: string }[]>([]);
  const [popularTracks, setPopularTracks] = useState<Track[]>([]);
  const [publishedTracks, setPublishedTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);
  const [isLoadingPublished, setIsLoadingPublished] = useState(true);
  const [showBoostModal, setShowBoostModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'details' | 'processing' | 'success' | 'error'>('details');
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [cardholderName, setCardholderName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mostPlayedTracks, setMostPlayedTracks] = useState<{ track: Track, playCount: number }[]>([]);
  const [publicFeed, setPublicFeed] = useState<Track[]>([]); // NEW: other users' public tracks
  const [topChartsTracks, setTopChartsTracks] = useState<{ track: Track, likes: number }[]>([]);
  const [isLoadingTopCharts, setIsLoadingTopCharts] = useState(false);
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(false);
  const navigate = useNavigate();

  // Load public data once on mount (does not depend on auth state)
  useEffect(() => {
    let cancelled = false;

    // Safety net: if all queries hang past 12s, stop the loading screen
    const safetyTimeout = setTimeout(() => {
      if (!cancelled) setIsLoading(false);
    }, 12000);

    const loadPublicData = async () => {
      try {
        setIsLoadingRecommendations(true);
        setIsLoadingTopCharts(true);

        const [
          { data: recommendedData, error: recommendedError },
          { data: popularData, error: popularError },
          { data: topChartsData, error: topChartsError },
          { data: publicData, error: publicErr },
        ] = await Promise.all([
          supabase.from('tracks').select('id, title, artist, album, cover, genre, audio_url, duration, price, created_at').limit(8).order('created_at', { ascending: false }),
          supabase.rpc('get_popular_tracks', { limit_count: 4 }),
          supabase.from('tracks').select('id, title, artist, album, cover, genre, audio_url, duration, price, likes, liked_by').order('likes', { ascending: false, nullsFirst: false }).limit(10),
          supabase.from('tracks').select('id, title, artist, album, cover, genre, audio_url, duration, price, created_at').order('created_at', { ascending: false }).limit(12),
        ]);

        if (cancelled) return;

        // Recommended tracks
        if (recommendedError) {
          console.error('Error fetching recommended tracks:', recommendedError);
          setRecommendedTracks([]);
        } else {
          setRecommendedTracks((recommendedData || []).map(t => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            album: t.album,
            duration: t.duration || 0,
            cover: t.cover,
            genre: t.genre,
            audioUrl: t.audio_url,
            price: t.price || 0,
            boosted: false,
            createdAt: t.created_at ? new Date(t.created_at) : undefined,
          })));
        }

        // Popular tracks
        if (popularError) {
          console.error('Error fetching popular tracks:', popularError);
          setPopularTracks([]);
        } else {
          setPopularTracks((popularData || []).map(t => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            album: t.album,
            duration: t.duration || 0,
            cover: t.cover,
            genre: t.genre,
            audioUrl: t.audio_url,
            price: t.price || 0,
            boosted: false,
            createdAt: t.created_at ? new Date(t.created_at) : undefined,
          })));
        }

        // Top charts
        if (topChartsError) {
          console.warn('Top charts query failed (likes column may not exist):', topChartsError);
          setTopChartsTracks([]);
        } else {
          setTopChartsTracks(
            (topChartsData || [])
              .map(t => ({
                track: {
                  id: t.id,
                  title: t.title,
                  artist: t.artist,
                  album: t.album,
                  duration: t.duration || 0,
                  cover: t.cover,
                  genre: t.genre,
                  audioUrl: t.audio_url,
                  price: t.price || 0,
                  boosted: false
                },
                likes: t.likes || 0
              }))
              .filter(item => item.likes > 0)
              .slice(0, 10)
          );
        }
        setIsLoadingTopCharts(false);

        // Public feed
        if (publicErr) {
          console.error('Public feed query failed:', publicErr);
        } else {
          setPublicFeed((publicData || []).map(t => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            album: t.album,
            duration: t.duration || 0,
            cover: t.cover,
            genre: t.genre,
            audioUrl: t.audio_url,
            price: t.price || 0,
            boosted: false,
            createdAt: t.created_at ? new Date(t.created_at) : undefined,
          })));
        }
      } catch (error) {
        console.error('Failed to load home data:', error);
        setRecommendedTracks([]);
        setPopularTracks([]);
      } finally {
        setIsLoadingRecommendations(false);
        setIsLoadingTopCharts(false);
        setIsLoading(false);
      }
    };

    loadPublicData();
    return () => {
      cancelled = true;
      clearTimeout(safetyTimeout);
    };
  }, []);

  // Load user-specific data when the logged-in user changes
  useEffect(() => {
    if (!user) {
      setRecentTracks([]);
      setMostPlayedTracks([]);
      setPublishedTracks([]);
      setIsLoadingPublished(false);
      return;
    }

    let cancelled = false;

    const loadUserData = async () => {
      try {
        setIsLoadingPublished(true);

        const [
          { data: playHistory, error: playHistoryError },
          { data: publishedData, error: publishedError },
        ] = await Promise.all([
          supabase.from('user_play_history').select(`played_at, tracks:track_id (id, title, artist, album, cover, genre, audio_url, duration)`).eq('user_id', user.id).order('played_at', { ascending: false }).limit(50),
          supabase.from('tracks').select('id, title, artist, album, cover, genre, audio_url, duration, price').eq('user_id', user.id).order('created_at', { ascending: false }).limit(4),
        ]);

        if (cancelled) return;

        // Play history
        if (playHistoryError) {
          console.error('Error fetching playHistory:', playHistoryError);
        } else {
          let uniqueRecent: { track: Track, playedAt: string }[] = [];
          const seen = new Set();
          for (const entry of playHistory || []) {
            const t = entry.tracks;
            if (t && !seen.has(t.id)) {
              uniqueRecent.push({
                track: {
                  id: t.id,
                  title: t.title,
                  artist: t.artist,
                  album: t.album,
                  duration: t.duration ?? 0,
                  cover: t.cover,
                  genre: t.genre,
                  audioUrl: t.audio_url,
                  boosted: false
                },
                playedAt: entry.played_at,
              });
              seen.add(t.id);
            }
            if (uniqueRecent.length >= 8) break;
          }
          setRecentTracks(uniqueRecent);

          const playCountMap = new Map<string, { track: Track, playCount: number }>();
          for (const entry of playHistory || []) {
            const t = entry.tracks;
            if (t) {
              const id = t.id;
              if (!playCountMap.has(id)) {
                playCountMap.set(id, {
                  track: {
                    id: t.id,
                    title: t.title,
                    artist: t.artist,
                    album: t.album,
                    duration: t.duration ?? 0,
                    cover: t.cover,
                    genre: t.genre,
                    audioUrl: t.audio_url,
                    boosted: false
                  },
                  playCount: 1,
                });
              } else {
                playCountMap.get(id)!.playCount += 1;
              }
            }
          }
          setMostPlayedTracks(
            Array.from(playCountMap.values()).sort((a, b) => b.playCount - a.playCount).slice(0, 8)
          );
        }

        // Published tracks
        if (publishedError) {
          console.error('Error fetching published tracks:', publishedError);
          setPublishedTracks([]);
        } else {
          setPublishedTracks((publishedData || []).map(t => ({
            id: t.id,
            title: t.title,
            artist: t.artist,
            album: t.album,
            duration: t.duration || 0,
            cover: t.cover,
            genre: t.genre,
            audioUrl: t.audio_url,
            price: t.price || 0,
            boosted: false
          })));
        }
      } catch (error) {
        console.error('Failed to load user home data:', error);
        setRecentTracks([]);
        setMostPlayedTracks([]);
        setPublishedTracks([]);
      } finally {
        if (!cancelled) setIsLoadingPublished(false);
      }
    };

    loadUserData();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Load current user's albums for Top Album Chart (musicians only)
  useEffect(() => {
    const loadAlbums = async () => {
      if (!user || user.role !== 'musician') {
        setAlbums([]);
        return;
      }
      setIsLoadingAlbums(true);
      try {
        const userAlbums = await AlbumService.getUserAlbums(user.id);
        setAlbums(userAlbums);
      } catch (error) {
        console.error('Failed to load albums:', error);
        setAlbums([]);
      } finally {
        setIsLoadingAlbums(false);
      }
    };
    loadAlbums();
  }, [user?.id]);

  const handleAlbumClick = (albumId: string) => {
    navigate(`/albums/${albumId}`);
  };

  // Place this at the top level, not inside return/JSX!
  useEffect(() => {
    try {
      // @ts-ignore
      (window.adsbygoogle = window.adsbygoogle || []).push({});
    } catch (e) {}
  }, []);

  const handlePlayTrack = (track: Track) => {
    playTrack(track);
    if (user) {
      // Optimistically update recently played list without a full page refetch
      const now = new Date().toISOString();
      setRecentTracks(prev => {
        const filtered = prev.filter(r => r.track.id !== track.id);
        return [{ track, playedAt: now }, ...filtered].slice(0, 8);
      });
      MusicService.recordPlayHistory(user.id, track.id, 0, false).catch(console.error);
    }
  };

  const handleAddToQueue = (track: Track) => {
    addToQueue(track);
  };

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    const matches = v.match(/\d{4,16}/g);
    const match = matches?.[0] ?? '';
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(' ');
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, '').replace(/[^0-9]/gi, '');
    if (v.length >= 2) {
      return v.substring(0, 2) + '/' + v.substring(2, 4);
    }
    return v;
  };

  const handlePaymentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setPaymentStep('processing');

    try {
      // Simulate payment processing
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Here you would integrate with your payment service
      // For now, we'll simulate a successful payment
      setPaymentStep('success');
      
      // Close modals after success
      setTimeout(() => {
        setShowPaymentModal(false);
        setPaymentStep('details');
        setCardNumber('');
        setExpiryDate('');
        setCvv('');
        setCardholderName('');
      }, 3000);
      
    } catch (err) {
      setPaymentStep('error');
      setError(err instanceof Error ? err.message : 'Payment failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Get trending users from Supabase
  const [trendingUsers, setTrendingUsers] = useState<User[]>([]);

  // Load trending users
  useEffect(() => {
    const loadTrendingUsers = async () => {
      try {
        const { data: users, error } = await supabase
          .from('users')
          .select('*')
          .order('followers', { ascending: false })
          .limit(3);

        if (error) {
          console.error('Error fetching trending users:', error);
          setTrendingUsers([]);
          return;
        }

        setTrendingUsers(users.map(u => ({
          id: u.id,
          username: u.username,
          email: u.email,
          avatar: u.avatar,
          followers: u.followers || 0,
          following: u.following || 0,
          role: u.role || 'consumer',
          isVerified: u.is_verified || false,
          isPrivate: u.is_private || false,
          artistName: u.artist_name || u.username,
          bio: u.bio || '',
          genres: u.genres || [],
        })));
      } catch (error) {
        console.error('Failed to load trending users:', error);
        setTrendingUsers([]);
      }
    };

    loadTrendingUsers();
  }, []);

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center min-h-[50vh] sm:min-h-screen">
        <div className="flex items-center space-x-2">
          <Loader className="animate-spin text-primary-400" size={24} />
          <span className="text-white text-sm sm:text-base">Loading your music...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-4 sm:px-5 sm:py-5 md:px-6 md:py-6 lg:px-8 space-y-6 sm:space-y-7 md:space-y-8 w-full min-w-0 box-border">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
  
      </motion.div>

      {/* Recent Drops - horizontal scroll at top */}
      <motion.section
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative rounded-2xl overflow-hidden border border-dark-600/80 bg-gradient-to-br from-dark-800/90 via-dark-800/70 to-dark-900/90 shadow-xl"
      >
        {/* Subtle pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" aria-hidden>
          <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 1px, transparent 0)', backgroundSize: '24px 24px' }} />
        </div>
        {/* Accent gradient line */}
        <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary-500/60 to-transparent" />
        <div className="relative px-4 sm:px-6 py-5 sm:py-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary-500/20 text-primary-400 border border-primary-500/30">
              <Music size={22} strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-bold font-kyobo bg-gradient-to-r from-white via-white to-dark-300 bg-clip-text text-transparent">
                Recent Drops
              </h2>
              <h3 className="text-dark-400 text-xs sm:text-sm mt-0.5">
                Fresh uploads from the community — scroll to discover
              </h3>
            </div>
          </div>
          <div className="overflow-x-auto pb-2 mt-4 scrollbar-thin scrollbar-thumb-dark-600 scrollbar-track-transparent">
            <div className="flex items-start gap-4 w-max pl-1 pr-6 sm:pr-8 md:pr-10">
              {publicFeed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-8 rounded-xl bg-dark-700/50 border border-dark-600/50 border-dashed min-w-[280px]">
                  <Music size={40} className="text-dark-500 mb-3" />
                  <p className="text-dark-400 text-sm font-medium">No recent drops yet</p>
                  <p className="text-dark-500 text-xs mt-1">Be the first to upload and share your sound</p>
                </div>
              ) : (
                publicFeed.map((track, index) => (
                  <motion.div
                    key={track.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="flex-shrink-0 w-[180px] sm:w-[200px] self-start min-h-0"
                  >
                    <TrackCard
                      track={track}
                      onPlay={handlePlayTrack}
                      onAddToQueue={handleAddToQueue}
                      isPlaying={player.currentTrack?.id === track.id && player.isPlaying}
                      compactGrid
                      showActions={true}
                    />
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </motion.section>

      {/* Top Album Chart - musicians only, folder-style compiled albums */}
      {user?.role === 'musician' && albums.length > 0 && (
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="mb-8"
        >
          <h2 className="text-xl lg:text-2xl font-bold text-white mb-4 flex items-center font-kyobo">
            <FolderOpen className="mr-2 text-amber-400" />
            Top Album Chart
          </h2>
          <h3 className="text-dark-400 text-sm mb-4">Albums — click to open and play tracks in upload order.</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 lg:gap-4">
            {albums.map((album) => (
              <button
                key={album.id}
                type="button"
                onClick={() => handleAlbumClick(album.id)}
                className="group text-left rounded-xl overflow-hidden bg-dark-800 border border-dark-600 hover:border-amber-500/50 hover:bg-dark-700 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-dark-900"
              >
                {/* Folder-style: tab + body */}
                <div className="relative pt-2 px-2">
                  <div className="h-2 w-12 rounded-t bg-dark-600 group-hover:bg-amber-600/30 transition-colors" aria-hidden />
                </div>
                <div className="relative aspect-square -mt-1 mx-2 mb-2 rounded-lg overflow-hidden bg-dark-700">
                  <img
                    src={album.cover}
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                    <span className="flex items-center gap-1.5 text-white text-sm font-medium">
                      <Play size={18} fill="currentColor" />
                      Open album
                    </span>
                  </div>
                </div>
                <div className="px-3 pb-3">
                  <h3 className="text-white font-semibold truncate" title={album.title}>{album.title}</h3>
                  <p className="text-dark-400 text-xs truncate">{album.artist}</p>
                  <p className="text-dark-500 text-xs mt-0.5">{album.trackCount ?? 0} tracks</p>
                </div>
              </button>
            ))}
          </div>
        </motion.section>
      )}

   {/*   Boost Feature Advertisement
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative overflow-hidden"
      >
        <div className="bg-gradient-to-r from-primary-600 via-purple-600 to-pink-600 rounded-2xl p-8 text-white relative">
          Background Pattern 
          <div className="absolute inset-0 opacity-10">
            <div className="absolute top-4 right-4 w-32 h-32 bg-white rounded-full"></div>
            <div className="absolute bottom-4 left-4 w-24 h-24 bg-white rounded-full"></div>
            <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-16 h-16 bg-white rounded-full"></div>
          </div>
          
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-3 bg-white bg-opacity-20 rounded-full">
                  <Zap className="text-black" size={24} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold font-kyobo">Boost Your Music</h2>
                  <p className="text-black text-opacity-90">Get your tracks featured and reach more listeners</p>
                </div>
              </div>
              <button
                onClick={() => setShowBoostModal(true)}
                className="px-6 py-3 bg-white text-primary-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors"
              >
                Learn More
              </button>
            </div>
          </div>
        </div>
      </motion.section> */} 

      {/* Top 10 Charts */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3">
            <TrendingUp className="text-primary-400" size={24} />
            <h2 className="text-2xl font-bold text-white font-kyobo">Top 10 Charts</h2>
          </div>
          {isLoadingTopCharts && (
            <Loader className="animate-spin text-primary-400" size={20} />
          )}
        </div>
        {topChartsTracks.length > 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="bg-dark-800 rounded-xl p-6 space-y-3"
          >
            {topChartsTracks.map(({ track, likes }, index) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className="flex items-center space-x-4 p-4 bg-dark-700 rounded-lg hover:bg-dark-600 transition-colors cursor-pointer group"
                onClick={() => handlePlayTrack(track)}
              >
                {/* Rank Number */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                  index === 0 
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black' 
                    : index === 1
                    ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-black'
                    : index === 2
                    ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white'
                    : 'bg-dark-600 text-white'
                }`}>
                  {index + 1}
                </div>
                
                {/* Track Cover */}
                <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden">
                  <img
                    src={track.cover}
                    alt={track.title}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                    onError={(e) => {
                      console.error('Failed to load cover image in Top Charts:', track.cover);
                      const target = e.target as HTMLImageElement;
                      target.style.display = 'none';
                      const parent = target.parentElement;
                      if (parent && !parent.querySelector('.fallback-cover-charts')) {
                        const fallback = document.createElement('div');
                        fallback.className = 'fallback-cover-charts w-full h-full flex items-center justify-center bg-dark-600 text-2xl';
                        fallback.textContent = '🎵';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                </div>
                
                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-white truncate font-kotra">
                    {track.title}
                  </p>
                  <p className="text-sm text-dark-400 truncate">
                    {track.artist} {track.album && `• ${track.album}`}
                  </p>
                  {track.genre && (
                    <p className="text-xs text-primary-400 truncate mt-1">{track.genre}</p>
                  )}
                </div>
                
                {/* Likes Count */}
                <div className="flex-shrink-0 flex items-center space-x-2 px-3 py-1.5 bg-dark-600 rounded-full">
                  <ThumbsUp size={16} className="text-primary-400" fill="currentColor" />
                  <span className="text-sm font-semibold text-white">{likes}</span>
                </div>
                
                {/* Play Button */}
                <button
                  className="flex-shrink-0 p-3 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition-colors opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayTrack(track);
                  }}
                >
                  <Play size={18} fill="currentColor" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        ) : !isLoadingTopCharts ? (
          <div className="bg-dark-800 rounded-xl p-6 sm:p-8 text-center">
            <p className="text-dark-400 text-sm sm:text-base">No tracks with likes yet. Be the first to like a track!</p>
          </div>
        ) : null}
      </section>
      {/* Recommended Tracks - horizontal side scroll */}
      <section>
        <div className="flex items-center justify-between mb-4 sm:mb-5 gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white font-kyobo truncate">Recommended for You</h2>
          {isLoadingRecommendations && (
            <Loader className="animate-spin text-primary-400 flex-shrink-0" size={20} />
          )}
        </div>
        {recommendedTracks.length === 0 && !isLoadingRecommendations ? (
          <div className="bg-dark-800 rounded-xl p-6 text-center">
            <p className="text-dark-400 text-sm">No tracks available yet. Upload some music to get started!</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-dark-600 scrollbar-track-transparent">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="flex gap-4 w-max pl-1 pr-6 sm:pr-8 md:pr-10"
            >
              {recommendedTracks.map((track, index) => (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="flex-shrink-0 w-[180px] sm:w-[200px]"
                >
                  <TrackCard
                    track={track}
                    onPlay={handlePlayTrack}
                    onAddToQueue={handleAddToQueue}
                    isPlaying={player.currentTrack?.id === track.id && player.isPlaying}
                    compactGrid
                    showActions={true}
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}
      </section>

      {/* Recently Played (moved up, replaces Published Tracks) */}
      {recentTracks.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-kyobo truncate">Recently Played</h2>
            <Clock className="text-dark-400 flex-shrink-0 w-5 h-5 sm:w-5 sm:h-5" size={20} />
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="space-y-3 sm:space-y-4"
          >
            {recentTracks.map(({ track, playedAt }, index) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
                className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-dark-800 rounded-lg hover:bg-dark-700 transition-colors cursor-pointer"
                onClick={() => handlePlayTrack(track)}
              >
                <img
                  src={track.cover}
                  alt={track.title}
                  className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg object-cover flex-shrink-0"
                  onError={(e) => {
                    console.error('Failed to load cover image in Home:', track.cover);
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent && !parent.querySelector('.fallback-cover-home')) {
                      const fallback = document.createElement('div');
                      fallback.className = 'fallback-cover-home w-10 h-10 sm:w-12 sm:h-12 rounded-lg flex items-center justify-center bg-dark-700 text-lg';
                      fallback.textContent = '🎵';
                      parent.appendChild(fallback);
                    }
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate font-kotra">
                    {track.title}
                  </p>
                  <p className="text-xs text-dark truncate">
                    {track.artist} {track.album && `• ${track.album}`}
                  </p>
                  {track.genre && (
                    <p className="text-xs text-primary-400 truncate hidden sm:block">{track.genre}</p>
                  )}
                  <p className="text-xs text-dark-500 mt-0.5 sm:mt-1">Played {formatDistanceToNow(new Date(playedAt), { addSuffix: true })}</p>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <button 
                    className="p-1.5 sm:p-2 rounded-full bg-primary-600 text-white hover:bg-primary-700 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayTrack(track);
                    }}
                  >
                    <Play size={14} className="sm:w-4 sm:h-4" />
                  </button>
                  <button 
                    className="p-1.5 sm:p-2 rounded-full text-dark-400 hover:text-white transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleAddToQueue(track);
                    }}
                  >
                    <List size={14} className="sm:w-4 sm:h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </section>
      )}

      {/* Popular Tracks - horizontal side scroll */}
      <section>
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white font-kyobo truncate">Popular Tracks</h2>
          <TrendingUp className="text-primary-400 flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6" size={24} />
        </div>
        {popularTracks.length === 0 ? (
          <div className="bg-dark-800 rounded-xl p-6 text-center">
            <p className="text-dark-400 text-sm">No popular tracks yet. Start playing tracks to see them here!</p>
          </div>
        ) : (
          <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-dark-600 scrollbar-track-transparent">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex gap-4 w-max pl-1 pr-6 sm:pr-8 md:pr-10"
            >
              {popularTracks.map((track, index) => (
                <motion.div
                  key={track.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 + index * 0.03 }}
                  className="flex-shrink-0 w-[180px] sm:w-[200px]"
                >
                  <TrackCard
                    track={track}
                    onPlay={handlePlayTrack}
                    onAddToQueue={handleAddToQueue}
                    isPlaying={player.currentTrack?.id === track.id && player.isPlaying}
                    compactGrid
                  />
                </motion.div>
              ))}
            </motion.div>
          </div>
        )}
      </section>

      {/* Trending Artists */}
      <section>
        <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white font-kyobo truncate">Trending Users</h2>
          <TrendingUp className="text-primary-400 flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6" size={24} />
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-6"
        >
          {trendingUsers.map((user, index) => (
            <motion.div
              key={user.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.5 + index * 0.1 }}
            >
              <UserCard user={user} />
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* Boosted Tracks 
      {recommendedTracks.filter(track => track.boosted).length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <Zap className="text-yellow-400" size={24} />
              <h2 className="text-2xl font-bold text-white font-kyobo">Featured Tracks</h2>
            </div>
            <div className="flex items-center space-x-2">
              <div className="px-2 py-1 bg-yellow-400 text-black text-xs font-bold rounded-full">
                BOOSTED
              </div>
            </div>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
          >
            {recommendedTracks.filter(track => track.boosted).map((track, index) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 + index * 0.1 }}
              >
                <TrackCard 
                  track={track} 
                  onPlay={handlePlayTrack}
                  onAddToQueue={handleAddToQueue}
                  showBoostActions={false}
                />
              </motion.div>
            ))}
          </motion.div>
        </section> 
      )} */}

      {/* Google AdSense Ad - Under Home Page Content */}
      <div className="my-6 sm:my-8 flex justify-center px-0 sm:px-2">
        <ins className="adsbygoogle"
          style={{ display: 'block', minHeight: 90, width: '100%', maxWidth: 728 }}
          data-ad-client="ca-pub-3981993675235210"
          data-ad-slot="YOUR_SLOT_ID"
          data-ad-format="auto"
          data-full-width-responsive="true"></ins>
      </div>

      {/* Boost Feature Modal */}
      {showBoostModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-dark-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto my-auto"
          >
            <div className="p-4 sm:p-6 md:p-8">
              <div className="flex items-center justify-between gap-3 mb-4 sm:mb-6">
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                  <div className="p-2 sm:p-3 bg-gradient-to-r from-primary-600 to-purple-600 rounded-full flex-shrink-0">
                    <Zap className="text-white w-5 h-5 sm:w-6 sm:h-6" size={24} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-white font-kyobo truncate">Boost Your Music</h2>
                    <p className="text-dark-400 text-sm sm:text-base truncate">Premium promotion for artists</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowBoostModal(false)}
                  className="p-2 text-dark-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              <div className="space-y-6">
                {/* Pricing Section */}
                <div className="bg-dark-800 rounded-xl p-6">
                  <h3 className="text-xl font-bold text-white mb-4">Pricing</h3>
                  <div className="text-center">
                    <div className="text-4xl font-bold text-primary-400 mb-2">$10</div>
                    <div className="text-dark-400 mb-4">per month</div>
                    <div className="text-sm text-white space-y-2">
                      {/*<p>• Boost up to 5 tracks per month</p>*/}
                      <p>• Featured placement in recommendations</p>
                      <p>• Priority in curated playlists</p>
                      <p>• Analytics and insights</p>
                    </div>
                  </div>
                </div>

                {/* Features Section */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white mb-4">What You Get</h3>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                          <Star className="text-white" size={16} />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">Featured Placement</h4>
                          <p className="text-sm text-dark-400">Your tracks appear at the top of recommendations</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                          <Users className="text-white" size={16} />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">Reach More Listeners</h4>
                          <p className="text-sm text-dark-400">Get discovered by new audiences</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center">
                          <Music className="text-white" size={16} />
                        </div>
                        <div>
                          <h4 className="font-medium text-white">Playlist Priority</h4>
                          <p className="text-sm text-dark-400">Your tracks featured in curated playlists</p>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-white mb-4">How It Works</h3>
                    <div className="space-y-3">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-dark-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          1
                        </div>
                        <div>
                          <h4 className="font-medium text-white">Subscribe</h4>
                          <p className="text-sm text-dark-400">Choose the $10/month plan</p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-dark-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          2
                        </div>
                        <div>
                          <h4 className="font-medium text-white">Select Tracks</h4>
                          {/*<p className="text-sm text-dark-400">Choose up to 5 tracks to boost</p>*/}
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-dark-700 rounded-full flex items-center justify-center text-white font-bold text-sm">
                          3
                        </div>
                        <div>
                          <h4 className="font-medium text-white">Get Featured</h4>
                          <p className="text-sm text-dark-400">Your tracks get promoted automatically</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            className="bg-dark-900 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto my-auto"
          >
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between gap-2 mb-4 sm:mb-6">
                <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
                  <div className="p-2 sm:p-3 bg-gradient-to-r from-primary-600 to-purple-600 rounded-full flex-shrink-0">
                    <Zap className="text-white w-5 h-5 sm:w-6 sm:h-6" size={24} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold text-white font-kyobo truncate">Boost Subscription</h2>
                    <p className="text-dark-400 text-sm sm:text-base truncate">Complete your payment</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPaymentModal(false)}
                  className="p-2 text-dark-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {paymentStep === 'details' && (
                <form onSubmit={handlePaymentSubmit} className="space-y-4">
                  {/* Order Summary */}
                  <div className="bg-dark-800 rounded-lg p-4 space-y-2">
                    <h4 className="text-sm font-medium text-white mb-3">Order Summary</h4>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Boost Subscription:</span>
                      <span className="text-white">$10.00</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-dark-400">Tax:</span>
                      <span className="text-white">$0.00</span>
                    </div>
                    <div className="border-t border-dark-600 pt-2 flex justify-between font-medium">
                      <span className="text-white">Total:</span>
                      <span className="text-primary-400">$10.00</span>
                    </div>
                  </div>

                  {/* Payment Form */}
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Cardholder Name *
                    </label>
                    <input
                      type="text"
                      value={cardholderName}
                      onChange={(e) => setCardholderName(e.target.value)}
                      className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="John Doe"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-white mb-2">
                      Card Number *
                    </label>
                    <div className="relative">
                      <CreditCard className="absolute left-3 top-1/2 transform -translate-y-1/2 text-dark-400" size={20} />
                      <input
                        type="text"
                        value={cardNumber}
                        onChange={(e) => setCardNumber(formatCardNumber(e.target.value))}
                        className="w-full pl-10 pr-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="1234 5678 9012 3456"
                        maxLength={19}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        Expiry Date *
                      </label>
                      <input
                        type="text"
                        value={expiryDate}
                        onChange={(e) => setExpiryDate(formatExpiryDate(e.target.value))}
                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="MM/YY"
                        maxLength={5}
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-white mb-2">
                        CVV *
                      </label>
                      <input
                        type="text"
                        value={cvv}
                        onChange={(e) => setCvv(e.target.value.replace(/\D/g, ''))}
                        className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-400 focus:outline-none focus:ring-2 focus:ring-primary-500"
                        placeholder="123"
                        maxLength={4}
                        required
                      />
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2 text-sm text-dark-400">
                    <Lock size={16} />
                    <span>Your payment information is secure and encrypted</span>
                  </div>
                  
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary-600 text-white py-3 rounded-lg hover:bg-primary-700 disabled:bg-dark-600 disabled:cursor-not-allowed transition-colors font-semibold flex items-center justify-center space-x-2"
                  >
                    {loading ? (
                      <>
                        <Loader className="animate-spin" size={20} />
                        <span>Processing...</span>
                      </>
                    ) : (
                      <span>Pay $10.00</span>
                    )}
                  </button>
                </form>
              )}

              {paymentStep === 'processing' && (
                <div className="text-center py-8">
                  <Loader className="animate-spin mx-auto mb-4" size={48} />
                  <h3 className="text-xl font-semibold text-white mb-2">Processing Payment</h3>
                  <p className="text-dark-400">Please wait while we process your payment...</p>
                </div>
              )}

              {paymentStep === 'success' && (
                <div className="text-center py-8">
                  <CheckCircle className="mx-auto mb-4 text-green-500" size={48} />
                  <h3 className="text-xl font-semibold text-white mb-2">Payment Successful!</h3>
                  <p className="text-dark-400 mb-4">Your boost subscription has been activated.</p>
                  <p className="text-sm text-dark-400">You can now boost up to 5 tracks per month!</p>
                </div>
              )}

              {paymentStep === 'error' && (
                <div className="text-center py-8">
                  <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
                  <h3 className="text-xl font-semibold text-white mb-2">Payment Failed</h3>
                  <p className="text-red-400 mb-4">{error}</p>
                  <button
                    onClick={() => setPaymentStep('details')}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Try Again
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default Home;