import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
// import { mockTracks } from '../data/mockData';
import { Music, User as UserIcon, ListMusic, Mic, Headphones, ArrowLeft, MessageCircle, UserPlus, UserMinus, Edit, Trash2, Settings, Lock, Unlock, MoreVertical, Play, Edit3, Share2, Users, Calendar, MapPin, X, Bookmark, ThumbsUp } from 'lucide-react';
import { ChatService } from '../services/chatService';
import { FollowService, FollowStats } from '../services/followService';
import { MusicService } from '../services/musicService';
import { ConcertService, Concert, CreateConcertData } from '../services/concertService';
import { AlbumService, Album } from '../services/albumService';
import { User as UserType, Track, Playlist } from '../store/useStore';
import MusicPlayerModal from '../components/player/MusicPlayerModal';
import PlaylistCard from '../components/music/PlaylistCard';
import TrackCard from '../components/music/TrackCard';
import AlbumCard from '../components/music/AlbumCard';
import Modal from '../components/Modal'; // (Assume you have a Modal component, or use a simple div for modal)
import FollowRequestCard from '../components/social/FollowRequestCard';
import VerifiedBadge from '../components/VerifiedBadge';
import { createDisplayName, useUUIDMasking } from '../utils/debugUtils';
import { getAvatarUrl } from '../utils/avatar';

const Profile: React.FC = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser, isAuthenticated, setUser, changeUsername, changeEmail, togglePrivateAccount, updateProfile, playTrack, playQueue, playPlaylist } = useStore();
  const [profileUser, setProfileUser] = useState<UserType | null>(null);
  const [userTracks, setUserTracks] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTracks, setIsLoadingTracks] = useState(false);
  const [isCurrentUser, setIsCurrentUser] = useState(false);
  const [activeTab, setActiveTab] = useState<'music' | 'playlists' | 'albums' | 'concerts' | 'bookmark' | 'liked' | 'about'>('music');
  const [followStats, setFollowStats] = useState<FollowStats>({ followers: 0, following: 0, isFollowing: false });
  const [followStatsLoadedForViewer, setFollowStatsLoadedForViewer] = useState(false);
  const [isFollowingLoading, setIsFollowingLoading] = useState(false);
  
  // Music player modal states
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  
  // Edit profile states
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    bio: '',
    artistName: '',
    genres: [] as string[],
    isPrivate: false
  });
  const [isSaving, setIsSaving] = useState(false);
  
  // Delete track states
  const [deletingTrackId, setDeletingTrackId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const [stripeLoading, setStripeLoading] = useState(false);

  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);

  // Albums state
  const [albums, setAlbums] = useState<Album[]>([]);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(false);

  // Concerts state
  const [concerts, setConcerts] = useState<Concert[]>([]);
  const [isLoadingConcerts, setIsLoadingConcerts] = useState(false);
  
  // Album editing states
  const [editingAlbum, setEditingAlbum] = useState<Album | null>(null);
  const [albumForm, setAlbumForm] = useState({
    title: '',
    artist: '',
    genre: '',
    description: '',
    price: ''
  });

  // Concert editing states
  const [isEditingConcerts, setIsEditingConcerts] = useState(false);
  const [editingConcert, setEditingConcert] = useState<Concert | null>(null);
  const [isAddingConcert, setIsAddingConcert] = useState(false);
  const [concertForm, setConcertForm] = useState({
    title: '',
    date: '',
    location: '',
    venue: '',
    description: '',
    ticketPrice: '',
    ticketUrl: ''
  });
  
  // About editing states
  const [isEditingAbout, setIsEditingAbout] = useState(false);
  const [aboutForm, setAboutForm] = useState({
    bio: '',
    genres: [] as string[]
  });

  const [followRequestPending, setFollowRequestPending] = useState(false);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);

  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [showPendingRequestsModal, setShowPendingRequestsModal] = useState(false);
  const [acceptDeclineLoadingId, setAcceptDeclineLoadingId] = useState<string | null>(null);
  const [followersList, setFollowersList] = useState<any[]>([]);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [isFollowersLoading, setIsFollowersLoading] = useState(false);
  const [isFollowingListLoading, setIsFollowingListLoading] = useState(false);

  // Bookmarks state
  const [bookmarks, setBookmarks] = useState<Track[]>([]);
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);

  // Liked tracks state
  const [likedTracks, setLikedTracks] = useState<Track[]>([]);
  const [isLoadingLikedTracks, setIsLoadingLikedTracks] = useState(false);

  // Links modal (external links to other sites, max 6)
  const [showLinksModal, setShowLinksModal] = useState(false);
  const [linkInputs, setLinkInputs] = useState<string[]>(['', '', '', '', '', '']);
  const [isSavingLinks, setIsSavingLinks] = useState(false);

  useEffect(() => {
    const loadPlaylists = async () => {
      if (!profileUser) return;
      setIsLoadingPlaylists(true);
      try {
        const fetchedPlaylists = await MusicService.getPlaylists(profileUser.id);
        
        // Load full playlist data including tracks for each playlist
        const playlistsWithTracks = await Promise.all(
          fetchedPlaylists.map(async (playlist) => {
            try {
              const fullPlaylist = await MusicService.getPlaylistById(playlist.id);
              return fullPlaylist;
            } catch (error) {
              console.error(`Failed to load tracks for playlist ${playlist.id}:`, error);
              return playlist; // Return basic playlist data if tracks fail to load
            }
          })
        );
        
        setPlaylists(playlistsWithTracks);
      } catch (error) {
        console.error('Failed to load playlists:', error);
      } finally {
        setIsLoadingPlaylists(false);
      }
    };
    loadPlaylists();
  }, [profileUser]);

  // Load albums for musicians
  useEffect(() => {
    const loadAlbums = async () => {
      if (!profileUser) return;
      
      setIsLoadingAlbums(true);
      try {
        const userAlbums = await AlbumService.getUserAlbums(profileUser.id);
        setAlbums(userAlbums);
      } catch (error) {
        console.error('Failed to load albums:', error);
        setAlbums([]);
      } finally {
        setIsLoadingAlbums(false);
      }
    };

    loadAlbums();
  }, [profileUser]);

  // Load concerts for musicians
  useEffect(() => {
    const loadConcerts = async () => {
      if (!profileUser) return;
      
      setIsLoadingConcerts(true);
      try {
        const userConcerts = await ConcertService.getUserConcerts(profileUser.id);
        setConcerts(userConcerts);
      } catch (error) {
        console.error('Failed to load concerts:', error);
        setConcerts([]);
      } finally {
        setIsLoadingConcerts(false);
      }
    };

    loadConcerts();
  }, [profileUser]);

  // Set default tab based on user role
  useEffect(() => {
    if (isCurrentUser && profileUser) {
      // Musicians see music tab by default
      const defaultTab = profileUser.role === 'musician' ? 'music' : 'music';
      setActiveTab(defaultTab);
    }
  }, [isCurrentUser, profileUser?.role]);

  // Privacy: only approved followers (in user_follows) and the owner can view a private profile.
  // Hide content only after we've loaded follow stats so followers don't see a flash of "private".
  const isProfilePrivate = (
    profileUser &&
    profileUser.isPrivate &&
    !isCurrentUser &&
    (followStatsLoadedForViewer ? !followStats.isFollowing : true)
  );

  useEffect(() => {
    const loadProfile = async () => {
      setIsLoading(true);

      // Declare loadedUser at function scope to avoid ReferenceError
      let loadedUser: UserType | null = null;
      
      if (userId) {
        // Viewing another user's profile – don't treat as private until we've loaded follow stats
        setFollowStatsLoadedForViewer(false);
        try {
          const user = await ChatService.getUserById(userId);
          if (user) {
            loadedUser = user; // Set loadedUser here too
            setProfileUser(user);
            setIsCurrentUser(false);
            
            // Load follow stats so we know if viewer is an approved follower (can see private profile)
            if (currentUser) {
              const stats = await FollowService.getFollowStats(userId, currentUser.id);
              setFollowStats(stats);
              setFollowStatsLoadedForViewer(true);
            } else {
              setFollowStatsLoadedForViewer(true);
            }
          } else {
            // User not found, redirect to home
            navigate('/');
          }
        } catch (error) {
          console.error('Failed to load user profile:', error);
          setFollowStatsLoadedForViewer(true);
          navigate('/');
        }
      } else {
        // Viewing current user's profile - always fetch fresh data from backend
        // to ensure we have the latest role and profile information
        if (currentUser) {
          try {
            const freshUserData = await ChatService.getUserById(currentUser.id);
            if (freshUserData) {
              loadedUser = freshUserData;
              setProfileUser(freshUserData);
            } else {
              loadedUser = currentUser;
              setProfileUser(currentUser);
            }
          } catch (error) {
            console.error('Failed to refresh current user profile:', error);
            loadedUser = currentUser;
            setProfileUser(currentUser);
          }
        } else if (isAuthenticated) {
          // If authenticated but currentUser not loaded yet, try to fetch it
          try {
            const { AuthService } = await import('../services/authService');
            const fetchedUser = await AuthService.getCurrentUser();
            if (fetchedUser) {
              loadedUser = fetchedUser;
              setProfileUser(fetchedUser);
              // Update the store with the fetched user
              setUser(fetchedUser);
            } else {
              // #region agent log
              fetch('http://127.0.0.1:7242/ingest/82f7ead4-f3af-408e-8dd6-0fbbbdf1dc95',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'Profile.tsx:loadProfile',message:'fetchedUser is null, setting profileUser to null',data:{},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'Q'})}).catch(()=>{});
              // #endregion
              setProfileUser(null);
            }
          } catch (error) {
            console.error('Failed to fetch current user:', error);
            setProfileUser(null);
          }
        } else {
          setProfileUser(null);
        }
        setIsCurrentUser(true);
        setFollowStatsLoadedForViewer(true);
      }
      
      // Load follow stats for current user using the loaded user data (only when viewing own profile)
      if (loadedUser && !userId) {
        try {
          const stats = await FollowService.getFollowStats(loadedUser.id);
          setFollowStats(stats);
        } catch (error) {
          console.error('Failed to load follow stats:', error);
        }
      }
      
      setIsLoading(false);
    };

    loadProfile();
  }, [userId, currentUser, navigate, currentUser?.role, isAuthenticated, setUser]); // Added isAuthenticated and setUser to dependencies


  useEffect(() => {
    const loadUserTracks = async () => {
      if (!profileUser) return;
      
      setIsLoadingTracks(true);
      try {
        const tracks = await MusicService.getUserTracks(profileUser.id);
        setUserTracks(tracks);
      } catch (error) {
        console.error('Failed to load user tracks:', error);
      } finally {
        setIsLoadingTracks(false);
      }
    };

    loadUserTracks();
  }, [profileUser]);

  useEffect(() => {
    const checkFollowRequest = async () => {
      if (!profileUser || !currentUser || isCurrentUser) return;
      const pending = await FollowService.getFollowRequestStatus(currentUser.id, profileUser.id);
      setFollowRequestPending(pending);
    };
    checkFollowRequest();
  }, [profileUser, currentUser, isCurrentUser]);

  // Refresh follow stats when profile user changes
  useEffect(() => {
    if (profileUser && currentUser && !isCurrentUser) {
      refreshFollowStats();
    }
  }, [profileUser, currentUser, isCurrentUser]);

  useEffect(() => {
    const loadPendingRequests = async () => {
      if (isCurrentUser && profileUser?.isPrivate) {
        const requests = await FollowService.getPendingFollowRequestsWithDetails(profileUser.id);
        setPendingRequests(requests);
      }
    };
    loadPendingRequests();
  }, [isCurrentUser, profileUser]);

  // Load bookmarks
  useEffect(() => {
    const loadBookmarks = async () => {
      if (!profileUser || !isCurrentUser) return;
      
      setIsLoadingBookmarks(true);
      try {
        const userBookmarks = await MusicService.getUserBookmarks(profileUser.id);
        setBookmarks(userBookmarks);
      } catch (error) {
        console.error('Failed to load bookmarks:', error);
        setBookmarks([]);
      } finally {
        setIsLoadingBookmarks(false);
      }
    };

    loadBookmarks();

    // Listen for bookmark changes
    const handleBookmarkChange = () => {
      if (profileUser && isCurrentUser) {
        loadBookmarks();
      }
    };

    window.addEventListener('bookmarkChanged', handleBookmarkChange);
    return () => {
      window.removeEventListener('bookmarkChanged', handleBookmarkChange);
    };
  }, [profileUser, isCurrentUser]);

  // Load liked tracks (current user only)
  useEffect(() => {
    const loadLikedTracks = async () => {
      if (!profileUser || !isCurrentUser) return;

      setIsLoadingLikedTracks(true);
      try {
        const tracks = await MusicService.getUserLikedTracks(profileUser.id);
        setLikedTracks(tracks);
      } catch (error) {
        console.error('Failed to load liked tracks:', error);
        setLikedTracks([]);
      } finally {
        setIsLoadingLikedTracks(false);
      }
    };

    loadLikedTracks();

    const handleLikedChange = () => {
      if (profileUser && isCurrentUser) loadLikedTracks();
    };

    window.addEventListener('likedChanged', handleLikedChange);
    return () => window.removeEventListener('likedChanged', handleLikedChange);
  }, [profileUser, isCurrentUser]);

  const handleStartChat = async () => {
    if (!currentUser || !profileUser || isCurrentUser) return;
    
    try {
      // Send a dummy message to create the chat
      await ChatService.sendMessage({
        senderId: currentUser.id,
        receiverId: profileUser.id,
        content: '👋',
      });
      
      // Navigate to chat
      navigate('/chat');
    } catch (error) {
      console.error('Failed to start chat:', error);
    }
  };

  const handlePlayAll = () => {
    if (userTracks.length > 0) {
      playQueue(userTracks);
    }
  };

  const handlePlayAlbum = async (album: Album) => {
    try {
      // Fetch tracks for this album
      const albumTracks = await MusicService.getTracksByAlbum(album.id);
      if (albumTracks.length > 0) {
        playQueue(albumTracks);
      }
    } catch (error) {
      console.error('Failed to load album tracks:', error);
    }
  };

  const handleTrackClick = (track: Track) => {
    setSelectedTrack(track);
    setIsPlayerModalOpen(true);
  };

  const handleClosePlayerModal = () => {
    setIsPlayerModalOpen(false);
    setSelectedTrack(null);
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (!currentUser) return;

    setDeletingTrackId(trackId);
    try {
      await MusicService.deleteTrack(trackId, currentUser.id);
      setUserTracks(prevTracks => prevTracks.filter(track => track.id !== trackId));
    } catch (error) {
      console.error('Failed to delete track:', error);
    } finally {
      setDeletingTrackId(null);
      setShowDeleteConfirm(null);
    }
  };

  const handleShowDeleteConfirm = (trackId: string) => {
    setShowDeleteConfirm(trackId);
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  const refreshFollowStats = async () => {
    if (!currentUser || !profileUser) return;
    
    try {
      const stats = await FollowService.getFollowStats(profileUser.id, currentUser.id);
      setFollowStats(stats);
      setFollowStatsLoadedForViewer(true);
    } catch (error) {
      console.error('Failed to refresh follow stats:', error);
    }
  };

  const handleFollowToggle = async () => {
    if (!currentUser || !profileUser || isCurrentUser) return;

    setIsFollowingLoading(true);
    
    try {
      if (followStats.isFollowing) {
        await FollowService.unfollowUser(currentUser.id, profileUser.id);
        // Update local state immediately for better UX
        setFollowStats(prev => ({
          ...prev,
          isFollowing: false,
          followers: Math.max(0, prev.followers - 1)
        }));
        // Update current user's following count
        if (currentUser) {
          setUser({ ...currentUser, following: Math.max(0, currentUser.following - 1) });
        }
      } else {
        await FollowService.followUser(currentUser.id, profileUser.id);
        // Update local state immediately for better UX
        setFollowStats(prev => ({
          ...prev,
          isFollowing: true,
          followers: prev.followers + 1
        }));
        // Update current user's following count
        if (currentUser) {
          setUser({ ...currentUser, following: currentUser.following + 1 });
        }
      }
      
      // Refresh follow stats from backend to ensure consistency
      await refreshFollowStats();
      
      // Refresh profile user data to get updated follower count
      const updatedProfileUser = await ChatService.getUserById(profileUser.id);
      if (updatedProfileUser) {
        setProfileUser(updatedProfileUser);
      }
    } catch (error) {
      console.error('Failed to toggle follow:', error);
      // Revert local state changes on error
      await refreshFollowStats();
    } finally {
      setIsFollowingLoading(false);
    }
  };

  const handleRequestFollow = async () => {
    if (!currentUser || !profileUser) return;
    await FollowService.requestFollow(currentUser.id, profileUser.id);
    setFollowRequestPending(true);
  };
  const handleCancelRequest = async () => {
    if (!currentUser || !profileUser) return;
    await FollowService.cancelFollowRequest(currentUser.id, profileUser.id);
    setFollowRequestPending(false);
  };
  const handleAcceptRequest = async (requestId: string) => {
    setAcceptDeclineLoadingId(requestId);
    try {
      await FollowService.acceptFollowRequest(requestId);
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
      setFollowStats(prev => ({ ...prev, followers: prev.followers + 1 }));
    } finally {
      setAcceptDeclineLoadingId(null);
    }
  };
  const handleDeclineRequest = async (requestId: string) => {
    setAcceptDeclineLoadingId(requestId);
    try {
      await FollowService.declineFollowRequest(requestId);
      setPendingRequests(prev => prev.filter(r => r.id !== requestId));
    } finally {
      setAcceptDeclineLoadingId(null);
    }
  };

  const handleEditProfile = () => {
    if (!profileUser) return;
    
    setEditForm({
      username: profileUser.username,
      email: profileUser.email,
      bio: profileUser.bio || '',
      artistName: profileUser.artistName || '',
      genres: profileUser.genres || [],
      isPrivate: profileUser.isPrivate || false
    });
    setIsEditing(true);
  };

  const handleSaveProfile = async () => {
    if (!currentUser) return;

    setIsSaving(true);
    try {
      await updateProfile({
        username: editForm.username,
        email: editForm.email,
        bio: editForm.bio,
        artistName: editForm.artistName,
        genres: editForm.genres,
        isPrivate: editForm.isPrivate
      });
      
      // Update local state
      setProfileUser(prev => prev ? {
        ...prev,
        username: editForm.username,
        email: editForm.email,
        bio: editForm.bio,
        artistName: editForm.artistName,
        genres: editForm.genres,
        isPrivate: editForm.isPrivate
      } : null);
      
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleStripeOnboard = async () => {
    if (!currentUser) return;
    
    setStripeLoading(true);
    try {
      const response = await fetch('/api/create-stripe-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id })
      });
      
      const data = await response.json();
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        console.error('Failed to create Stripe account:', data.error);
      }
    } catch (error) {
      console.error('Failed to onboard with Stripe:', error);
    } finally {
      setStripeLoading(false);
    }
  };

  const handleSaveLinks = async () => {
    if (!currentUser) return;
    const trimmed = linkInputs.map((u) => u.trim()).filter(Boolean);
    const externalLinks = trimmed.slice(0, 6);
    setIsSavingLinks(true);
    try {
      const updated = await updateProfile({ externalLinks } as Partial<UserType>);
      setProfileUser(updated);
      setShowLinksModal(false);
    } catch (error) {
      console.error('Failed to save links:', error);
    } finally {
      setIsSavingLinks(false);
    }
  };

  // Handlers to open modals and fetch lists
  const handleOpenFollowers = async () => {
    setShowFollowersModal(true);
    setIsFollowersLoading(true);
    try {
      const list = await FollowService.getFollowers(profileUser!.id);
      setFollowersList(list);
    } catch (e) {
      setFollowersList([]);
    } finally {
      setIsFollowersLoading(false);
    }
  };
  const handleOpenFollowing = async () => {
    setShowFollowingModal(true);
    setIsFollowingListLoading(true);
    try {
      const list = await FollowService.getFollowing(profileUser!.id);
      setFollowingList(list);
    } catch (e) {
      setFollowingList([]);
    } finally {
      setIsFollowingListLoading(false);
    }
  };

  const handleUnfollowFromFollowingList = async (followingId: string) => {
    if (!currentUser || !profileUser || !isCurrentUser) return;
    try {
      await FollowService.unfollowUser(currentUser.id, followingId);
      setFollowingList((prev) => prev.filter((u) => u.id !== followingId));
      setFollowStats((prev) => ({ ...prev, following: Math.max(0, prev.following - 1) }));
    } catch (error) {
      console.error('Failed to unfollow:', error);
    }
  };

  const handleRemoveFollower = async (followerId: string) => {
    if (!currentUser || !profileUser || !isCurrentUser) return;
    try {
      await FollowService.unfollowUser(followerId, profileUser.id);
      setFollowersList((prev) => prev.filter((u) => u.id !== followerId));
      setFollowStats((prev) => ({ ...prev, followers: Math.max(0, prev.followers - 1) }));
    } catch (error) {
      console.error('Failed to remove follower:', error);
    }
  };

  const handlePlaylistClick = (playlistId: string) => {
    navigate(`/playlists/${playlistId}`);
  };

  const handleAlbumClick = (albumId: string) => {
    navigate(`/albums/${albumId}`);
  };

  // Album editing handlers
  const handleEditAlbum = (album: Album) => {
    setAlbumForm({
      title: album.title,
      artist: album.artist,
      genre: album.genre,
      description: album.description || '',
      price: album.price?.toString() || ''
    });
    setEditingAlbum(album);
  };

  const handleSaveAlbum = async () => {
    if (!currentUser) return;

    try {
      const albumData = {
        title: albumForm.title,
        artist: albumForm.artist,
        cover: editingAlbum?.cover || 'https://images.unsplash.com/photo-1493225457124a3eb161a5?w=400&h=400&fit=crop', // Default cover
        genre: albumForm.genre,
        price: albumForm.price ? parseFloat(albumForm.price) : undefined,
        description: albumForm.description,
        userId: currentUser.id
      };

      // Update existing album
      const updatedAlbum = await AlbumService.updateAlbum(editingAlbum!.id, currentUser.id, albumData);
      setAlbums(prev => prev.map(a => a.id === editingAlbum!.id ? updatedAlbum : a));
      setEditingAlbum(null);

      // Reset form
      setAlbumForm({
        title: '',
        artist: '',
        genre: '',
        description: '',
        price: ''
      });
    } catch (error) {
      console.error('Failed to save album:', error);
    }
  };

  const handleDeleteAlbum = async (albumId: string) => {
    if (!currentUser) return;

    try {
      await AlbumService.deleteAlbum(albumId, currentUser.id);
      setAlbums(prev => prev.filter(a => a.id !== albumId));
    } catch (error) {
      console.error('Failed to delete album:', error);
    }
  };

  const handleCancelAlbumEdit = () => {
    setEditingAlbum(null);
    setAlbumForm({
      title: '',
      artist: '',
      genre: '',
      description: '',
      price: ''
    });
  };

  // Concert editing handlers
  const handleAddConcert = () => {
    setConcertForm({
      title: '',
      date: '',
      location: '',
      venue: '',
      description: '',
      ticketPrice: '',
      ticketUrl: ''
    });
    setIsAddingConcert(true);
  };

  const handleEditConcert = (concert: Concert) => {
    setConcertForm({
      title: concert.title,
      date: concert.date.split('T')[0], // Format for date input
      location: concert.location,
      venue: concert.venue,
      description: concert.description || '',
      ticketPrice: concert.ticketPrice?.toString() || '',
      ticketUrl: concert.ticketUrl || ''
    });
    setEditingConcert(concert);
  };

  const handleSaveConcert = async () => {
    if (!currentUser) return;

    // Validate required fields
    if (!concertForm.title.trim()) {
      alert('Please enter a concert title');
      return;
    }
    if (!concertForm.date) {
      alert('Please select a date');
      return;
    }
    if (!concertForm.venue.trim()) {
      alert('Please enter a venue');
      return;
    }
    if (!concertForm.location.trim()) {
      alert('Please enter a location');
      return;
    }

    try {
      // Format date properly - ensure it's in ISO format
      const dateValue = concertForm.date.includes('T') 
        ? concertForm.date 
        : `${concertForm.date}T00:00:00.000Z`;

      const concertData: CreateConcertData = {
        title: concertForm.title.trim(),
        date: dateValue,
        location: concertForm.location.trim(),
        venue: concertForm.venue.trim(),
        description: concertForm.description.trim() || undefined,
        ticketPrice: concertForm.ticketPrice ? parseFloat(concertForm.ticketPrice) : undefined,
        ticketUrl: concertForm.ticketUrl.trim() || undefined,
        userId: currentUser.id
      };

      if (editingConcert) {
        // Update existing concert
        const updatedConcert = await ConcertService.updateConcert(editingConcert.id, currentUser.id, concertData);
        setConcerts(prev => prev.map(c => c.id === editingConcert.id ? updatedConcert : c));
        setEditingConcert(null);
      } else {
        // Create new concert
        const newConcert = await ConcertService.createConcert(concertData);
        setConcerts(prev => [...prev, newConcert].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()));
        setIsAddingConcert(false);
      }

      // Reset form
      setConcertForm({
        title: '',
        date: '',
        location: '',
        venue: '',
        description: '',
        ticketPrice: '',
        ticketUrl: ''
      });
    } catch (error) {
      console.error('Failed to save concert:', error);
      alert(error instanceof Error ? error.message : 'Failed to save concert. Please try again.');
    }
  };

  const handleDeleteConcert = async (concertId: string) => {
    if (!currentUser) return;

    try {
      await ConcertService.deleteConcert(concertId, currentUser.id);
      setConcerts(prev => prev.filter(c => c.id !== concertId));
    } catch (error) {
      console.error('Failed to delete concert:', error);
    }
  };

  const handleCancelConcertEdit = () => {
    setEditingConcert(null);
    setIsAddingConcert(false);
    setConcertForm({
      title: '',
      date: '',
      location: '',
      venue: '',
      description: '',
      ticketPrice: '',
      ticketUrl: ''
    });
  };

  // About editing handlers
  const handleEditAbout = () => {
    setAboutForm({
      bio: profileUser?.bio || '',
      genres: profileUser?.genres || []
    });
    setIsEditingAbout(true);
  };

  const handleSaveAbout = async () => {
    if (!currentUser) return;

    try {
      await updateProfile({
        bio: aboutForm.bio,
        genres: aboutForm.genres
      });

      // Update local profile state
      setProfileUser(prev => prev ? {
        ...prev,
        bio: aboutForm.bio,
        genres: aboutForm.genres
      } : null);

      setIsEditingAbout(false);
    } catch (error) {
      console.error('Failed to update about section:', error);
    }
  };

  const handleCancelAboutEdit = () => {
    setIsEditingAbout(false);
    setAboutForm({
      bio: '',
      genres: []
    });
  };

  const handleAddGenre = (genre: string) => {
    if (genre && !aboutForm.genres.includes(genre)) {
      setAboutForm(prev => ({
        ...prev,
        genres: [...prev.genres, genre]
      }));
    }
  };

  const handleRemoveGenre = (genreToRemove: string) => {
    setAboutForm(prev => ({
      ...prev,
      genres: prev.genres.filter(genre => genre !== genreToRemove)
    }));
  };

  // Show authentication required message if not authenticated
  if (!isAuthenticated) {
    return (
      <div className="p-3 lg:p-6 space-y-6 lg:space-y-8">
        <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
          <Lock size={64} className="text-gray-400" />
          <h2 className="text-2xl font-bold text-white">Authentication Required</h2>
          <p className="text-gray-400 text-center max-w-md">
            You need to sign in to view profiles. Please sign in to continue.
          </p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="spinner w-8 h-8"></div>
        <span className="ml-2 text-dark-400">Loading profile...</span>
      </div>
    );
  }

  if (!profileUser) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-dark-400">User not found</p>
      </div>
    );
  }

  return (
    <div className="p-3 lg:p-6 space-y-6 lg:space-y-8">

      {/* Profile Header */}
      <div className="relative">
        <div className="relative flex flex-col lg:flex-row lg:items-end p-4 lg:p-8 space-y-4 lg:space-y-0">
          {/* Profile Picture - Centered on mobile */}
          <div className="flex justify-center lg:justify-start">
            <img
              src={getAvatarUrl(profileUser.avatar)}
              alt={profileUser.username}
              className="w-24 h-24 lg:w-32 lg:h-32 rounded-full object-cover border-4 border-white shadow-lg"
            />
          </div>
          
          {/* Profile Info - Stacked on mobile */}
          <div className="lg:ml-8 flex-1 space-y-4 text-center lg:text-left">
            <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
              <div className="flex-1">
                <div className="flex flex-col lg:flex-row lg:items-center space-y-2 lg:space-y-0 lg:space-x-3 mb-2">
                  <div className="flex items-center justify-center lg:justify-start gap-2 flex-wrap">
                    <h1 className="text-2xl lg:text-3xl font-bold text-white font-kyobo">{profileUser.username}</h1>
                    <VerifiedBadge verified={profileUser.isVerified || (profileUser as { isVerifiedArtist?: boolean }).isVerifiedArtist} size={20} />
                  </div>
                  <div className="flex items-center justify-center lg:justify-start space-x-2">
                    {profileUser.isPrivate && (
                      <Lock className="text-dark-400" size={16} />
                    )}
                  </div>
                </div>
                
                <h2 className="text-dark-300 mb-4 text-sm lg:text-base">
                  {profileUser.bio || (profileUser.role === 'musician' ? 'Musician' : 'Listener')}
                </h2>
              </div>
              
              {/* Action buttons - Stacked on mobile */}
              <div className="flex flex-col lg:flex-row items-center space-y-2 lg:space-y-0 lg:space-x-4">
                {isCurrentUser ? (
                  <>
                    <button
                      onClick={handleEditProfile}
                      className="w-full lg:w-auto flex items-center justify-center space-x-2 px-4 lg:px-6 py-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors font-medium text-sm"
                    >
                      <Edit size={16} />
                      <span>Edit Profile</span>
                    </button>
                    <button
                      onClick={() => {
                        const links = (profileUser ?? currentUser) as { externalLinks?: string[] } | null;
                        const existing = (links?.externalLinks ?? []).slice(0, 6);
                        setLinkInputs([...existing, '', '', '', '', '', ''].slice(0, 6));
                        setShowLinksModal(true);
                      }}
                      className="w-full lg:w-auto p-2 rounded-full bg-dark-700 text-white hover:bg-dark-600 transition-colors"
                      title="Add links to other sites"
                    >
                      <Share2 size={20} />
                    </button>
                  </>
                ) : (
                  <>
                    {profileUser.isPrivate && !followStats.isFollowing ? (
                      followRequestPending ? (
                        <button
                          onClick={handleCancelRequest}
                          className="w-full lg:w-auto px-4 lg:px-6 py-2 rounded-full font-medium transition-colors bg-dark-700 text-white text-sm"
                        >
                          Request Pending
                        </button>
                      ) : (
                        <button
                          onClick={handleRequestFollow}
                          className="w-full lg:w-auto px-4 lg:px-6 py-2 rounded-full font-medium transition-colors bg-primary-600 text-white hover:bg-primary-700 text-sm"
                        >
                          Request Follow
                        </button>
                      )
                    ) : (
                      <button
                        onClick={handleFollowToggle}
                        disabled={isFollowingLoading}
                        className={`w-full lg:w-auto px-4 lg:px-6 py-2 rounded-full font-medium transition-colors text-sm ${
                          followStats.isFollowing
                            ? 'bg-dark-700 text-white hover:bg-dark-600'
                            : 'bg-primary-600 text-white hover:bg-primary-700'
                        }`}
                      >
                        {isFollowingLoading ? (
                          <div className="spinner w-4 h-4"></div>
                        ) : followStats.isFollowing ? (
                          'Following'
                        ) : (
                          'Follow'
                        )}
                      </button>
                    )}
                    <button 
                      onClick={handleStartChat}
                      className="w-full lg:w-auto p-2 rounded-full bg-dark-700 text-white hover:bg-dark-600 transition-colors"
                    >
                      <Share2 size={20} />
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Stats - Clickable to open Followers / Following modals */}
            <div className="flex items-center justify-center lg:justify-start space-x-6 lg:space-x-8">
              <button
                type="button"
                onClick={handleOpenFollowers}
                className="flex items-center space-x-2 text-left hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-900 rounded-lg"
              >
                <Users className="text-primary-400 bg-white rounded-full p-1 w-8 h-8" size={18} />
                <div className="text-center">
                  <h2 className="text-xl lg:text-2xl font-bold text-white">
                    {followStats.followers >= 1000
                      ? `${(followStats.followers / 1000).toFixed(1)}K`
                      : followStats.followers}
                  </h2>
                  <h2 className="text-xs lg:text-sm text-dark-400">Followers</h2>
                </div>
              </button>
              <button
                type="button"
                onClick={handleOpenFollowing}
                className="flex items-center space-x-2 text-left hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-900 rounded-lg"
              >
                <UserIcon className="text-secondary-400 bg-white rounded-full p-1 w-8 h-8" size={18} />
                <div className="text-center">
                  <h2 className="text-xl lg:text-2xl font-bold text-white">{followStats.following}</h2>
                  <h2 className="text-xs lg:text-sm text-dark-400">Following</h2>
                </div>
              </button>
              {isCurrentUser && pendingRequests.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowPendingRequestsModal(true)}
                  className="flex items-center space-x-2 text-left hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 focus:ring-offset-dark-900 rounded-lg"
                >
                  <UserPlus className="text-amber-400 bg-white rounded-full p-1 w-8 h-8" size={18} />
                  <div className="text-center">
                    <h2 className="text-xl lg:text-2xl font-bold text-white">{pendingRequests.length}</h2>
                    <h2 className="text-xs lg:text-sm text-dark-400">Requests</h2>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60">
          <div className="bg-white rounded-lg shadow-2xl p-6 w-full max-w-md relative">
            <div className="text-lg lg:text-xl font-bold text-black mb-4">Edit Profile</div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-black font-medium mb-2">Username</label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm(prev => ({ ...prev, username: e.target.value }))}
                  className="w-full px-3 lg:px-4 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              
              {/*<div>
                <label className="block text-black font-medium mb-2">Bio</label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm(prev => ({ ...prev, bio: e.target.value }))}
                  rows={3}
                  className="w-full px-3 lg:px-4 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
              
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isPrivate"
                  checked={editForm.isPrivate}
                  onChange={(e) => setEditForm(prev => ({ ...prev, isPrivate: e.target.checked }))}
                  className="w-4 h-4 text-primary-600 bg-dark-700 border-dark-600 rounded focus:ring-primary-500"
                />
                <label htmlFor="isPrivate" className="text-sm text-white">
                  Private Account
                </label>
              </div>*/}
            </div>
            
            <div className="flex flex-col lg:flex-row space-y-2 lg:space-y-0 lg:space-x-3 mt-6">
              <button
                onClick={handleSaveProfile}
                disabled={isSaving}
                className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 text-sm"
              >
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <button
                onClick={handleCancelEdit}
                className="flex-1 bg-dark-700 text-white px-4 py-2 rounded-lg hover:bg-dark-600 transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab Navigation — sticky on mobile so tabs stay visible while scrolling content */}
      <div className="lg:sticky top-0 z-10 bg-dark-900/95 backdrop-blur-sm border-b border-dark-700/60 -mx-3 lg:mx-0 px-3 lg:px-0 py-2 lg:py-0 mb-2 lg:mb-0">
      <div className="flex flex-wrap space-x-1 bg-dark-800 rounded-lg p-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('music')}
          className={`flex-shrink-0 py-2 px-3 lg:px-4 rounded-md text-xs lg:text-sm font-medium transition-colors ${
            activeTab === 'music'
              ? 'bg-primary-600 text-white'
              : 'text-dark-400 hover:text-white'
          }`}
        >
          Music
        </button>
        <button
          onClick={() => setActiveTab('playlists')}
          className={`flex-shrink-0 py-2 px-3 lg:px-4 rounded-md text-xs lg:text-sm font-medium transition-colors ${
            activeTab === 'playlists'
              ? 'bg-primary-600 text-white'
              : 'text-dark-400 hover:text-white'
          }`}
        >
          Playlists
        </button>
        {/* Albums/Preferences tab - different for each account type */}
        <button
          onClick={() => setActiveTab('albums')}
          className={`flex-shrink-0 py-2 px-3 lg:px-4 rounded-md text-xs lg:text-sm font-medium transition-colors ${
            activeTab === 'albums'
              ? 'bg-primary-600 text-white'
              : 'text-dark-400 hover:text-white'
          }`}
        >
          {profileUser?.role === 'musician' ? 'Albums' : 'Preferences'}
        </button>
        {/* Show Concerts tab only for musicians */}
        {profileUser?.role === 'musician' && (
          <button
            onClick={() => setActiveTab('concerts')}
            className={`flex-shrink-0 py-2 px-3 lg:px-4 rounded-md text-xs lg:text-sm font-medium transition-colors ${
              activeTab === 'concerts'
                ? 'bg-primary-600 text-white'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            Concerts
          </button>
        )}
        {/* Bookmark tab - only visible to current user */}
        {isCurrentUser && (
          <button
            onClick={() => setActiveTab('bookmark')}
            className={`flex-shrink-0 py-2 px-3 lg:px-4 rounded-md text-xs lg:text-sm font-medium transition-colors ${
              activeTab === 'bookmark'
                ? 'bg-primary-600 text-white'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            Bookmark
          </button>
        )}
        {/* Liked tab - only visible to current user */}
        {isCurrentUser && (
          <button
            onClick={() => setActiveTab('liked')}
            className={`flex-shrink-0 py-2 px-3 lg:px-4 rounded-md text-xs lg:text-sm font-medium transition-colors ${
              activeTab === 'liked'
                ? 'bg-primary-600 text-white'
                : 'text-dark-400 hover:text-white'
            }`}
          >
            Liked
          </button>
        )}
      </div>
      </div>{/* end sticky tab wrapper */}

      {/* Tab Content */}
      {(!isProfilePrivate || isCurrentUser || followStats.isFollowing) ? (
        <>
          {activeTab === 'music' && (
            <>
              {/* Music Uploads */}
              <section>
                <h2 className="text-xl lg:text-2xl font-bold text-white mb-4 flex items-center font-kyobo">
                  <Music className="mr-2 text-primary-400" />
                  {profileUser?.role === 'musician' 
                    ? (isCurrentUser ? 'My Music' : `${profileUser?.artistName || profileUser?.username || 'User'}'s Music`)
                    : (isCurrentUser ? 'My Music Collection' : `${profileUser?.username || 'User'}'s Music Collection`)
                  }
                </h2>
                
                {isLoadingTracks ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="spinner w-8 h-8"></div>
                    <span className="ml-2 text-dark-400">Loading tracks...</span>
                  </div>
                ) : userTracks.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-dark-400 mb-2">
                      {profileUser?.role === 'musician' 
                        ? 'No tracks uploaded yet.' 
                        : 'No music in collection yet.'
                      }
                    </p>
                    {isCurrentUser && (
                      <p className="text-dark-400 text-sm">
                        {profileUser?.role === 'musician' 
                          ? 'Upload your first track to get started!' 
                          : 'Discover and add music to your collection!'
                        }
                      </p>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-dark-600 scrollbar-track-transparent">
                      <div className="flex gap-4 w-max pl-1 pr-6 sm:pr-8 md:pr-10">
                        {userTracks.map(track => (
                          <div key={track.id} className="flex-shrink-0 w-[180px] sm:w-[200px]">
                            <TrackCard track={track} onDelete={isCurrentUser ? () => handleDeleteTrack(track.id) : undefined} compactGrid showActions={isCurrentUser} />
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </section>
            </>
          )}

          {activeTab === 'playlists' && (
            <section>
              <h2 className="text-xl lg:text-2xl font-bold text-white mb-4 flex items-center font-kyobo">
                <ListMusic className="mr-2 text-secondary-400" />
                {profileUser?.role === 'musician' 
                  ? (isCurrentUser ? 'My Playlists' : `${profileUser?.artistName || profileUser?.username || 'User'}'s Playlists`)
                  : (isCurrentUser ? 'My Playlists' : `${profileUser?.username || 'User'}'s Playlists`)
                }
              </h2>
              {isLoadingPlaylists ? (
                <div className="flex items-center justify-center py-8">
                  <div className="spinner w-8 h-8"></div>
                  <span className="ml-2 text-dark-400">Loading playlists...</span>
                </div>
              ) : playlists.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-dark-400 mb-2">
                    {profileUser?.role === 'musician' 
                      ? 'No playlists created yet.' 
                      : 'No playlists created yet.'
                    }
                  </p>
                  {isCurrentUser && (
                    <p className="text-dark-400 text-sm">
                      {profileUser?.role === 'musician' 
                        ? 'Create playlists to showcase your music!' 
                        : 'Create your first playlist to get started!'
                      }
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  {playlists.map(playlist => (
                    <div
                      key={playlist.id}
                      className="rounded-lg cursor-pointer"
                      onClick={() => handlePlaylistClick(playlist.id)}
                    >
                      <PlaylistCard
                        playlist={playlist}
                        onPlay={playPlaylist}
                        onEdit={() => {}}
                        onDelete={isCurrentUser ? async (id) => {
                          try {
                            await MusicService.deletePlaylist(id, currentUser!.id);
                            setPlaylists(prev => prev.filter(p => p.id !== id));
                            window.dispatchEvent(new CustomEvent('playlistsChanged', { detail: { playlistId: id, userId: currentUser!.id, action: 'deleted' } }));
                          } catch (e) {
                            console.error('Failed to delete playlist:', e);
                          }
                        } : undefined}
                        showActions={isCurrentUser}
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          )}

          {/* Consumer-specific content */}
          {activeTab === 'albums' && profileUser?.role === 'consumer' && (
            <section>
              <div className="mb-4">
                <h2 className="text-xl lg:text-2xl font-bold text-white flex items-center font-kyobo">
                  <Music className="mr-2 text-primary-400" />
                  {isCurrentUser ? 'My Music Preferences' : `${profileUser?.username || 'User'}'s Music Preferences`}
                </h2>
              </div>

              <div className="text-center py-12">
                <Music className="text-dark-400 mb-4 mx-auto" size={48} />
                <p className="text-dark-400 mb-2">Music preferences coming soon!</p>
                {isCurrentUser && (
                  <p className="text-dark-400 text-sm">
                    We'll help you discover music based on your listening habits and preferences.
                  </p>
                )}
              </div>
            </section>
          )}

          {activeTab === 'albums' && profileUser?.role === 'musician' && (
            <section>
              <div className="mb-4">
                <h2 className="text-xl lg:text-2xl font-bold text-white flex items-center font-kyobo">
                  <Music className="mr-2 text-primary-400" />
                  {isCurrentUser ? 'My Albums' : `${profileUser?.artistName || profileUser?.username || 'User'}'s Albums`}
                </h2>
              </div>

              {isLoadingAlbums ? (
                <div className="flex items-center justify-center py-8">
                  <div className="spinner w-8 h-8"></div>
                  <span className="ml-2 text-dark-400">Loading albums...</span>
                </div>
              ) : albums.length === 0 ? (
                <div className="text-center py-12">
                  <Music className="text-dark-400 mb-4 mx-auto" size={48} />
                  <p className="text-dark-400 mb-2">No albums uploaded yet.</p>
                  {isCurrentUser && (
                    <p className="text-dark-400 text-sm">
                      Upload albums on the Upload page to showcase your music collection!
                    </p>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-dark-600 scrollbar-track-transparent">
                  <div className="flex gap-4 w-max pl-1 pr-6 sm:pr-8 md:pr-10">
                  {albums.map(album => (
                    <div key={album.id} className="flex-shrink-0 w-[200px] sm:w-[220px]">
                      {editingAlbum?.id === album.id ? (
                        // Edit form for existing album
                        <div className="bg-dark-800 rounded-lg p-4 border border-dark-700 min-w-[200px]">
                          <div className="space-y-4">
                            <div>
                              <label className="block text-dark-200 font-medium mb-2 text-sm">Album Title</label>
                              <input
                                type="text"
                                value={albumForm.title}
                                onChange={(e) => setAlbumForm(prev => ({ ...prev, title: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="Album title"
                              />
                            </div>
                            <div>
                              <label className="block text-dark-200 font-medium mb-2 text-sm">Artist</label>
                              <input
                                type="text"
                                value={albumForm.artist}
                                onChange={(e) => setAlbumForm(prev => ({ ...prev, artist: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="Artist name"
                              />
                            </div>
                            <div>
                              <label className="block text-dark-200 font-medium mb-2 text-sm">Genre</label>
                              <input
                                type="text"
                                value={albumForm.genre}
                                onChange={(e) => setAlbumForm(prev => ({ ...prev, genre: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="Genre"
                              />
                            </div>
                            <div>
                              <label className="block text-dark-200 font-medium mb-2 text-sm">Price (optional)</label>
                              <input
                                type="number"
                                value={albumForm.price}
                                onChange={(e) => setAlbumForm(prev => ({ ...prev, price: e.target.value }))}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="Price"
                                step="0.01"
                                min="0"
                              />
                            </div>
                            <div>
                              <label className="block text-dark-200 font-medium mb-2 text-sm">Description</label>
                              <textarea
                                value={albumForm.description}
                                onChange={(e) => setAlbumForm(prev => ({ ...prev, description: e.target.value }))}
                                rows={3}
                                className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-black focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                                placeholder="Album description"
                              />
                            </div>
                            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                              <button
                                onClick={handleSaveAlbum}
                                className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
                              >
                                Save Changes
                              </button>
                              <button
                                onClick={handleCancelAlbumEdit}
                                className="flex-1 px-4 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600 transition-colors text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <AlbumCard
                          album={album}
                          onPlay={handlePlayAlbum}
                          onOpen={(album) => handleAlbumClick(album.id)}
                          onEdit={handleEditAlbum}
                          onDelete={handleDeleteAlbum}
                          showActions={isCurrentUser}
                        />
                      )}
                    </div>
                  ))}
                  </div>
                </div>
              )}
            </section>
          )}

          {activeTab === 'concerts' && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl lg:text-2xl font-bold text-white flex items-center font-kyobo">
                  <Calendar className="mr-2 text-primary-400" />
                  {isCurrentUser ? 'My Concerts' : `${profileUser?.artistName || profileUser?.username || 'User'}'s Concerts`}
                </h2>
                {isCurrentUser && (
                  <button
                    onClick={handleAddConcert}
                    className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <Calendar size={16} />
                    <span>Add Concert</span>
                  </button>
                )}
              </div>

              {isLoadingConcerts ? (
                <div className="flex items-center justify-center py-8">
                  <div className="spinner w-8 h-8"></div>
                  <span className="ml-2 text-dark-400">Loading concerts...</span>
                </div>
              ) : concerts.length === 0 && !isAddingConcert ? (
                <div className="text-center py-12">
                  <Calendar className="text-dark-400 mb-4 mx-auto" size={48} />
                  <p className="text-dark-400 mb-2">No upcoming concerts scheduled.</p>
                  {isCurrentUser && (
                    <p className="text-dark-400 text-sm">
                      Add your concert dates to let fans know where to find you!
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {concerts.map(concert => (
                    <div key={concert.id} className="bg-dark-800 rounded-lg p-6 border border-dark-700">
                      {editingConcert?.id === concert.id ? (
                        // Edit form for existing concert
                        <div className="space-y-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-dark-200 font-medium mb-2">Concert Title</label>
                              <input
                                type="text"
                                value={concertForm.title}
                                onChange={(e) => setConcertForm(prev => ({ ...prev, title: e.target.value }))}
                                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="Concert title"
                              />
                            </div>
                            <div>
                              <label className="block text-dark-200 font-medium mb-2">Date</label>
                              <input
                                type="date"
                                value={concertForm.date}
                                onChange={(e) => setConcertForm(prev => ({ ...prev, date: e.target.value }))}
                                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                              />
                            </div>
                            <div>
                              <label className="block text-dark-200 font-medium mb-2">Venue</label>
                              <input
                                type="text"
                                value={concertForm.venue}
                                onChange={(e) => setConcertForm(prev => ({ ...prev, venue: e.target.value }))}
                                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="Venue name"
                              />
                            </div>
                            <div>
                              <label className="block text-dark-200 font-medium mb-2">Location</label>
                              <input
                                type="text"
                                value={concertForm.location}
                                onChange={(e) => setConcertForm(prev => ({ ...prev, location: e.target.value }))}
                                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="City, State/Country"
                              />
                            </div>
                            <div>
                              <label className="block text-dark-200 font-medium mb-2">Ticket Price</label>
                              <input
                                type="number"
                                value={concertForm.ticketPrice}
                                onChange={(e) => setConcertForm(prev => ({ ...prev, ticketPrice: e.target.value }))}
                                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="Price (optional)"
                              />
                            </div>
                            <div>
                              <label className="block text-dark-200 font-medium mb-2">Ticket URL</label>
                              <input
                                type="url"
                                value={concertForm.ticketUrl}
                                onChange={(e) => setConcertForm(prev => ({ ...prev, ticketUrl: e.target.value }))}
                                className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="https://tickets.example.com"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-dark-200 font-medium mb-2">Description</label>
                            <textarea
                              value={concertForm.description}
                              onChange={(e) => setConcertForm(prev => ({ ...prev, description: e.target.value }))}
                              rows={3}
                              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="Concert description (optional)"
                            />
                          </div>
                          <div className="flex space-x-3">
                            <button
                              onClick={handleSaveConcert}
                              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                            >
                              Save Changes
                            </button>
                            <button
                              onClick={handleCancelConcertEdit}
                              className="px-4 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600 transition-colors"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        // Display concert
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h3 className="text-xl font-semibold mb-2" style={{ color: '#000000' }}>{concert.title}</h3>
                            <div className="space-y-2 text-dark-300">
                              <div className="flex items-center space-x-2">
                                <Calendar size={16} className="text-primary-400" />
                                <span>{new Date(concert.date).toLocaleDateString('en-US', { 
                                  weekday: 'long', 
                                  year: 'numeric', 
                                  month: 'long', 
                                  day: 'numeric' 
                                })}</span>
                              </div>
                              <div className="flex items-center space-x-2">
                                <MapPin size={16} className="text-primary-400" />
                                <span>{concert.venue}, {concert.location}</span>
                              </div>
                              {concert.ticketPrice && (
                                <div className="flex items-center space-x-2">
                                  <span className="text-primary-400 font-medium">${concert.ticketPrice}</span>
                                </div>
                              )}
                              {concert.description && (
                                <p className="text-dark-400 mt-2">{concert.description}</p>
                              )}
                            </div>
                            <div className="flex items-center space-x-3 mt-4">
                              {concert.ticketUrl && (
                                <a
                                  href={concert.ticketUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
                                >
                                  Get Tickets
                                </a>
                              )}
                            </div>
                          </div>
                          {isCurrentUser && (
                            <div className="flex items-center space-x-2 ml-4">
                              <button
                                onClick={() => handleEditConcert(concert)}
                                className="p-2 text-dark-400 hover:text-white transition-colors"
                                title="Edit concert"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteConcert(concert.id)}
                                className="p-2 text-red-400 hover:text-red-300 transition-colors"
                                title="Delete concert"
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add concert form */}
                  {isAddingConcert && (
                    <div className="bg-dark-800 rounded-lg p-6 border border-dark-700">
                      <p className="text-lg font-semibold text-white mb-4">Add New Concert</p>
                      <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-dark-200 font-medium mb-2">Concert Title</label>
                            <input
                              type="text"
                              value={concertForm.title}
                              onChange={(e) => setConcertForm(prev => ({ ...prev, title: e.target.value }))}
                              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="Concert title"
                            />
                          </div>
                          <div>
                            <label className="block text-dark-200 font-medium mb-2">Date</label>
                            <input
                              type="date"
                              value={concertForm.date}
                              onChange={(e) => setConcertForm(prev => ({ ...prev, date: e.target.value }))}
                              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            />
                          </div>
                          <div>
                            <label className="block text-dark-200 font-medium mb-2">Venue</label>
                            <input
                              type="text"
                              value={concertForm.venue}
                              onChange={(e) => setConcertForm(prev => ({ ...prev, venue: e.target.value }))}
                              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="Venue name"
                            />
                          </div>
                          <div>
                            <label className="block text-dark-200 font-medium mb-2">Location</label>
                            <input
                              type="text"
                              value={concertForm.location}
                              onChange={(e) => setConcertForm(prev => ({ ...prev, location: e.target.value }))}
                              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="City, State/Country"
                            />
                          </div>
                          <div>
                            <label className="block text-dark-200 font-medium mb-2">Ticket Price</label>
                            <input
                              type="number"
                              value={concertForm.ticketPrice}
                              onChange={(e) => setConcertForm(prev => ({ ...prev, ticketPrice: e.target.value }))}
                              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="Price (optional)"
                            />
                          </div>
                          <div>
                            <label className="block text-dark-200 font-medium mb-2">Ticket URL</label>
                            <input
                              type="url"
                              value={concertForm.ticketUrl}
                              onChange={(e) => setConcertForm(prev => ({ ...prev, ticketUrl: e.target.value }))}
                              className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                              placeholder="https://tickets.example.com"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-dark-200 font-medium mb-2">Description</label>
                          <textarea
                            value={concertForm.description}
                            onChange={(e) => setConcertForm(prev => ({ ...prev, description: e.target.value }))}
                            rows={3}
                            className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="Concert description (optional)"
                          />
                        </div>
                        <div className="flex space-x-3">
                          <button
                            onClick={handleSaveConcert}
                            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                          >
                            Add Concert
                          </button>
                          <button
                            onClick={handleCancelConcertEdit}
                            className="px-4 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600 transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>
          )}

          {activeTab === 'bookmark' && (
            <section>
              <h2 className="text-xl lg:text-2xl font-bold text-white mb-4 flex items-center font-kyobo">
                <Bookmark className="mr-2 text-primary-400" />
                {isCurrentUser ? 'My Bookmarks' : `${profileUser?.username || 'User'}'s Bookmarks`}
              </h2>
              
              {isLoadingBookmarks ? (
                <div className="flex items-center justify-center py-8">
                  <div className="spinner w-8 h-8"></div>
                  <span className="ml-2 text-dark-400">Loading bookmarks...</span>
                </div>
              ) : bookmarks.length === 0 ? (
                <div className="text-center py-12">
                  <Bookmark className="text-dark-400 mb-4 mx-auto" size={48} />
                  <p className="text-dark-400 mb-2">No bookmarks yet.</p>
                  {isCurrentUser && (
                    <p className="text-dark-400 text-sm">
                      Bookmark tracks you love by clicking the bookmark icon on any track!
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {bookmarks.length >= 1 && (
                    <button
                      onClick={() => playQueue(bookmarks)}
                      className="mb-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold text-sm"
                    >
                      {bookmarks.length === 1 ? 'Play Bookmark' : 'Play All Bookmarks'}
                    </button>
                  )}
                  <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-dark-600 scrollbar-track-transparent">
                    <div className="flex gap-4 w-max pl-1 pr-6 sm:pr-8 md:pr-10">
                      {bookmarks.map(track => (
                        <div key={track.id} className="flex-shrink-0 w-[180px] sm:w-[200px]">
                          <TrackCard track={track} compactGrid />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {activeTab === 'liked' && (
            <section>
              <h2 className="text-xl lg:text-2xl font-bold text-white mb-4 flex items-center font-kyobo">
                <ThumbsUp className="mr-2 text-primary-400" />
                {isCurrentUser ? 'Liked Tracks' : `${profileUser?.username || 'User'}'s Liked Tracks`}
              </h2>

              {isLoadingLikedTracks ? (
                <div className="flex items-center justify-center py-8">
                  <div className="spinner w-8 h-8"></div>
                  <span className="ml-2 text-dark-400">Loading liked tracks...</span>
                </div>
              ) : likedTracks.length === 0 ? (
                <div className="text-center py-12">
                  <ThumbsUp className="text-dark-400 mb-4 mx-auto" size={48} />
                  <p className="text-dark-400 mb-2">No liked tracks yet.</p>
                  {isCurrentUser && (
                    <p className="text-dark-400 text-sm">
                      Like tracks from Discover or use the thumbs up on any track!
                    </p>
                  )}
                </div>
              ) : (
                <>
                  {likedTracks.length > 1 && (
                    <button
                      onClick={() => playQueue(likedTracks)}
                      className="mb-4 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-semibold text-sm"
                    >
                      Play All Liked
                    </button>
                  )}
                  <div className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-dark-600 scrollbar-track-transparent">
                    <div className="flex gap-4 w-max pl-1 pr-6 sm:pr-8 md:pr-10">
                      {likedTracks.map(track => (
                        <div key={track.id} className="flex-shrink-0 w-[180px] sm:w-[200px]">
                          <TrackCard track={track} compactGrid />
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </section>
          )}

          {false && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-white flex items-center font-kyobo">
                  <UserIcon className="mr-2 text-primary-400" />
                  About {profileUser?.artistName || profileUser?.username || 'User'}
                </h2>
                {isCurrentUser && (
                  <button
                    onClick={handleEditAbout}
                    className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    <Edit size={16} />
                    <span>Edit About</span>
                  </button>
                )}
              </div>

              {isEditingAbout ? (
                <div className="space-y-6">
                  <div className="bg-dark-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Edit Biography</h3>
                    <textarea
                      value={aboutForm.bio}
                      onChange={(e) => setAboutForm(prev => ({ ...prev, bio: e.target.value }))}
                      rows={4}
                      className="w-full px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                      placeholder="Tell your fans about yourself, your musical journey, and what inspires you..."
                    />
                  </div>

                  <div className="bg-dark-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Edit Musical Genres</h3>
                    <div className="space-y-4">
                      <div className="flex flex-wrap gap-2">
                        {aboutForm.genres.map((genre, index) => (
                          <span
                            key={index}
                            className="flex items-center space-x-2 px-3 py-1 bg-primary-600 text-white rounded-full text-sm"
                          >
                            <span>{genre}</span>
                            <button
                              onClick={() => handleRemoveGenre(genre)}
                              className="text-white hover:text-red-300 transition-colors"
                            >
                              <X size={14} />
                            </button>
                          </span>
                        ))}
                      </div>
                      <div className="flex space-x-2">
                        <select
                          onChange={(e) => {
                            if (e.target.value) {
                              handleAddGenre(e.target.value);
                              e.target.value = '';
                            }
                          }}
                          className="px-4 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                        >
                          <option value="">Add a genre...</option>
                          <option value="Electronic">Electronic</option>
                          <option value="Pop">Pop</option>
                          <option value="Rock">Rock</option>
                          <option value="Hip Hop">Hip Hop</option>
                          <option value="R&B">R&B</option>
                          <option value="Jazz">Jazz</option>
                          <option value="Classical">Classical</option>
                          <option value="Country">Country</option>
                          <option value="Folk">Folk</option>
                          <option value="Reggae">Reggae</option>
                          <option value="Blues">Blues</option>
                          <option value="Funk">Funk</option>
                          <option value="House">House</option>
                          <option value="Techno">Techno</option>
                          <option value="Ambient">Ambient</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-3">
                    <button
                      onClick={handleSaveAbout}
                      className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={handleCancelAboutEdit}
                      className="px-6 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {/* Bio Section */}
                  <div className="bg-dark-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Biography</h3>
                    <p className="text-dark-300 leading-relaxed">
                      {profileUser?.bio || `${profileUser?.artistName || profileUser?.username || 'User'} is a music lover. Follow to stay updated with their latest discoveries.`}
                    </p>
                  </div>

                  {/* Genres Section */}
                  {(() => {
                    const genres = profileUser?.genres ?? [];
                    if (!Array.isArray(genres) || genres.length === 0) return null;
                    return (
                    <div className="bg-dark-800 rounded-lg p-6">
                      <h3 className="text-lg font-semibold text-white mb-3">Favorite Genres</h3>
                      <div className="flex flex-wrap gap-3">
                        {genres.map((genre, index) => (
                          <span
                            key={index}
                            className="px-4 py-2 bg-primary-600 text-white rounded-full text-sm font-medium"
                          >
                            {genre}
                          </span>
                        ))}
                      </div>
                    </div>
                  )
                  })()}

                  {/* Contact/Social Section */}
                  <div className="bg-dark-800 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-white mb-3">Connect</h3>
                    <div className="flex items-center space-x-4">
                      {!isCurrentUser && (
                        <button 
                          onClick={handleStartChat}
                          className="flex items-center space-x-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                        >
                          <MessageCircle size={16} />
                          <span>Message</span>
                        </button>
                      )}
                      <button className="flex items-center space-x-2 px-4 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-600 transition-colors">
                        <Share2 size={16} />
                        <span>Share Profile</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      ) : (
        <div className="text-center py-12">
          <Lock className="text-dark-400 mb-4 mx-auto" size={48} />
          <h2 className="text-2xl font-bold text-white mb-2">This account is private</h2>
          <p className="text-dark-400">Only approved followers can view this user's music and playlists.</p>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-dark-900 rounded-lg p-6 w-full max-w-md">
            <h2 className="text-xl font-bold text-white mb-4">Delete Track</h2>
            <p className="text-dark-300 mb-6">
              Are you sure you want to delete this track? This action cannot be undone.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => handleDeleteTrack(showDeleteConfirm)}
                disabled={deletingTrackId === showDeleteConfirm}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
              >
                {deletingTrackId === showDeleteConfirm ? 'Deleting...' : 'Delete'}
              </button>
              <button
                onClick={handleCancelDelete}
                disabled={deletingTrackId === showDeleteConfirm}
                className="flex-1 bg-dark-700 text-white px-4 py-2 rounded-lg hover:bg-dark-600 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Music Player Modal */}
      <MusicPlayerModal
        track={selectedTrack}
        isOpen={isPlayerModalOpen}
        onClose={handleClosePlayerModal}
      />

      {/* Followers Modal */}
      {profileUser && (!profileUser.isPrivate || isCurrentUser || followStats.isFollowing) && showFollowersModal && (
        <Modal onClose={() => setShowFollowersModal(false)} title="Followers">
          {isFollowersLoading ? (
            <div className="p-4 text-center">Loading...</div>
          ) : followersList.length === 0 ? (
            <div className="p-4 text-center text-dark-400">No followers yet.</div>
          ) : (
            <ul className="divide-y divide-dark-700">
              {followersList.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <img src={getAvatarUrl(f.avatar)} alt={f.username} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    <span className="text-white font-medium truncate">{f.username}</span>
                    <VerifiedBadge verified={f.isVerified || (f as { isVerifiedArtist?: boolean }).isVerifiedArtist} size={16} />
                  </div>
                  {isCurrentUser && (
                    <button
                      type="button"
                      onClick={() => handleRemoveFollower(f.id)}
                      className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors"
                      title="Remove follower"
                    >
                      Remove
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}
      {/* Following Modal */}
      {profileUser && (!profileUser.isPrivate || isCurrentUser || followStats.isFollowing) && showFollowingModal && (
        <Modal onClose={() => setShowFollowingModal(false)} title="Following">
          {isFollowingListLoading ? (
            <div className="p-4 text-center">Loading...</div>
          ) : followingList.length === 0 ? (
            <div className="p-4 text-center text-dark-400">Not following anyone yet.</div>
          ) : (
            <ul className="divide-y divide-dark-700">
              {followingList.map((f) => (
                <li key={f.id} className="flex items-center justify-between gap-3 p-3">
                  <div className="flex items-center space-x-3 min-w-0 flex-1">
                    <img src={getAvatarUrl(f.avatar)} alt={f.username} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    <span className="text-white font-medium truncate">{f.username}</span>
                    <VerifiedBadge verified={f.isVerified || (f as { isVerifiedArtist?: boolean }).isVerifiedArtist} size={16} />
                  </div>
                  {isCurrentUser && (
                    <button
                      type="button"
                      onClick={() => handleUnfollowFromFollowingList(f.id)}
                      className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-dark-400 hover:text-white hover:bg-dark-600 rounded-lg transition-colors flex items-center gap-1.5"
                      title="Unfollow"
                    >
                      <UserMinus size={14} />
                      Unfollow
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {/* Pending follow requests modal */}
      {isCurrentUser && showPendingRequestsModal && (
        <Modal onClose={() => setShowPendingRequestsModal(false)} title="Follow requests">
          {pendingRequests.length === 0 ? (
            <div className="p-4 text-center text-dark-400">No pending requests.</div>
          ) : (
            <ul className="space-y-3">
              {pendingRequests.map((req) => (
                <li key={req.id}>
                  <FollowRequestCard
                    request={req}
                    onAccept={handleAcceptRequest}
                    onDecline={handleDeclineRequest}
                    isLoading={acceptDeclineLoadingId === req.id}
                  />
                </li>
              ))}
            </ul>
          )}
        </Modal>
      )}

      {/* Links to other sites modal (max 6) */}
      {showLinksModal && (
        <Modal onClose={() => setShowLinksModal(false)} title="Links to other sites">
          <p className="text-dark-400 text-sm mb-4">Add up to 6 links (e.g. Twitter, Instagram, Bandcamp).</p>
          <div className="space-y-3 mb-5">
            {linkInputs.map((value, i) => (
              <input
                key={i}
                type="url"
                value={value}
                onChange={(e) => {
                  const next = [...linkInputs];
                  next[i] = e.target.value;
                  setLinkInputs(next);
                }}
                placeholder={`Link ${i + 1}`}
                className="w-full px-3 py-2 bg-dark-700 border border-dark-600 rounded-lg text-white placeholder-dark-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowLinksModal(false)}
              className="px-4 py-2 rounded-lg bg-dark-600 text-white hover:bg-dark-500 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveLinks}
              disabled={isSavingLinks}
              className="px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 transition-colors disabled:opacity-50"
            >
              {isSavingLinks ? 'Saving...' : 'Save'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Profile; 