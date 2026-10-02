import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { Play, Clock, TrendingUp, Loader, Music, List, ThumbsUp, FolderOpen, Search /* , ShoppingBag — Storefront paused */ } from 'lucide-react';
import { useStore } from '../store/useStore';
import TrackCard from '../components/music/TrackCard';
import { Track } from '../store/useStore';
import { MusicService } from '../services/musicService';
import { AlbumService, Album } from '../services/albumService';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '../services/supabase';
import { isMusicianRole } from '../utils/userRole';

const Home: React.FC = () => {
  const { playTrack, addToQueue, player, user, setSettingsOpen, setSettingsInitialTab } = useStore();
  const { t } = useTranslation();
  const [recommendedTracks, setRecommendedTracks] = useState<Track[]>([]);
  const [recentTracks, setRecentTracks] = useState<{ track: Track, playedAt: string }[]>([]);
  const [popularTracks, setPopularTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingRecommendations, setIsLoadingRecommendations] = useState(true);
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
          supabase.from('tracks').select('id, title, artist, album, cover, genre, audio_url, duration, license_type, allow_remix, remix_parent_id, user_id, price, created_at').limit(8).order('created_at', { ascending: false }),
          supabase.rpc('get_popular_tracks', { limit_count: 4 }),
          supabase.from('tracks').select('id, title, artist, album, cover, genre, audio_url, duration, license_type, allow_remix, remix_parent_id, user_id, price, likes, liked_by').order('likes', { ascending: false, nullsFirst: false }).limit(10),
          supabase.from('tracks').select('id, title, artist, album, cover, genre, audio_url, duration, license_type, allow_remix, remix_parent_id, user_id, price, created_at').order('created_at', { ascending: false }).limit(12),
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
            licenseType: t.license_type,
            allowRemix: t.allow_remix,
            remixParentId: t.remix_parent_id,
            userId: t.user_id,
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
            licenseType: t.license_type,
            allowRemix: t.allow_remix,
            remixParentId: t.remix_parent_id,
            userId: t.user_id,
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
                  licenseType: t.license_type,
                  allowRemix: t.allow_remix,
                  remixParentId: t.remix_parent_id,
                  userId: t.user_id,
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
            licenseType: t.license_type,
            allowRemix: t.allow_remix,
            remixParentId: t.remix_parent_id,
            userId: t.user_id,
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
      return;
    }

    let cancelled = false;

    const loadUserData = async () => {
      try {
        const { data: playHistory, error: playHistoryError } = await supabase
          .from('user_play_history')
          .select(`played_at, tracks:track_id (id, title, artist, album, cover, genre, audio_url, duration, license_type, allow_remix, remix_parent_id, user_id)`)
          .eq('user_id', user.id)
          .order('played_at', { ascending: false })
          .limit(50);

        if (cancelled) return;

        if (playHistoryError) {
          console.error('Error fetching playHistory:', playHistoryError);
          return;
        }

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
                licenseType: t.license_type,
                allowRemix: t.allow_remix,
                remixParentId: t.remix_parent_id,
                userId: t.user_id,
                boosted: false
              },
              playedAt: entry.played_at,
            });
            seen.add(t.id);
          }
          if (uniqueRecent.length >= 8) break;
        }
        setRecentTracks(uniqueRecent);
      } catch (error) {
        console.error('Failed to load user home data:', error);
        setRecentTracks([]);
      }
    };

    loadUserData();
    return () => { cancelled = true; };
  }, [user?.id]);

  // Load current user's albums for Top Album Chart (musicians only)
  useEffect(() => {
    const loadAlbums = async () => {
      if (!user || !isMusicianRole(user.role)) {
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

  if (isLoading) {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center min-h-[50vh] sm:min-h-screen">
        <div className="flex items-center space-x-2">
          <Loader className="animate-spin text-primary-400" size={24} />
          <span className="text-black text-sm sm:text-base">{t('home.loading')}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="px-3 py-4 sm:px-5 sm:py-5 md:px-6 md:py-6 lg:px-8 space-y-6 sm:space-y-7 md:space-y-8 w-full min-w-0 box-border">

      {/* Re-Mixed Logo Header */}
      <div className="flex items-center gap-3">
        <img
          src="/logo/logo.png"
          alt="Re-Mixed"
          className="h-10 sm:h-12 w-10 sm:w-12 object-cover rounded-full"
        />
        <h1>Re-Mixed</h1>
        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => navigate('/search')}
            className="flex items-center justify-center w-10 h-10 rounded-xl text-black/70 hover:text-black hover:bg-dark-700 active:scale-95 transition-all duration-200"
            aria-label="Search"
          >
            <Search size={22} strokeWidth={2} />
          </button>
          {/* Storefront paused — link hidden until sales reopen.
          <button
            onClick={() => navigate('/storefront')}
            className="flex items-center justify-center w-10 h-10 rounded-xl text-black/70 hover:text-black hover:bg-dark-700 active:scale-95 transition-all duration-200"
            aria-label="Storefront"
          >
            <ShoppingBag size={22} strokeWidth={2} />
          </button>
          */}
        </div>
      </div>

      {/* Pro banner — upgrade CTA for free users, status for pro users */}
      {user && (
        user.subscriptionTier === 'artist' ? (
          <button
            type="button"
            onClick={() => { setSettingsInitialTab('pro'); setSettingsOpen(true); }}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-yellow-500/15 to-yellow-600/5 border border-yellow-500/40 hover:border-yellow-500/70 hover:from-yellow-500/20 shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl flex-shrink-0">★</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-black leading-tight">Subscribed to Re-Mixed Pro!</p>
                <p className="text-xs text-black/40 truncate mt-0.5">Unlimited uploads · Priority Discover · Analytics</p>
              </div>
            </div>
            <span className="flex-shrink-0 text-xs font-bold text-black bg-yellow-500/20 border border-yellow-500/30 px-2.5 py-1 rounded-full whitespace-nowrap">
              Manage subscription
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => navigate('/upgrade')}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-gradient-to-r from-yellow-500/10 to-yellow-600/5 border border-yellow-500/30 hover:border-yellow-500/60 hover:from-yellow-500/15 shadow-md transition-all text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xl flex-shrink-0">★</span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-yellow-400 leading-tight">Unlock Re-Mixed Pro</p>
                <p className="text-xs text-black/40 truncate mt-0.5">Unlimited uploads · Priority Discover · Analytics</p>
              </div>
            </div>
            <span className="flex-shrink-0 text-xs font-bold text-yellow-400 bg-yellow-500/20 border border-yellow-500/30 px-2.5 py-1 rounded-full whitespace-nowrap">
              Go Pro →
            </span>
          </button>
        )
      )}

      {/* Now Playing hero — mobile only, shown when a track is active */}
      {player.currentTrack && (
        <motion.section
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="lg:hidden rounded-2xl overflow-hidden relative border border-dark-700 shadow-lg"
        >
          {/* Blurred album art background */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${player.currentTrack.cover || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop'})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'blur(20px) brightness(0.3)',
            }}
          />
          <div className="relative flex items-center gap-4 p-4">
            <button
              onClick={() => playTrack(player.currentTrack!)}
              className="flex-shrink-0 w-16 h-16 rounded-xl overflow-hidden shadow-lg ring-2 ring-white/20 active:scale-95 transition-transform"
            >
              <img
                src={player.currentTrack.cover || 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=400&fit=crop'}
                alt={player.currentTrack.title}
                className="w-full h-full object-cover"
              />
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-semibold text-black/50 uppercase tracking-widest mb-0.5">
                {player.isPlaying ? t('home.nowPlaying') : t('home.paused')}
              </p>
              <p className="text-black font-bold truncate">{player.currentTrack.title}</p>
              <p className="text-black/60 text-sm truncate">{player.currentTrack.artist}</p>
            </div>
          </div>
        </motion.section>
      )}

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
              <h2 className="text-xl sm:text-2xl font-bold font-kyobo text-black">
                {t('home.recentDrops')}
              </h2>
              <h3 className="text-black text-xs sm:text-sm mt-0.5">
                {t('home.recentDropsSubtitle')}
              </h3>
            </div>
          </div>
          <div className="overflow-x-auto pb-2 mt-4 scrollbar-thin scrollbar-thumb-dark-600 scrollbar-track-transparent">
            <div className="flex items-start gap-4 w-max pl-1 pr-6 sm:pr-8 md:pr-10">
              {publicFeed.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-8 rounded-xl bg-dark-700/50 border border-dark-600/50 border-dashed min-w-[280px]">
                  <Music size={40} className="text-dark-500 mb-3" />
                  <p className="text-dark-400 text-sm font-medium">{t('home.noRecentDrops')}</p>
                  <p className="text-dark-500 text-xs mt-1">{t('home.noRecentDropsSubtitle')}</p>
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
          <h2 className="text-xl lg:text-2xl font-bold text-black mb-4 flex items-center font-kyobo">
            <FolderOpen className="mr-2 text-amber-400" />
            {t('home.topAlbumChart')}
          </h2>
          <h3 className="text-dark-400 text-sm mb-4">{t('home.topAlbumChartSubtitle')}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 lg:gap-4">
            {albums.map((album) => (
              <button
                key={album.id}
                type="button"
                onClick={() => handleAlbumClick(album.id)}
                className="group text-left rounded-xl overflow-hidden bg-dark-800 border border-dark-600 hover:border-amber-500/50 hover:bg-dark-700 shadow-sm hover:shadow-md transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:ring-offset-2 focus:ring-offset-dark-900"
              >
                {/* Folder-style: tab + body */}
                <div className="relative pt-2 px-2">
                  <div className="h-2 w-12 rounded-t bg-white group-hover:bg-amber-600/30 transition-colors" aria-hidden />
                </div>
                <div className="relative aspect-square -mt-1 mx-2 mb-2 rounded-lg overflow-hidden bg-dark-700">
                  <img
                    src={album.cover}
                    alt={album.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                    <span className="flex items-center gap-1.5 text-black text-sm font-medium">
                      <Play size={18} fill="currentColor" />
                      {t('home.openAlbum')}
                    </span>
                  </div>
                </div>
                <div className="px-3 pb-3">
                  <h3 className="text-black font-semibold truncate" title={album.title}>{album.title}</h3>
                  <p className="text-dark-400 text-xs truncate">{album.artist}</p>
                  <p className="text-dark-500 text-xs mt-0.5">{t('home.tracks', { count: album.trackCount ?? 0 })}</p>
                </div>
              </button>
            ))}
          </div>
        </motion.section>
      )}

      {/* Top 10 Charts */}
      <section>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center space-x-3">
            <TrendingUp className="text-primary-400" size={24} />
            <h2 className="text-2xl font-bold text-black font-kyobo">{t('home.top10Charts')}</h2>
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
            className="space-y-3"
          >
            {topChartsTracks.map(({ track, likes }, index) => (
              <motion.div
                key={track.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className="flex items-center space-x-4 p-4 rounded-lg bg-white hover:bg-green-300 shadow-sm hover:shadow-md transition-shadow cursor-pointer group"
                onClick={() => handlePlayTrack(track)}
              >
                {/* Rank Number */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg ${
                  index === 0
                    ? 'bg-gradient-to-r from-yellow-400 to-yellow-600 text-black'
                    : index === 1
                    ? 'bg-gradient-to-r from-gray-300 to-gray-400 text-black'
                    : index === 2
                    ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-black'
                    : 'bg-gray-200 text-black'
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
                        fallback.className = 'fallback-cover-charts w-full h-full flex items-center justify-center bg-gray-200 text-2xl';
                        fallback.textContent = '🎵';
                        parent.appendChild(fallback);
                      }
                    }}
                  />
                </div>

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-base font-semibold text-black truncate font-kotra">
                    {track.title}
                  </p>
                  <p className="text-sm text-gray-500 truncate">
                    {track.artist} {track.album && `• ${track.album}`}
                  </p>
                  {track.genre && (
                    <p className="text-xs text-primary-400 truncate mt-1">{track.genre}</p>
                  )}
                </div>

                {/* Likes Count */}
                <div className="flex-shrink-0 flex items-center space-x-2 px-3 py-1.5 bg-gray-100 rounded-full">
                  <ThumbsUp size={16} className="text-primary-400" fill="currentColor" />
                  <span className="text-sm font-semibold text-black">{likes}</span>
                </div>

                {/* Play Button */}
                <button
                  className="flex-shrink-0 p-3 rounded-full bg-primary-600 text-black hover:bg-primary-700 transition-colors opacity-0 group-hover:opacity-100"
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
          <div className="bg-white rounded-xl p-6 sm:p-8 text-center shadow-sm">
            <p className="text-gray-500 text-sm sm:text-base">{t('home.noTracksWithLikes')}</p>
          </div>
        ) : null}
      </section>
      {/* Recommended Tracks - horizontal side scroll */}
      <section>
        <div className="flex items-center justify-between mb-4 sm:mb-5 gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-black font-kyobo truncate">{t('home.recommendedForYou')}</h2>
          {isLoadingRecommendations && (
            <Loader className="animate-spin text-primary-400 flex-shrink-0" size={20} />
          )}
        </div>
        {recommendedTracks.length === 0 && !isLoadingRecommendations ? (
          <div className="bg-dark-800 rounded-xl p-6 text-center shadow-sm">
            <p className="text-dark-400 text-sm">{t('home.noTracksAvailable')}</p>
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
            <h2 className="text-xl sm:text-2xl font-bold text-black font-kyobo truncate">{t('home.recentlyPlayed')}</h2>
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
                className="flex items-center gap-3 sm:gap-4 p-3 sm:p-4 bg-white rounded-lg hover:bg-green-300 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
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
                  <p className="text-sm font-medium text-black truncate font-kotra">
                    {track.title}
                  </p>
                  <p className="text-xs text-black truncate">
                    {track.artist} {track.album && `• ${track.album}`}
                  </p>
                  {track.genre && (
                    <p className="text-xs text-primary-400 truncate hidden sm:block">{track.genre}</p>
                  )}
                  <p className="text-xs text-dark-500 mt-0.5 sm:mt-1">{t('home.played', { time: formatDistanceToNow(new Date(playedAt), { addSuffix: true }) })}</p>
                </div>
                <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
                  <button 
                    className="p-1.5 sm:p-2 rounded-full bg-primary-600 text-black hover:bg-primary-700 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handlePlayTrack(track);
                    }}
                  >
                    <Play size={14} className="sm:w-4 sm:h-4" />
                  </button>
                  <button 
                    className="p-1.5 sm:p-2 rounded-full text-dark-400 hover:text-black transition-colors"
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
          <h2 className="text-xl sm:text-2xl font-bold text-black font-kyobo truncate">{t('home.popularTracks')}</h2>
          <TrendingUp className="text-primary-400 flex-shrink-0 w-5 h-5 sm:w-6 sm:h-6" size={24} />
        </div>
        {popularTracks.length === 0 ? (
          <div className="bg-dark-800 rounded-xl p-6 text-center shadow-sm">
            <p className="text-dark-400 text-sm">{t('home.noPopularTracks')}</p>
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
    </div>
  );
};

export default Home;