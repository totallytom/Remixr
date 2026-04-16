import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Users, Music, Loader, User as UserIcon, MessageCircle, Calendar, MapPin } from 'lucide-react';
import { mockTracks } from '../data/mockData';
import TrackCard from '../components/music/TrackCard';
import SearchBar, { SearchCategory } from '../components/search/SearchBar';
import { useStore } from '../store/useStore';
import { Track, User } from '../store/useStore';
import { ChatService } from '../services/chatService';
import { MusicService } from '../services/musicService';
import { ConcertService, ConcertWithUser } from '../services/concertService';
import { supabase } from '../services/supabase';
import { getAvatarUrl } from '../utils/avatar';
import VerifiedBadge from '../components/VerifiedBadge';

export type FilterChip = 'top' | 'tracks' | 'albums' | 'artists' | 'profiles' | 'venues';

const FILTER_CHIPS: { id: FilterChip; label: string }[] = [
  { id: 'top', label: 'Top Results' },
  { id: 'tracks', label: 'Tracks' },
  { id: 'albums', label: 'Albums' },
  { id: 'artists', label: 'Artists' },
  { id: 'profiles', label: 'Profiles' },
  { id: 'venues', label: 'Venues' },
];

const Search: React.FC = () => {
  const { playTrack, addToQueue, player, user: currentUser } = useStore();
  const [search, setSearch] = useState('');
  const [selectedGenre, setSelectedGenre] = useState<string | null>(null);
  const [category, setCategory] = useState<SearchCategory>('music');
  const [filterChip, setFilterChip] = useState<FilterChip>('top');
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [allTracks, setAllTracks] = useState<Track[]>([]);
  const [filteredTracks, setFilteredTracks] = useState<Track[]>([]);
  const [availableGenres, setAvailableGenres] = useState<string[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [featuredArtists, setFeaturedArtists] = useState<User[]>([]);
  const [isLoadingArtists, setIsLoadingArtists] = useState(false);
  const [concerts, setConcerts] = useState<ConcertWithUser[]>([]);
  const [isLoadingConcerts, setIsLoadingConcerts] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Effective view: when category is 'all', filter chip decides section; otherwise category
  const effectiveView: 'music' | 'users' | 'concerts' =
    category === 'all'
      ? filterChip === 'profiles'
        ? 'users'
        : filterChip === 'venues'
        ? 'concerts'
        : 'music'
      : category === 'users'
      ? 'users'
      : category === 'concerts'
      ? 'concerts'
      : 'music';

  // Handle tab parameter from URL
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'users' || tabParam === 'music' || tabParam === 'concerts') {
      setCategory(tabParam);
    }
  }, [searchParams]);

  // Keep filter chip in sync with category (e.g. when switching to Users, select Profiles)
  useEffect(() => {
    if (category === 'users' && filterChip !== 'profiles') setFilterChip('profiles');
    if (category === 'concerts' && filterChip !== 'venues') setFilterChip('venues');
    if (category === 'music' && !['top', 'tracks', 'albums', 'artists'].includes(filterChip)) setFilterChip('top');
  }, [category]);

  // Load available genres
  useEffect(() => {
    const loadGenres = async () => {
      try {
        const genres = await MusicService.getAvailableGenres();
        setAvailableGenres(genres);
      } catch (error) {
        console.error('Failed to load genres:', error);
        // Fallback to mock genres
        setAvailableGenres(['Electronic', 'Pop', 'Rock', 'Hip Hop', 'R&B', 'Jazz', 'Classical']);
      }
    };

    loadGenres();
  }, []);

  // Load all tracks when music view is relevant
  useEffect(() => {
    const loadTracks = async () => {
      if (effectiveView === 'music') {
        setIsLoadingTracks(true);
        try {
          const tracks = await MusicService.getTracks(30);
          setAllTracks(tracks);
          setFilteredTracks(tracks);
        } catch (error) {
          console.error('Failed to load tracks:', error);
          setAllTracks(mockTracks);
          setFilteredTracks(mockTracks);
        } finally {
          setIsLoadingTracks(false);
        }
      }
    };

    loadTracks();
  }, [effectiveView]);

  const loadUsers = useCallback(async () => {
    setIsLoadingUsers(true);
    try {
      // Load suggested users only (~5) for discovery
      const users = await ChatService.searchUsers('', currentUser?.id || '', 5);
      setAllUsers(users);
      setFilteredUsers(users);
    } catch (error) {
      console.error('Failed to load suggested users:', error);
    } finally {
      setIsLoadingUsers(false);
    }
  }, [currentUser]);

  // Load all users when users view is relevant
  useEffect(() => {
    if (effectiveView === 'users') {
      loadUsers();
    }
  }, [effectiveView, loadUsers]);

  // Load concerts when concerts view is active
  useEffect(() => {
    const loadConcerts = async () => {
      if (effectiveView !== 'concerts') return;
      setIsLoadingConcerts(true);
      try {
        const all = await ConcertService.getAllConcerts(50);
        setConcerts(all);
      } catch (error) {
        console.error('Failed to load concerts:', error);
        setConcerts([]);
      } finally {
        setIsLoadingConcerts(false);
      }
    };
    loadConcerts();
  }, [effectiveView]);

  useEffect(() => {
    const fetchFeaturedArtists = async () => {
      setIsLoadingArtists(true);
      try {
        const { data, error } = await supabase
          .from('users')
          .select('*')
          .eq('role', 'musician')
          .limit(8);
        if (error) throw error;
        setFeaturedArtists(
          (data || []).map((artist: any) => ({
            id: artist.id,
            username: artist.username,
            email: artist.email,
            avatar: artist.avatar,
            followers: artist.followers,
            following: artist.following,
            role: artist.role,
            isVerified: artist.is_verified,
            isVerifiedArtist: artist.is_verified_artist ?? false,
            isPrivate: artist.is_private,
            artistName: artist.artist_name,
            bio: artist.bio,
            genres: artist.genres,
            stripeCustomerId: artist.stripe_customer_id,
          }))
        );
      } catch (err) {
        setFeaturedArtists([]);
      } finally {
        setIsLoadingArtists(false);
      }
    };
    fetchFeaturedArtists();
  }, []);

  // Search functionality
  const handleSearch = useCallback(async (query: string) => {
    if (effectiveView === 'music' && query.trim()) {
      setIsSearching(true);
      try {
        const searchResults = await MusicService.searchTracks(query, 50);
        setFilteredTracks(searchResults);
      } catch (error) {
        console.error('Search failed:', error);
        const filtered = allTracks.filter(track =>
          track.title.toLowerCase().includes(query.toLowerCase()) ||
          track.artist.toLowerCase().includes(query.toLowerCase()) ||
          track.genre.toLowerCase().includes(query.toLowerCase()) ||
          (track.album && track.album.toLowerCase().includes(query.toLowerCase()))
        );
        setFilteredTracks(filtered);
      } finally {
        setIsSearching(false);
      }
    } else if (effectiveView === 'users') {
      if (!currentUser) return;
      const q = query.trim();
      if (q) {
        setIsSearching(true);
        try {
          const searchResults = await ChatService.searchUsers(q, currentUser.id, 100);
          setFilteredUsers(searchResults);
        } catch (error) {
          console.error('User search failed:', error);
          setFilteredUsers([]);
        } finally {
          setIsSearching(false);
        }
      } else {
        setFilteredUsers(allUsers);
      }
    }
  }, [effectiveView, allTracks, allUsers, currentUser]);

  // Debounced search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (search.trim()) {
        handleSearch(search);
      } else {
        if (effectiveView === 'music') {
          setFilteredTracks(allTracks);
        } else if (effectiveView === 'users') {
          setFilteredUsers(allUsers);
        }
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [search, handleSearch, effectiveView, allTracks, allUsers]);

  // Filter by genre (music view); default sort: Newest First
  useEffect(() => {
    if (effectiveView === 'music') {
      let filtered = allTracks;
      if (selectedGenre) {
        filtered = filtered.filter(track => track.genre === selectedGenre);
      }
      if (search.trim()) {
        filtered = filtered.filter(track =>
          track.title.toLowerCase().includes(search.toLowerCase()) ||
          track.artist.toLowerCase().includes(search.toLowerCase()) ||
          track.genre.toLowerCase().includes(search.toLowerCase())
        );
      }
      // Newest first: sort by createdAt descending
      const sorted = [...filtered].sort((a, b) => {
        const tA = (a as { createdAt?: Date }).createdAt?.getTime() ?? 0;
        const tB = (b as { createdAt?: Date }).createdAt?.getTime() ?? 0;
        return tB - tA;
      });
      setFilteredTracks(sorted);
    }
  }, [selectedGenre, search, allTracks, effectiveView]);

  const handleArtistClick = (artistId: string) => {
    navigate(`/artist/${artistId}`);
  };

  const handleUserClick = (userId: string) => {
    // If clicking on own profile, navigate to /profile (My Profile)
    // Otherwise navigate to /profile/{userId} (viewing another user's profile)
    if (currentUser && userId === currentUser.id) {
      navigate('/profile');
    } else {
      navigate(`/profile/${userId}`);
    }
  };

  const handlePlayTrack = (track: Track) => {
    playTrack(track);
    // Record play history
    if (currentUser) {
      MusicService.recordPlayHistory(currentUser.id, track.id, 0, false).catch(console.error);
    }
  };

  const handleAddToQueue = (track: Track) => {
    addToQueue(track);
  };

  const handleStartChat = async (otherUser: User) => {
    if (!currentUser) {
      // Redirect to login if not authenticated
      navigate('/login');
      return;
    }
    
    try {
      await ChatService.sendMessage({
        senderId: currentUser.id,
        receiverId: otherUser.id,
        content: '👋',
      });
      
      navigate('/chat');
    } catch (error) {
      console.error('Failed to start chat:', error);
    }
  };

  const clearSearch = () => {
    setSearch('');
    setSelectedGenre(null);
  };

  // Which filter chips to show based on category
  const visibleChips =
    category === 'all'
      ? FILTER_CHIPS
      : category === 'music'
      ? FILTER_CHIPS.filter((c) => ['top', 'tracks', 'albums', 'artists'].includes(c.id))
      : category === 'users'
      ? FILTER_CHIPS.filter((c) => c.id === 'profiles')
      : FILTER_CHIPS.filter((c) => c.id === 'venues');

  return (
    <div className="px-3 py-4 sm:px-5 sm:py-5 md:p-6 space-y-6 sm:space-y-8 max-w-[100vw] overflow-x-hidden">
      {/* Sticky search header — search bar + filter chips stay visible while scrolling results */}
      <div className="sticky top-0 z-10 bg-dark-900/95 backdrop-blur-sm -mx-3 sm:-mx-5 md:-mx-6 px-3 sm:px-5 md:px-6 py-3 space-y-3 border-b border-dark-700/50">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl sm:text-3xl font-bold gradient-text font-kyobo text-white truncate">Search</h1>
        </div>

        {/* Omni-search bar */}
        <SearchBar
          value={search}
          onChange={setSearch}
          onClear={clearSearch}
          category={category}
          onCategoryChange={setCategory}
          placeholder="Search for music, people, or events..."
          isSearching={isSearching}
          disabled={effectiveView === 'users' && !currentUser}
        />

        {/* Filter chips with right-edge fade gradient as scroll indicator */}
        <div className="relative">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {visibleChips.map((chip) => (
              <button
                key={chip.id}
                onClick={() => setFilterChip(chip.id)}
                className={`flex-shrink-0 px-4 h-11 rounded-full text-sm font-medium transition-colors border ${
                  filterChip === chip.id
                    ? 'bg-lime-400/20 text-lime-400 border-lime-400/40'
                    : 'bg-dark-800 text-dark-300 border-dark-600 hover:text-white hover:border-dark-500'
                }`}
              >
                {chip.label}
              </button>
            ))}
          </div>
          {/* Fade gradient — scroll affordance indicator */}
          <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-dark-900 to-transparent pointer-events-none" />
        </div>
      </div>

      {/* Content */}
      {effectiveView === 'music' && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-white font-kyobo">Search Results</h2>
            {isLoadingTracks && <Loader className="animate-spin text-lime-400" size={20} />}
          </div>

          {filteredTracks.length === 0 && !isLoadingTracks ? (
            <div className="text-center py-12">
              <p className="text-dark-400 text-lg">No tracks found</p>
              <p className="text-dark-500 text-sm mt-2">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              {/* Mobile (< sm): compact horizontal row list — more results per screen */}
              <div className="sm:hidden space-y-2">
                {filteredTracks.map(track => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    onPlay={handlePlayTrack}
                    onAddToQueue={handleAddToQueue}
                    isPlaying={player.currentTrack?.id === track.id && player.isPlaying}
                  />
                ))}
              </div>
              {/* Tablet/Desktop (>= sm): square card grid */}
              <div className="hidden sm:grid sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                {filteredTracks.map(track => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    onPlay={handlePlayTrack}
                    onAddToQueue={handleAddToQueue}
                    isPlaying={player.currentTrack?.id === track.id && player.isPlaying}
                    compactGrid
                  />
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {/* Feed section commented out for later use */}
      {/* {activeTab === 'feed' && <Feed />} */}

      {effectiveView === 'concerts' && (
        <section>
          <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-kyobo truncate">Concerts</h2>
            {isLoadingConcerts && <Loader className="animate-spin text-primary-400 flex-shrink-0" size={20} />}
          </div>
          <p className="text-dark-400 text-sm mb-6">Concerts uploaded by artists on their profiles.</p>
          {isLoadingConcerts ? (
            <div className="text-center py-12">
              <Loader className="animate-spin text-primary-400 mx-auto" size={32} />
            </div>
          ) : concerts.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="mx-auto text-dark-400 mb-3" size={40} />
              <p className="text-dark-400 text-lg">No concerts yet</p>
              <p className="text-dark-500 text-sm mt-2">Artists will show their upcoming shows here when they add them to their profiles.</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 sm:gap-4">
              {concerts.map(concert => (
                <div
                  key={concert.id}
                  className="bg-dark-800 rounded-lg p-4 sm:p-5 border border-dark-700 card-hover cursor-pointer"
                  onClick={() => concert.user && handleUserClick(concert.user.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-semibold text-white truncate font-kyobo">{concert.title}</h3>
                      {concert.user && (
                        <div className="flex items-center gap-2 mt-2">
                          <img
                            src={getAvatarUrl(concert.user.avatar)}
                            alt={concert.user.username}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                          />
                          <span className="text-sm text-primary-400 truncate">
                            {concert.user.artist_name || concert.user.username}
                          </span>
                        </div>
                      )}
                      <div className="space-y-1.5 mt-3 text-dark-300 text-sm">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-primary-400 flex-shrink-0" />
                          <span>{new Date(concert.date).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin size={14} className="text-primary-400 flex-shrink-0" />
                          <span className="truncate">{concert.venue}, {concert.location}</span>
                        </div>
                        {concert.ticketPrice != null && (
                          <p className="text-primary-400 font-medium">${concert.ticketPrice}</p>
                        )}
                      </div>
                      {concert.description && (
                        <p className="text-dark-400 text-xs mt-2 line-clamp-2">{concert.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-4">
                    {concert.ticketUrl && (
                      <a
                        href={concert.ticketUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        className="px-3 py-1.5 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 transition-colors"
                      >
                        Get tickets
                      </a>
                    )}
                    {concert.user && (
                      <button
                        onClick={e => { e.stopPropagation(); handleUserClick(concert.user!.id); }}
                        className="px-3 py-1.5 bg-dark-700 text-white rounded text-sm hover:bg-dark-600 transition-colors"
                      >
                        View profile
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {effectiveView === 'users' && (
        <>
          {/* Featured Artists */}
          <section className="mb-8">
            <h2 className="text-2xl font-bold text-white mb-4 font-kyobo">Featured Artists</h2>
            {isLoadingArtists ? (
              <div className="text-center py-8">
                <Loader className="animate-spin text-primary-400 mx-auto" size={32} />
              </div>
            ) : (
              <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-6">
                {featuredArtists.length === 0 ? (
                  <div className="text-dark-400 col-span-full text-center">No featured artists found.</div>
                ) : (
                  featuredArtists.map(artist => (
                    <div
                      key={artist.id}
                      onClick={() => handleUserClick(artist.id)}
                      className="bg-dark-800 rounded-lg px-2 cursor-pointer card-hover py-2"
                    >
                      <div className="flex items-center space-x-2">
                        <img
                          src={getAvatarUrl(artist.avatar)}
                          alt={artist.username}
                          className="w-16 h-16 rounded-full object-cover"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-lg font-semibold text-white truncate flex items-center gap-1.5">
                            {artist.username}
                            <VerifiedBadge verified={artist.isVerified || artist.isVerifiedArtist} size={16} />
                          </p>
                          <p className="text-xs text-primary-400">Click to view profile</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </section>

          <section>
          <div className="flex items-center justify-between mb-4 sm:mb-6 gap-2">
            <h2 className="text-xl sm:text-2xl font-bold text-white font-kyobo truncate">Suggested Users</h2>
            {isLoadingUsers && <Loader className="animate-spin text-primary-400 flex-shrink-0" size={20} />}
          </div>
          
          {!currentUser ? (
            <div className="text-center py-8 sm:py-12 px-4">
              <Users className="mx-auto text-dark-400 mb-3 sm:mb-4" size={40} />
              <h3 className="text-lg sm:text-xl font-bold text-white mb-2">Sign in to see suggested users</h3>
              <p className="text-dark-400 text-sm sm:text-base mb-4 sm:mb-6">Connect with other artists and music lovers by signing in to your account.</p>
              <button
                onClick={() => window.location.href = '/login'}
                className="px-5 py-2.5 sm:px-6 sm:py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm sm:text-base"
              >
                Sign In
              </button>
            </div>
          ) : filteredUsers.length === 0 && !isLoadingUsers ? (
            <div className="text-center py-8 sm:py-12">
              <p className="text-dark-400 text-base sm:text-lg">No suggested users to show</p>
              <p className="text-dark-500 text-xs sm:text-sm mt-2">Try clearing your search</p>
            </div>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 sm:gap-4">
              {filteredUsers.map(user => (
                <div
                  key={user.id}
                  className="bg-dark-800 rounded-lg p-3 sm:p-4 cursor-pointer card-hover"
                >
                  <div className="flex items-center gap-3 sm:gap-4">
                    <img
                      src={getAvatarUrl(user.avatar)}
                      alt={user.username}
                      className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 rounded-full object-cover flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-base sm:text-lg font-semibold text-white truncate font-kyobo flex items-center gap-1.5">
                        {user.username}
                        <VerifiedBadge verified={user.isVerified || user.isVerifiedArtist} size={16} />
                      </p>
                      {user.artistName && (
                        <p className="text-xs sm:text-sm text-primary-400 truncate">{user.artistName}</p>
                      )}
                      <p className="text-xs sm:text-sm text-dark-400">{user.followers} followers</p>
                      {user.bio && (
                        <p className="text-xs text-dark-500 truncate mt-0.5 sm:mt-1 hidden sm:block">{user.bio}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 mt-3 sm:mt-4">
                    {/* Mobile: icon-only buttons */}
                    <div className="flex items-center gap-2 sm:hidden">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUserClick(user.id); }}
                        className="p-2 bg-dark-700 text-white rounded-full hover:bg-dark-600 transition-colors"
                        title="View Profile"
                      >
                        <UserIcon size={18} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStartChat(user); }}
                        className="p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors"
                        title="Message"
                      >
                        <MessageCircle size={18} />
                      </button>
                    </div>
                    {/* Web: text buttons */}
                    <div className="hidden sm:flex flex-1 sm:flex-initial gap-2">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleUserClick(user.id); }}
                        className="flex-1 sm:flex-initial px-3 py-2 bg-dark-700 text-white rounded text-sm hover:bg-dark-600 transition-colors"
                      >
                        View Profile
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleStartChat(user); }}
                        className="px-3 py-2 bg-primary-600 text-white rounded text-sm hover:bg-primary-700 transition-colors"
                      >
                        Message
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
        </>
      )}
    </div>
  );
};

export default Search;
