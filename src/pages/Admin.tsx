import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, RefreshCw, ArrowLeft, LayoutDashboard, Flag, Music, Users, History } from 'lucide-react';
import { useStore } from '../store/useStore';
import { useAlerts } from '../contexts/AlertContext';
import { AdminService, type AdminStats, type TrackFilter, type UserFilter } from '../services/adminService';
import { hardShadow, Sticker } from '../components/ui/brutal';
import OverviewPanel, { type AdminJump } from '../components/admin/OverviewPanel';
import ReportsPanel from '../components/admin/ReportsPanel';
import TracksPanel from '../components/admin/TracksPanel';
import UsersPanel from '../components/admin/UsersPanel';
import ActivityPanel from '../components/admin/ActivityPanel';

type Tab = 'overview' | 'reports' | 'tracks' | 'users' | 'activity';

/**
 * Admin command centre for Re-Mixed — web and mobile share one backend, so
 * everything here (reports, tracks, users) covers both apps. Every action runs
 * through a server-side admin_* function that checks admin rights, writes the
 * audit log and notifies the affected user.
 */
export default function Admin() {
  const { user, isAuthenticated } = useStore();
  const { addAlert } = useAlerts();
  const navigate = useNavigate();

  const [tab, setTab] = useState<Tab>('overview');
  const [trackFilter, setTrackFilter] = useState<TrackFilter>('all');
  const [userFilter, setUserFilter] = useState<UserFilter>('all');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  // Bumped by Refresh to remount the active panel and reload its data.
  const [refreshKey, setRefreshKey] = useState(0);

  const isAdmin = Boolean((user as { isAdmin?: boolean } | null)?.isAdmin);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      navigate('/', { replace: true });
      return;
    }
    if (!isAdmin) {
      addAlert('Access denied. Admin only.', 'error');
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, user, isAdmin, navigate]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      setStats(await AdminService.getStats());
    } catch (e) {
      setStatsError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAdmin) loadStats();
  }, [isAdmin, loadStats]);

  const refresh = () => {
    loadStats();
    setRefreshKey((k) => k + 1);
  };

  const jump = (j: AdminJump) => {
    if (j.tab === 'tracks') setTrackFilter(j.filter);
    if (j.tab === 'users') setUserFilter(j.filter);
    setTab(j.tab);
  };

  if (!user || !isAdmin) return null;

  const openReports = (stats?.open_user_reports ?? 0) + (stats?.open_track_reports ?? 0);
  const TABS: { id: Tab; label: string; icon: React.ComponentType<{ size?: number }>; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'reports', label: 'Reports', icon: Flag, badge: openReports },
    { id: 'tracks', label: 'Tracks', icon: Music, badge: stats?.tracks_pending },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'activity', label: 'Activity', icon: History },
  ];

  return (
    <div
      className="min-h-screen bg-[#faf6ec] px-4 pt-6 pb-28 md:px-8 md:py-8"
      style={{ backgroundImage: 'radial-gradient(rgba(0,0,0,0.07) 1px, transparent 1px)', backgroundSize: '18px 18px' }}
    >
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-wrap items-center gap-3 mb-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl border-2 border-black bg-white shadow-[2px_2px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all"
            aria-label="Back"
          >
            <ArrowLeft size={18} />
          </button>
          <span className="w-11 h-11 rounded-xl border-2 border-black bg-teal-300 flex items-center justify-center" style={hardShadow(3)}>
            <Shield size={22} />
          </span>
          <div>
            <h1 className="font-kotra text-3xl text-black leading-none">Control Room</h1>
            <p className="text-xs text-black/60 mt-1">Moderation for the Re-Mixed website and mobile app</p>
          </div>
          <Sticker rotate={-4} className="hidden sm:inline-flex ml-1">Admin</Sticker>
          <button
            type="button"
            onClick={refresh}
            disabled={statsLoading}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-black bg-white text-sm font-bold shadow-[3px_3px_0_0_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none transition-all disabled:opacity-60"
          >
            <RefreshCw size={16} className={statsLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </header>

        {/* Tabs */}
        <nav aria-label="Admin sections" className="flex gap-2 overflow-x-auto pb-2 mb-6 -mx-1 px-1">
          {TABS.map(({ id, label, icon: Icon, badge }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 border-black text-sm font-bold whitespace-nowrap transition-all ${
                  active ? 'bg-black text-white translate-x-[2px] translate-y-[2px]' : 'bg-white text-black shadow-[3px_3px_0_0_#000] hover:bg-teal-50'
                }`}
              >
                <Icon size={16} />
                {label}
                {!!badge && (
                  <span className={`min-w-[1.25rem] px-1.5 py-0.5 rounded-md text-[11px] leading-none border-2 ${active ? 'border-white bg-red-400 text-black' : 'border-black bg-red-400 text-black'}`}>
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Panels */}
        <main key={refreshKey}>
          {tab === 'overview' && (
            <OverviewPanel stats={stats} loading={statsLoading} error={statsError} onJump={jump} />
          )}
          {tab === 'reports' && <ReportsPanel onChanged={loadStats} />}
          {tab === 'tracks' && <TracksPanel initialFilter={trackFilter} onChanged={loadStats} />}
          {tab === 'users' && <UsersPanel initialFilter={userFilter} currentUserId={user.id} onChanged={loadStats} />}
          {tab === 'activity' && <ActivityPanel />}
        </main>
      </div>
    </div>
  );
}
