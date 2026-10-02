import React from 'react';
import { Flag, Music, Users, ShieldAlert, Scale, Clock, BadgeCheck, UserX } from 'lucide-react';
import type { AdminStats } from '../../services/adminService';
import { hardShadow } from '../ui/brutal';
import { Panel, Loading, ErrorText } from './shared';
import ActivityPanel from './ActivityPanel';

export type AdminJump =
  | { tab: 'reports' }
  | { tab: 'tracks'; filter: 'pending_review' | 'disabled' | 'published' | 'all' }
  | { tab: 'users'; filter: 'verified' | 'suspended' | 'all' };

const Tile: React.FC<{
  label: string;
  value: number | undefined;
  sub?: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  tone?: string;
  onClick?: () => void;
}> = ({ label, value, sub, icon: Icon, tone = 'bg-white', onClick }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={!onClick}
    className={`text-left p-4 rounded-2xl border-2 border-black ${tone} transition-transform enabled:hover:-translate-y-0.5 disabled:cursor-default`}
    style={hardShadow(4)}
  >
    <div className="flex items-center justify-between mb-2">
      <span className="text-xs font-bold uppercase tracking-wide text-black/70">{label}</span>
      <Icon size={16} className="text-black" />
    </div>
    <p className="font-kotra text-4xl text-black leading-none">{value ?? '—'}</p>
    {sub && <p className="text-xs text-black/60 mt-1.5">{sub}</p>}
  </button>
);

const OverviewPanel: React.FC<{
  stats: AdminStats | null;
  loading: boolean;
  error: string | null;
  onJump: (j: AdminJump) => void;
}> = ({ stats, loading, error, onJump }) => {
  if (loading && !stats) return <Panel title="Overview"><Loading /></Panel>;
  if (error && !stats) return <Panel title="Overview"><ErrorText>{error}</ErrorText></Panel>;
  const s = stats;
  const needsAttention = (s?.open_user_reports ?? 0) + (s?.open_track_reports ?? 0) + (s?.open_dmca_notices ?? 0) + (s?.tracks_pending ?? 0);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="font-kotra text-2xl text-black mb-1">Needs attention</h2>
        <p className="text-sm text-black/60 mb-4">
          {needsAttention === 0 ? 'All clear — nothing waiting on you.' : `${needsAttention} item${needsAttention === 1 ? '' : 's'} waiting across web and mobile.`}
        </p>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Tile label="User & message reports" value={s?.open_user_reports} icon={Flag}
            tone={s?.open_user_reports ? 'bg-red-300' : 'bg-white'} onClick={() => onJump({ tab: 'reports' })} />
          <Tile label="Track reports" value={s?.open_track_reports} icon={ShieldAlert}
            tone={s?.open_track_reports ? 'bg-orange-300' : 'bg-white'} onClick={() => onJump({ tab: 'reports' })} />
          <Tile label="Tracks in review" value={s?.tracks_pending} icon={Clock}
            tone={s?.tracks_pending ? 'bg-yellow-300' : 'bg-white'} onClick={() => onJump({ tab: 'tracks', filter: 'pending_review' })} />
          <Tile label="DMCA notices" value={s?.open_dmca_notices} icon={Scale}
            sub={s?.counter_notices ? `${s.counter_notices} counter-notice${s.counter_notices > 1 ? 's' : ''} open` : 'Formal copyright claims'}
            tone={s?.open_dmca_notices ? 'bg-red-300' : 'bg-white'} />
        </div>
      </div>

      <div>
        <h2 className="font-kotra text-2xl text-black mb-4">Platform</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Tile label="Users" value={s?.users_total} sub={`+${s?.users_new_7d ?? 0} this week`} icon={Users}
            onClick={() => onJump({ tab: 'users', filter: 'all' })} />
          <Tile label="Verified artists" value={s?.verified_artists} icon={BadgeCheck} tone="bg-teal-300"
            onClick={() => onJump({ tab: 'users', filter: 'verified' })} />
          <Tile label="Live tracks" value={s?.tracks_published} sub={`+${s?.tracks_new_7d ?? 0} uploads this week`} icon={Music}
            onClick={() => onJump({ tab: 'tracks', filter: 'published' })} />
          <Tile label="Taken down" value={s?.tracks_taken_down} sub={`${s?.users_suspended ?? 0} users suspended`} icon={UserX}
            onClick={() => onJump({ tab: 'tracks', filter: 'disabled' })} />
        </div>
      </div>

      <ActivityPanel limit={8} compact />
    </div>
  );
};

export default OverviewPanel;
