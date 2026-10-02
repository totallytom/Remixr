import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Home,
  MessageCircle,
  User,
  Settings,
  Upload,
  ListMusic,
  Music,
  ClipboardList,
  LogIn,
  UserPlus,
  RadioReceiver,
  Shield,
  Info,
  BarChart2,
  Lock,
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
  const { t } = useTranslation();
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
    { id: 'upload', label: t('nav.upload'), icon: Upload, path: '/upload', requiresAuth: true },
    { id: 'home', label: t('nav.home'), icon: Home, path: '/', requiresAuth: false },
    { id: 'discover', label: t('nav.discover'), icon: RadioReceiver, path: '/discover', requiresAuth: true },
    { id: 'playlists', label: t('nav.playlists'), icon: ListMusic, path: '/playlists', requiresAuth: true },
    { id: 'chat', label: t('nav.chat'), icon: MessageCircle, path: '/chat', requiresAuth: true },
    { id: 'profile', label: t('nav.profile'), icon: User, path: '/profile', requiresAuth: true },
    { id: 'analytics', label: 'Analytics', icon: BarChart2, path: '/analytics', requiresAuth: true, musicianOnly: true },
    { id: 'admin', label: t('nav.admin'), icon: Shield, path: '/admin', requiresAuth: true, adminOnly: true },
  ];

  // Desktop: Upload is in its own "Create" section; main nav shows the rest.
  // Hide admin unless isAdmin; hide analytics unless musician role.
  const isMusicianUser = user?.role === 'musician' || user?.role === 'Musician';
  const navItemsWithoutUpload = navigationItems.filter(
    (item) =>
      item.id !== 'upload' &&
      (!('adminOnly' in item && item.adminOnly) || user?.isAdmin) &&
      (!('musicianOnly' in item && item.musicianOnly) || isMusicianUser)
  );

  const authItems = [
    { id: 'login', label: t('nav.signIn'), icon: LogIn, path: '/login' },
    { id: 'register', label: t('nav.signUp'), icon: UserPlus, path: '/signup' },
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
            <h1 className="text-xl font-bold tracking-tight brand-text">Re-Mixed</h1>
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
                  {user.subscriptionTier === 'artist' && (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-yellow-500 text-white leading-none shadow-sm flex-shrink-0">
                      ★ PRO
                    </span>
                  )}
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
        <div className="px-3 pt-3 pb-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] px-3 mb-2">
            {t('nav.create')}
          </p>
          <button
            onClick={() => handleNavigation('/upload')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 sidebar-nav-item ${
              location.pathname === '/upload'
                ? 'bg-[var(--sidebar-primary)] text-white shadow-lg'
                : isAuthenticated
                ? 'border-2 border-orange-500/60 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 hover:border-orange-500/80'
                : 'border-2 border-orange-500/30 bg-orange-500/5 text-orange-500/50 hover:bg-orange-500/10'
            }`}
          >
            <Upload size={20} strokeWidth={2} className={!isAuthenticated ? 'opacity-50' : ''} />
            <span className={!isAuthenticated ? 'opacity-50' : ''}>{t('nav.upload')}</span>
            {!isAuthenticated && <Lock size={11} className="ml-auto opacity-40" />}
          </button>
          <div className="mt-3 border-t border-[var(--color-border)]" />
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 overflow-y-auto">
          <ul className="space-y-1">
            {navItemsWithoutUpload.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              const isLocked = !isAuthenticated && item.requiresAuth;
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
                    <Icon size={20} strokeWidth={2} className={isLocked ? 'opacity-50' : ''} />
                    <span className={isLocked ? 'opacity-50' : ''}>{item.label}</span>
                    {isLocked && <Lock size={11} className="ml-auto opacity-30" />}
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

        {/* Utility row — player toggle, privacy, terms, settings (compact icons so the
            nav list above keeps its space on shorter screens; each has a tooltip) */}
        <div className="p-2.5 border-t border-[var(--color-border)] flex items-center justify-center gap-1.5">
          <button
            onClick={togglePlayerVisibility}
            title={player.visible ? t('nav.hidePlayer') : t('nav.showPlayer')}
            className={`relative w-9 h-9 rounded-lg flex items-center justify-center transition-all duration-200 ${
              player.visible
                ? 'bg-[var(--sidebar-primary)] text-white'
                : 'text-[var(--color-text-secondary)] hover:bg-[var(--sidebar-surface-light)] hover:text-[var(--color-text)]'
            }`}
          >
            <Music size={17} strokeWidth={2} />
            {player.currentTrack && (
              <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[var(--sidebar-primary)]" />
            )}
          </button>

          <a
            href="https://info.re-mixed.net/privacy"
            target="_blank"
            rel="noreferrer"
            title={t('nav.privacyPolicy')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--sidebar-surface-light)] hover:text-[var(--color-text)] transition-all duration-200"
          >
            <Info size={17} strokeWidth={2} />
          </a>

          <a
            href="https://info.re-mixed.net/terms"
            target="_blank"
            rel="noreferrer"
            title={t('nav.termsAgreement')}
            className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--sidebar-surface-light)] hover:text-[var(--color-text)] transition-all duration-200"
          >
            <ClipboardList size={17} strokeWidth={2} />
          </a>

          {isAuthenticated && (
            <button
              onClick={() => setSettingsOpen(true)}
              title={t('nav.settings')}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--color-text-secondary)] hover:bg-[var(--sidebar-surface-light)] hover:text-[var(--color-text)] transition-all duration-200"
            >
              <Settings size={17} strokeWidth={2} />
            </button>
          )}
        </div>

        {/* Copyright */}
        <div className="px-5 py-3 border-t border-[var(--color-border)]">
          <p className="text-[10px] text-[var(--color-text-secondary)] opacity-50 leading-tight">
            © 2026 Amulet Studios LLC. All rights reserved.
          </p>
        </div>
      </div>

      {/* Mobile bottom tab bar — 6 primary tabs, replaces old top + bottom navs */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-50 h-14 bg-black/95 border-t border-gray-800 backdrop-blur-md"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-full px-1">
          {(isAuthenticated ? [
            { id: 'home',       label: t('nav.home'),      icon: Home,          path: '/' },
            { id: 'discover',   label: t('nav.discover'),  icon: RadioReceiver, path: '/discover' },
            { id: 'upload',     label: t('nav.upload'),    icon: Upload,        path: '/upload', accent: true },
            { id: 'playlists', label: t('nav.playlists'), icon: ListMusic,     path: '/playlists' },
            { id: 'chat',       label: t('nav.chat'),      icon: MessageCircle, path: '/chat' },
            { id: 'profile',    label: t('nav.profile'),   icon: User,          path: '/profile' },
          ] : [
            { id: 'home',       label: t('nav.home'),      icon: Home,          path: '/' },
            { id: 'discover',   label: t('nav.discover'),  icon: RadioReceiver, path: '/discover' },
            { id: 'playlists',  label: t('nav.playlists'), icon: ListMusic,     path: '/playlists' },
            { id: 'login',      label: t('nav.signIn'),    icon: LogIn,         path: '/login' },
          ]).map((item) => {
            const Icon = item.icon;
            const isActive = item.id === 'home'
              ? location.pathname === '/'
              : location.pathname.startsWith(item.path) && item.path !== '/';
            const isAccent = 'accent' in item && item.accent;
            if (isAccent) {
              return (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.path)}
                  className="relative flex flex-col items-center justify-center flex-1 active:scale-95 transition-all duration-200"
                  style={{ minWidth: 44 }}
                >
                  <div className={`flex items-center justify-center w-11 h-11 rounded-2xl shadow-lg transition-all duration-200 ${
                    isActive
                      ? 'bg-orange-500 scale-110'
                      : 'bg-orange-500 hover:bg-orange-400'
                  }`}>
                    <Icon size={22} strokeWidth={2.2} className="text-white" />
                  </div>
                  <span className={`text-[9px] font-medium mt-0.5 ${isActive ? 'text-orange-400' : 'text-white/60'}`}>
                    {item.label}
                  </span>
                </button>
              );
            }
            return (
              <button
                key={item.id}
                onClick={() => handleNavigation(item.path)}
                className="relative flex flex-col items-center justify-center gap-0.5 flex-1 h-14 rounded-xl transition-all duration-200 active:scale-95"
                style={{ minWidth: 44, minHeight: 44 }}
              >
                <div className="relative">
                  <Icon
                    size={20}
                    strokeWidth={isActive ? 2.5 : 1.8}
                    className={isActive ? 'text-[var(--sidebar-primary)]' : 'text-white/60'}
                  />
                  {item.id === 'profile' && user?.subscriptionTier === 'artist' && (
                    <span className="absolute -top-1 -right-2 text-[7px] font-bold bg-yellow-500 text-white px-0.5 rounded leading-tight">PRO</span>
                  )}
                </div>
                <span className={`text-[9px] font-medium ${isActive ? 'text-[var(--sidebar-primary)]' : 'text-white/60'}`}>
                  {item.label}
                </span>
                {isActive && (
                  <span className="absolute bottom-1 w-1 h-1 rounded-full bg-[var(--sidebar-primary)]" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};

export default Sidebar; 