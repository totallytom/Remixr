import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  Home, 
  Search, 
  MessageCircle, 
  User, 
  Settings,
  Upload,
  ListMusic,
  Music,
  Package,
  ClipboardList,
  LogIn,
  UserPlus,
  RefreshCw,
  RadioReceiver,
  Shield,
} from 'lucide-react';
import { useStore } from '../../store/useStore';
import { getAvatarUrl } from '../../utils/avatar';
import VerifiedBadge from '../VerifiedBadge';
import { FollowService } from '../../services/followService';

const Sidebar: React.FC = () => {
  const { 
    user, 
    isAuthenticated,
    setSettingsOpen,
    player,
    togglePlayerVisibility
  } = useStore();
  
  const navigate = useNavigate();
  const location = useLocation();
  const [followStats, setFollowStats] = useState<{ followers: number; following: number } | null>(null);

  // Use same source as Profile: live count from user_follows so Sidebar and Profile stay in sync
  const fetchFollowStats = () => {
    if (!user?.id) return;
    FollowService.getFollowStats(user.id)
      .then((stats) => setFollowStats({ followers: stats.followers, following: stats.following }))
      .catch(() => setFollowStats(null));
  };

  useEffect(() => {
    if (!user?.id) {
      setFollowStats(null);
      return;
    }
    let cancelled = false;
    FollowService.getFollowStats(user.id)
      .then((stats) => {
        if (!cancelled) setFollowStats({ followers: stats.followers, following: stats.following });
      })
      .catch(() => {
        if (!cancelled) setFollowStats(null);
      });
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') fetchFollowStats();
    };
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', onVisible);
    };
  }, [user?.id]);

  const followersCount = followStats?.followers ?? user?.followers ?? 0;

  const navigationItems = [
    { id: 'upload', label: 'Upload', icon: Upload, path: '/upload', requiresAuth: true },
    { id: 'home', label: 'Home', icon: Home, path: '/', requiresAuth: false },
    { id: 'search', label: 'Search', icon: Search, path: '/search', requiresAuth: false },
    { id: 'discover', label: 'Discover', icon: RadioReceiver, path: '/discover', requiresAuth: true },
    { id: 'playlists', label: 'Playlists', icon: ListMusic, path: '/playlists', requiresAuth: true },
    { id: 'chat', label: 'Chat', icon: MessageCircle, path: '/chat', requiresAuth: true },
    { id: 'profile', label: 'Profile', icon: User, path: '/profile', requiresAuth: true },
    { id: 'admin', label: 'Admin', icon: Shield, path: '/admin', requiresAuth: true, adminOnly: true },
  ];

  // Desktop: Upload is in its own "Create" section; main nav shows the rest. Hide admin unless isAdmin.
  const navItemsWithoutUpload = navigationItems.filter(
    (item) => item.id !== 'upload' && (!('adminOnly' in item && item.adminOnly) || user?.isAdmin)
  );

  const authItems = [
    { id: 'login', label: 'Sign In', icon: LogIn, path: '/login' },
    { id: 'register', label: 'Sign Up', icon: UserPlus, path: '/login?tab=register' }, // Will show register tab
  ];

  const handleNavigation = (path: string) => {
    navigate(path);
  };

  return (
    <>
      {/* Desktop Sidebar - fixed 260px, hidden on mobile */}
      <div className="hidden lg:flex lg:flex-col lg:w-[260px] lg:min-w-[260px] lg:flex-shrink-0 sidebar sidebar-glass-effect h-full">
        {/* Header */}
        <div className="p-5 border-b border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            <img src="/logo/logo.png" alt="Logo" className="w-9 h-9 rounded-xl object-cover ring-1 ring-black/10" />
            <h1 className="text-xl font-bold tracking-tight brand-text">Remixr</h1>
          </div>
        </div>

        {/* User Profile */}
        {user && (
          <div className="p-4 border-b border-[var(--color-border)]">
            <div className="flex items-center gap-3">
              <img
                src={getAvatarUrl(user.avatar)}
                alt={user.username}
                className="w-11 h-11 rounded-xl object-cover flex-shrink-0 ring-1 ring-black/10"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate sidebar-text flex items-center gap-1.5" style={{ color: 'var(--color-text)' }}>
                  {user.username}
                  <VerifiedBadge verified={user.isVerified || user.isVerifiedArtist} size={14} />
                </p>
                <p className="text-xs truncate sidebar-text-secondary" style={{ color: 'var(--color-text-secondary)' }}>
                  {user.role === 'musician'
                    ? `${followersCount.toLocaleString()} followers • ${user.artistName || 'Musician'}`
                    : `${followersCount.toLocaleString()} followers • Listener`
                  }
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Create – Upload CTA (separate from main nav) */}
        {isAuthenticated && (
          <div className="px-3 pt-3 pb-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] px-3 mb-2">
              Create
            </p>
            <button
              onClick={() => handleNavigation('/upload')}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 sidebar-nav-item ${
                location.pathname === '/upload'
                  ? 'bg-[var(--sidebar-primary)] text-white shadow-lg'
                  : 'border-2 border-orange-500/60 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 hover:border-orange-500/80'
              }`}
            >
              <Upload size={20} strokeWidth={2} />
              <span>Upload</span>
            </button>
            <div className="mt-3 border-t border-[var(--color-border)]" />
          </div>
        )}

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="space-y-1">
            {(isAuthenticated ? navItemsWithoutUpload : navItemsWithoutUpload.filter((item) => !item.requiresAuth)).map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const isSearch = item.id === 'search';
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavigation(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 sidebar-nav-item ${
                      isActive
                        ? isSearch
                          ? 'bg-lime-400/20 text-white'
                          : 'bg-[var(--sidebar-primary)] text-white shadow-lg'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--sidebar-surface-light)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    <Icon size={20} strokeWidth={2} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
            {!isAuthenticated && authItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <li key={item.id}>
                  <button
                    onClick={() => handleNavigation(item.path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 sidebar-nav-item ${
                      isActive
                        ? 'bg-[var(--sidebar-primary)] text-white shadow-lg'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--sidebar-surface-light)] hover:text-[var(--color-text)]'
                    }`}
                  >
                    <Icon size={20} strokeWidth={2} />
                    <span>{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Music Player Toggle */}
        <div className="p-3 border-t border-[var(--color-border)]">
          <button
            onClick={togglePlayerVisibility}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 sidebar-nav-item ${
              player.visible
                ? 'bg-[var(--sidebar-primary)] text-white shadow-lg'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--sidebar-surface-light)] hover:text-[var(--color-text)]'
            }`}
          >
            <Music size={20} strokeWidth={2} />
            <span>{player.visible ? 'Hide Player' : 'Show Player'}</span>
            {player.currentTrack && (
              <span className="ml-auto text-xs opacity-80">{player.isPlaying ? '▶' : '⏸'}</span>
            )}
          </button>
        </div>

        {/* Settings */}
        {isAuthenticated && (
          <div className="p-3 border-t border-[var(--color-border)]">
            <button
              onClick={() => setSettingsOpen(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--sidebar-surface-light)] hover:text-[var(--color-text)] transition-all duration-200 sidebar-nav-item"
            >
              <Settings size={20} strokeWidth={2} />
              <span>Settings</span>
            </button>
          </div>
        )}
      </div>

      {/* Mobile top nav */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-dark-800 border-b border-dark-700 shadow-sm backdrop-blur-sm">
        <div className="flex items-center justify-around px-2 py-2">
          {(isAuthenticated
            ? navigationItems.filter(item => {
                const base = ['home', 'search', 'discover', 'playlists', 'upload'];
                if (item.id === 'admin') return user?.isAdmin === true;
                return base.includes(item.id);
              })
            : [
                ...navigationItems.filter(item => ['home', 'search'].includes(item.id)),
                ...authItems,
              ]
          ).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            const isUpload = item.id === 'upload';
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 ${
                  isUpload
                    ? 'bg-orange-500/90 hover:bg-orange-500 text-white border border-orange-400/50 shadow-md'
                    : isActive
                    ? item.id === 'search'
                      ? 'text-white bg-lime-400/20'
                      : 'text-white bg-[var(--sidebar-primary)]/20'
                    : 'text-white hover:bg-white/10 hover:text-[var(--sidebar-primary)]'
                }`}
              >
                <Icon size={20} strokeWidth={2} />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
          {isAuthenticated && (
            <button
              onClick={() => setSettingsOpen(true)}
              className="flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 text-white hover:bg-white/10 hover:text-[var(--sidebar-primary)]"
            >
              <Settings size={20} strokeWidth={2} />
              <span className="text-xs font-medium">Settings</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-dark-800 border-t border-dark-700 shadow-lg backdrop-blur-sm">
        <div className="flex items-center justify-around px-2 py-2">
          {(isAuthenticated
            ? navigationItems.filter(item => ['chat', 'profile'].includes(item.id))
            : []
          ).map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 ${
                  isActive
                    ? item.id === 'search'
                      ? 'text-white bg-lime-400/20'
                      : 'text-white bg-[var(--sidebar-primary)]/20'
                    : 'text-white hover:bg-white/10 hover:text-[var(--sidebar-primary)]'
                }`}
              >
                <Icon size={18} strokeWidth={2} />
                <span className="text-xs font-medium">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={togglePlayerVisibility}
            className={`flex flex-col items-center gap-1 px-3 py-2 rounded-xl transition-all duration-200 ${
              player.visible
                ? 'text-white bg-[var(--sidebar-primary)]/20'
                : 'text-white hover:bg-white/10 hover:text-[var(--sidebar-primary)]'
            }`}
          >
            <Music size={18} strokeWidth={2} />
            <span className="text-xs font-medium">Player</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar; 