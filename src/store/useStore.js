import { create } from 'zustand';
import { AuthService } from '../services/authService';
import { MusicService } from '../services/musicService';
import { supabase } from '../services/supabase';

export const useStore = create((set, get) => ({
  // --------------------
  // INITIAL STATE
  // --------------------
  user: null,
  isAuthenticated: false,
  isAuthInitialized: true,

  player: {
    currentTrack: null,
    isPlaying: false,
    volume: 0.7,
    progress: 0,
    queue: [],
    visible: false,
    audioElement: null,
    duration: 0,
    currentTime: 0,
    isLoaded: false,
    isBuffering: false,
    playbackRate: 1,
    repeatMode: 'none',
    shuffle: false,
    originalQueue: [],
    trackHistory: [],
  },

  chats: [],
  activeChat: null,
  comments: [],
  playlists: [],

  sidebarOpen: true,
  currentView: 'home',
  isSettingsOpen: false,

  theme: {
    type: 'light',
    accentColor: 'primary',
    customSecondaryColor: null,
    customBackgroundColor: null,
  },

  playEvent: 0,

  // Manual status: 'online' | 'idle' | 'invisible' (persisted in localStorage)
  userStatus: (() => {
    try {
      const s = localStorage.getItem('sypher_user_status');
      return s === 'idle' || s === 'invisible' ? s : 'online';
    } catch {
      return 'online';
    }
  })(),

  // --------------------
  // BASIC ACTIONS
  // --------------------
  setUser: (user) => set({ user }),
  setUserStatus: (userStatus) => {
    try {
      localStorage.setItem('sypher_user_status', userStatus);
    } catch (_) {}
    set({ userStatus });
  },
  setAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
  setChats: (chats) => set({ chats }),
  setPlaylists: (playlists) => set({ playlists }),
  deletePlaylist: (playlistId) => set((s) => ({
    playlists: s.playlists.filter(p => p.id !== playlistId)
  })),
  setSettingsOpen: (isSettingsOpen) => set({ isSettingsOpen }),
  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  triggerPlayEvent: () => set((s) => ({ playEvent: s.playEvent + 1 })),
  setTheme: (theme) => set({ theme }),

  // --------------------
  // AUDIO INIT
  // --------------------
  initializeAudio: () => {
    const audio = new Audio();
    audio.preload = 'metadata';

    audio.addEventListener('loadedmetadata', () => {
      set((s) => ({
        player: { ...s.player, duration: audio.duration, isLoaded: true },
      }));
    });

    audio.addEventListener('timeupdate', () => {
      set((s) => ({
        player: {
          ...s.player,
          currentTime: audio.currentTime,
          progress: audio.currentTime,
        },
      }));
    });

    audio.addEventListener('ended', () => {
      const { player } = get();
      if (player.repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
      } else if (player.queue.length > 0) {
        get().skipToNext();
      } else {
        set((s) => ({
          player: { ...s.player, isPlaying: false },
        }));
      }
    });

    audio.addEventListener('error', (e) => {
      const msg = audio.error ? `code=${audio.error.code} message=${audio.error.message}` : String(e);
      console.warn('Audio failed to load or play', audio.src, msg, e);
    });

    set((s) => ({
      player: { ...s.player, audioElement: audio },
    }));
  },

  // --------------------
  // PLAYER CONTROLS
  // --------------------
  setCurrentTrack: (track, addToHistory = true) => {
    const { player } = get();
    if (!player.audioElement || !track?.audioUrl) return;

    if (addToHistory && player.currentTrack && player.currentTrack.id !== track.id) {
      set((s) => ({
        player: {
          ...s.player,
          trackHistory: [...s.player.trackHistory, s.player.currentTrack],
        },
      }));
    }

    player.audioElement.pause();
    player.audioElement.src = track.audioUrl;
    player.audioElement.load();

    set((s) => ({
      player: {
        ...s.player,
        currentTrack: track,
        currentTime: 0,
        progress: 0,
        isLoaded: false,
      },
    }));
  },

  playTrack: (track) => {
    const { player } = get();
    if (!track?.audioUrl || !player.audioElement) return;

    set((s) => ({
      player: { ...s.player, visible: true },
    }));

    if (player.currentTrack?.id !== track.id) {
      get().setCurrentTrack(track);
    }

    player.audioElement
      .play()
      .then(() =>
        set((s) => ({ player: { ...s.player, isPlaying: true } }))
      )
      .catch(console.error);
  },

  pauseTrack: () => {
    const { player } = get();
    if (player.audioElement) {
      player.audioElement.pause();
      set((s) => ({ player: { ...s.player, isPlaying: false } }));
    }
  },

  resumeTrack: () => {
    const { player } = get();
    if (player.audioElement) {
      player.audioElement.play();
      set((s) => ({ player: { ...s.player, isPlaying: true } }));
    }
  },

  skipToNext: () => {
    const { player } = get();
    if (!player.queue.length) return;

    const [next, ...rest] = player.queue;
    get().setCurrentTrack(next);
    set((s) => ({ player: { ...s.player, queue: rest } }));
    get().resumeTrack();
  },

  skipToPrevious: () => {
    const { player } = get();
    const currentTime = player.audioElement?.currentTime ?? player.currentTime ?? 0;
    if (currentTime > 3 && player.audioElement) {
      player.audioElement.currentTime = 0;
      return;
    }
    if (!player.trackHistory?.length) {
      if (player.audioElement) player.audioElement.currentTime = 0;
      return;
    }
    const newHistory = player.trackHistory.slice(0, -1);
    const prevTrack = player.trackHistory[player.trackHistory.length - 1];
    const newQueue = player.currentTrack ? [player.currentTrack, ...player.queue] : player.queue;
    set((s) => ({
      player: {
        ...s.player,
        trackHistory: newHistory,
        queue: newQueue,
      },
    }));
    get().setCurrentTrack(prevTrack, false);
    get().resumeTrack();
  },

  seekTo: (time) => {
    const { player } = get();
    if (player.audioElement) {
      player.audioElement.currentTime = time;
    }
  },

  togglePlayerVisibility: () =>
    set((s) => ({
      player: { ...s.player, visible: !s.player.visible },
    })),

  setQueue: (tracks) =>
    set((s) => ({ player: { ...s.player, queue: tracks } })),

  playQueue: (tracks) => {
    if (!tracks?.length) return;
    const rest = tracks.slice(1);
    set((s) => ({
      player: {
        ...s.player,
        queue: rest,
        originalQueue: rest,
        trackHistory: [],
        visible: true,
      },
    }));
    get().playTrack(tracks[0]);
  },

  addToQueue: (track) =>
    set((s) => {
      if (!track) return s;
      return {
        player: {
          ...s.player,
          queue: [...s.player.queue, track],
          originalQueue: s.player.shuffle
            ? [...s.player.originalQueue, track]
            : s.player.originalQueue,
        },
      };
    }),

  removeFromQueue: (trackId) =>
    set((s) => {
      const removeFirstMatch = (tracks) => {
        const index = tracks.findIndex((t) => t.id === trackId);
        if (index === -1) return tracks;
        const next = [...tracks];
        next.splice(index, 1);
        return next;
      };

      return {
        player: {
          ...s.player,
          queue: removeFirstMatch(s.player.queue),
          originalQueue: removeFirstMatch(s.player.originalQueue),
        },
      };
    }),

  // --------------------
  // AUTH
  // --------------------
  login: async (email, password) => {
    const user = await AuthService.login({ email, password });
    set({ user, isAuthenticated: true });
  },

  logout: async () => {
    await AuthService.logout();
    localStorage.removeItem('supabase.auth.session');
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    const { user, isAuthenticated } = get();
    if (user && isAuthenticated) {
      return;
    }
    try {
      const user = await AuthService.getCurrentUser();
      if (user) {
        set({ user, isAuthenticated: true });
      } else {
        set({ user: null, isAuthenticated: false });
      }
    } catch (error) {
      console.error('Error fetching current user in checkAuth:', error);
      set({ user: null, isAuthenticated: false });
    }
  },

  initializeAuth: () => {
    let lastUserId = undefined;

    const { data } = AuthService.onAuthStateChange((user) => {
      // Skip duplicate events for the same user (Supabase fires SIGNED_IN twice)
      const incomingId = user?.id ?? null;
      if (incomingId === lastUserId) return;
      lastUserId = incomingId;
      set({ user, isAuthenticated: !!user, isAuthInitialized: true });
    });

    return () => {
      data?.subscription?.unsubscribe();
    };
  },

  updateProfile: async (updatesOrUser) => {
    const { user } = get();
    if (!user) throw new Error('Not authenticated');
    // If passed a full user object (e.g. from togglePrivateAccount), just sync store
    if (updatesOrUser?.id && updatesOrUser?.username !== undefined) {
      set({ user: updatesOrUser });
      return updatesOrUser;
    }
    const updated = await AuthService.updateProfile(user.id, updatesOrUser);
    set({ user: updated });
    return updated;
  },

  togglePrivateAccount: async (userId, isPrivate) => {
    const updated = await AuthService.togglePrivateAccount(userId, isPrivate);
    set({ user: updated });
    return updated;
  },

  changePassword: async (currentPassword, newPassword) => {
    await AuthService.changePassword(currentPassword, newPassword);
  },

  setUserAvatar: (avatarUrl) =>
    set((s) => ({ user: s.user ? { ...s.user, avatar: avatarUrl } : null })),
}));
