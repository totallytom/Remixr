import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BarChart2, Play, Heart, Users, TrendingUp,
  RefreshCw, ChevronDown, MoreHorizontal,
  ArrowUpRight, ArrowDownRight,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import {
  analyticsService,
  type ArtistOverview,
  type TrackStat,
  type DailyPlay,
  type DailyListeners,
  type TopListener,
} from '../services/analyticsService';
import { format, parseISO } from 'date-fns';

type ChartPoint = { x: string; y: number };

const fmtNum = (n: number) =>
  n >= 1000 ? `${(n / 1000).toFixed(1)}k` : n.toString();

// ── Semicircle Gauge ──────────────────────────────────────────────────────────
function GaugeChart({
  value,
  max,
  color = '#ef4444',
}: {
  value: number;
  max: number;
  color?: string;
}) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0;
  const r = 70;
  const pathLen = Math.PI * r;
  const dash = pathLen * pct;

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 110" className="w-full max-w-[240px]">
        <path
          d="M 30 100 A 70 70 0 0 1 170 100"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="18"
          strokeLinecap="round"
        />
        <path
          d="M 30 100 A 70 70 0 0 1 170 100"
          fill="none"
          stroke={color}
          strokeWidth="18"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${pathLen}`}
        />
        <circle cx="100" cy="100" r="10" fill="rgba(255,255,255,0.10)" />
        <circle cx="100" cy="100" r="5" fill={color} opacity="0.9" />
      </svg>
      <div className="text-center -mt-3">
        <p className="text-3xl font-bold text-white">{fmtNum(value)}</p>
        <p className="text-xs text-white/35 mt-1">
          You are at {Math.round(pct * 100)}% of {fmtNum(max)} plays
        </p>
      </div>
    </div>
  );
}

// ── Bar Chart ────────────────────────────────────────────────────────────────
function BarChartSVG({ data }: { data: ChartPoint[] }) {
  if (data.length === 0) {
    return (
      <p className="text-center text-white/30 text-sm py-8">
        No data for this period
      </p>
    );
  }

  const W = 380;
  const H = 140;
  const PAD = { top: 12, right: 38, bottom: 24, left: 30 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;
  const maxY = Math.max(...data.map((d) => d.y), 1);

  const slotW = iW / data.length;
  const barW = Math.max(slotW * 0.55, 3);
  const toX = (i: number) => PAD.left + slotW * i + (slotW - barW) / 2;
  const toH = (v: number) => Math.max((v / maxY) * iH, 2);
  const toY = (v: number) => PAD.top + iH - toH(v);

  const goalY = PAD.top + iH * 0.28;
  const yTicks = [0, Math.round(maxY / 2), maxY];

  const sorted = [...data.map((d) => d.y)].sort((a, b) => b - a);
  const topVals = new Set(sorted.slice(0, Math.max(1, Math.ceil(data.length * 0.25))));

  const sparseLabels = data
    .map((d, i) => ({ d, i }))
    .filter(({ i }) =>
      i === 0 ||
      i === data.length - 1 ||
      i % Math.max(1, Math.floor(data.length / 5)) === 0
    );

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: H }}>
      {yTicks.map((v) => (
        <line
          key={v}
          x1={PAD.left} y1={toY(v)}
          x2={PAD.left + iW} y2={toY(v)}
          stroke="rgba(255,255,255,0.04)"
          strokeWidth="1"
        />
      ))}

      <line
        x1={PAD.left} y1={goalY}
        x2={PAD.left + iW} y2={goalY}
        stroke="#3b82f6"
        strokeWidth="1.2"
        strokeDasharray="5 4"
      />
      <text
        x={PAD.left + iW + 3}
        y={goalY}
        fontSize="7.5"
        fill="#3b82f6"
        dominantBaseline="middle"
        fontWeight="700"
      >
        GOAL
      </text>

      {yTicks.map((v) => (
        <text
          key={v}
          x={PAD.left - 4}
          y={toY(v)}
          fontSize="7.5"
          fill="rgba(255,255,255,0.28)"
          textAnchor="end"
          dominantBaseline="middle"
        >
          {v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
        </text>
      ))}

      {data.map((d, i) => (
        <rect
          key={i}
          x={toX(i)}
          y={toY(d.y)}
          width={barW}
          height={toH(d.y)}
          rx={3}
          fill={topVals.has(d.y) ? '#3b82f6' : 'rgba(255,255,255,0.10)'}
        />
      ))}

      {sparseLabels.map(({ d, i }) => {
        try {
          return (
            <text
              key={i}
              x={toX(i) + barW / 2}
              y={H - 5}
              fontSize="7.5"
              fill="rgba(255,255,255,0.28)"
              textAnchor="middle"
            >
              {format(parseISO(d.x), 'MMM d')}
            </text>
          );
        } catch {
          return null;
        }
      })}
    </svg>
  );
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
interface StatCardProps {
  label: string;
  value: string;
  trend?: number;
  icon: React.ReactNode;
  iconBg: string;
  delay?: number;
}

function StatCard({ label, value, trend, icon, iconBg, delay = 0 }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="rounded-2xl bg-white/[0.05] border border-white/[0.07] p-5 flex flex-col gap-4"
    >
      <div className="flex items-start justify-between">
        <div className={`w-11 h-11 rounded-full flex items-center justify-center ${iconBg}`}>
          {icon}
        </div>
        {trend !== undefined && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold ${
              trend >= 0 ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            {trend >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
            {Math.abs(trend).toFixed(2)}%
          </span>
        )}
      </div>
      <div>
        <p className="text-[28px] font-bold text-white tabular-nums leading-tight">
          {value}
        </p>
        <p className="text-[11px] text-white/40 mt-0.5">{label}</p>
      </div>
    </motion.div>
  );
}

// ── Track Table ───────────────────────────────────────────────────────────────
function TrackStatsTable({ tracks }: { tracks: TrackStat[] }) {
  return (
    <div className="rounded-2xl bg-white/[0.05] border border-white/[0.07] overflow-hidden">
      <div className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <p className="text-sm font-semibold text-white">Track Performance</p>
        <p className="text-xs text-white/35">
          {tracks.length} track{tracks.length !== 1 ? 's' : ''}
        </p>
      </div>
      {tracks.length === 0 ? (
        <p className="text-center text-white/30 text-sm py-12">
          No tracks yet — upload some music!
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.05]">
                {['#', 'Track', 'Genre', 'Plays', 'Likes', 'Listeners'].map((h) => (
                  <th
                    key={h}
                    className={`px-4 py-3 text-[10px] font-semibold uppercase tracking-wider text-white/30 ${
                      h === '#' || h === 'Track' || h === 'Genre'
                        ? 'text-left'
                        : 'text-right'
                    }`}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/[0.04]">
              {tracks.map((t, i) => (
                <motion.tr
                  key={t.trackId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.025 }}
                  className="hover:bg-white/[0.04] transition-colors"
                >
                  <td className="px-4 py-3 text-white/25 text-xs w-8">{i + 1}</td>
                  <td className="px-4 py-3">
                    <span className="font-medium text-white truncate block max-w-[180px]">
                      {t.title}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-white/40">{t.genre}</td>
                  <td className="px-4 py-3 text-right font-semibold text-violet-300 tabular-nums">
                    {t.playCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-pink-400 tabular-nums">
                    {t.likeCount.toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-cyan-400 tabular-nums">
                    {t.uniqueListeners.toLocaleString()}
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Top Listeners ─────────────────────────────────────────────────────────────
function TopListenersList({ listeners }: { listeners: TopListener[] }) {
  if (listeners.length === 0) return null;
  return (
    <div className="rounded-2xl bg-white/[0.05] border border-white/[0.07] p-5">
      <p className="text-sm font-semibold text-white mb-4">Top Listeners</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {listeners.map((l, i) => (
          <div
            key={l.listenerId}
            className="flex items-center gap-3 rounded-xl bg-white/[0.04] px-4 py-3"
          >
            <span className="w-4 text-right text-xs text-white/25 flex-shrink-0">
              {i + 1}
            </span>
            <img
              src={l.avatar}
              alt={l.username}
              className="w-8 h-8 rounded-full object-cover flex-shrink-0 bg-white/10"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {l.username}
              </p>
              <p className="text-xs text-white/35 tabular-nums">
                {l.playCount.toLocaleString()} plays
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useStore();
  const isPro = user?.subscriptionTier === 'pro';

  const [overview, setOverview] = useState<ArtistOverview | null>(null);
  const [trackStats, setTrackStats] = useState<TrackStat[]>([]);
  const [dailyPlays, setDailyPlays] = useState<DailyPlay[]>([]);
  const [dailyListeners, setDailyListeners] = useState<DailyListeners[]>([]);
  const [topListeners, setTopListeners] = useState<TopListener[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<7 | 30 | 90>(30);

  const load = useCallback(() => {
    if (!user?.id || !isPro) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    Promise.all([
      analyticsService.getOverview(user.id),
      analyticsService.getTrackStats(user.id),
      analyticsService.getDailyPlays(user.id, period),
      analyticsService.getDailyListeners(user.id, period),
      analyticsService.getTopListeners(user.id),
    ])
      .then(([ov, ts, dp, dl, tl]) => {
        setOverview(ov);
        setTrackStats(ts);
        setDailyPlays(dp);
        setDailyListeners(dl);
        setTopListeners(tl);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load analytics')
      )
      .finally(() => setLoading(false));
  }, [user?.id, isPro, period]);

  useEffect(() => { load(); }, [load]);

  // ── Guest gate ───────────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return (
      <div className="min-h-full px-4 py-8 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="max-w-md w-full rounded-2xl bg-white/[0.05] border border-white/[0.08] p-10 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-violet-500/20 flex items-center justify-center mx-auto mb-6">
            <BarChart2 size={32} className="text-violet-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Analytics Dashboard</h2>
          <p className="text-white/45 text-sm mb-7 leading-relaxed">
            Track your music's performance — play counts, listener trends, and more.
            Sign up as an artist to unlock your analytics.
          </p>
          <div className="space-y-2.5 mb-8 text-left">
            {[
              'Play counts & unique listeners per track',
              'Daily plays & listener trend charts',
              'Month-over-month growth stats',
              'Top listener breakdown',
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-white/50">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/signup')}
            className="w-full py-3 rounded-xl bg-primary-600 text-white font-semibold hover:bg-primary-500 transition-colors mb-2"
          >
            Sign Up Free
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full py-3 rounded-xl bg-white/[0.06] text-white font-medium hover:bg-white/[0.1] transition-colors"
          >
            Sign In
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Upsell gate ──────────────────────────────────────────────────────────────
  if (!loading && !isPro) {
    return (
      <div className="min-h-full px-4 py-8 sm:px-6 lg:px-8 flex flex-col items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3 }}
          className="max-w-md w-full rounded-2xl bg-white/[0.05] border border-white/[0.08] p-10 text-center"
        >
          <div className="w-16 h-16 rounded-2xl bg-violet-500/20 flex items-center justify-center mx-auto mb-6">
            <BarChart2 size={32} className="text-violet-400" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            Analytics Dashboard
          </h2>
          <p className="text-white/45 text-sm mb-7 leading-relaxed">
            See how your music is performing — play counts, listener trends,
            and your top tracks. Available on Pro.
          </p>
          <div className="space-y-2.5 mb-8 text-left">
            {[
              'Play counts & unique listeners per track',
              'Daily plays & listener trend charts',
              'Month-over-month growth stats',
              'Top listener breakdown',
            ].map((f) => (
              <div key={f} className="flex items-center gap-2.5 text-sm text-white/50">
                <div className="w-1.5 h-1.5 rounded-full bg-violet-400 flex-shrink-0" />
                {f}
              </div>
            ))}
          </div>
          <button
            onClick={() => navigate('/upgrade')}
            className="w-full py-3 rounded-xl bg-violet-500 text-white font-semibold hover:bg-violet-600 transition-colors"
          >
            Upgrade to Pro
          </button>
        </motion.div>
      </div>
    );
  }

  // Compute derived values for display
  const followerTrend =
    overview && overview.totalFollowers > overview.newFollowersThisMonth
      ? (overview.newFollowersThisMonth /
          Math.max(overview.totalFollowers - overview.newFollowersThisMonth, 1)) *
        100
      : undefined;

  const engagementRate =
    overview && overview.totalPlays > 0
      ? `${((overview.totalLikes / overview.totalPlays) * 100).toFixed(1)}%`
      : '0.0%';

  const playsGoal = (() => {
    if (!overview) return 100;
    const m = overview.playsThisMonth;
    if (m === 0) return 100;
    const milestones = [10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000];
    return milestones.find((ms) => ms > m) ?? Math.round(m * 1.5 / 1000) * 1000;
  })();

  return (
    <div className="min-h-full px-4 py-6 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h1 className="text-2xl font-bold text-white">Analytics Overview</h1>
          <div className="flex items-center gap-1 bg-white/[0.05] border border-white/[0.07] rounded-xl p-1">
            {([7, 30, 90] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  period === p
                    ? 'bg-white/10 text-white'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                Last {p} days
              </button>
            ))}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-28">
            <RefreshCw size={28} className="text-violet-400 animate-spin" />
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-6 py-6 text-center">
            <p className="text-red-400 text-sm mb-3">{error}</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 text-sm text-white/60 hover:text-white transition-colors"
            >
              <RefreshCw size={14} /> Retry
            </button>
          </div>
        )}

        {/* Dashboard */}
        {!loading && !error && overview && (
          <>
            {/* 4 Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Followers"
                value={fmtNum(overview.totalFollowers)}
                trend={followerTrend}
                icon={<Users size={20} className="text-white/80" />}
                iconBg="bg-white/10"
                delay={0}
              />
              <StatCard
                label="Total Plays"
                value={fmtNum(overview.totalPlays)}
                icon={
                  <Play size={19} className="text-white/80" fill="currentColor" />
                }
                iconBg="bg-white/10"
                delay={0.05}
              />
              <StatCard
                label="Plays This Month"
                value={fmtNum(overview.playsThisMonth)}
                icon={<TrendingUp size={20} className="text-white/80" />}
                iconBg="bg-white/10"
                delay={0.10}
              />
              <StatCard
                label="Engagement Rate"
                value={engagementRate}
                icon={
                  <Heart size={19} className="text-white/80" fill="currentColor" />
                }
                iconBg="bg-white/10"
                delay={0.15}
              />
            </div>

            {/* Most Recent Media */}
            <div>
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <button className="flex items-center gap-1.5 text-base font-semibold text-white hover:text-white/80 transition-colors">
                  Most Recent Media
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Gauge */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.20, duration: 0.3 }}
                  className="rounded-2xl bg-white/[0.05] border border-white/[0.07] p-6"
                >
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <p className="text-sm font-semibold text-white">
                        Get More Plays this Month
                      </p>
                      <p className="text-xs text-white/35 mt-0.5">
                        Your monthly performance goal
                      </p>
                    </div>
                  </div>
                  <GaugeChart
                    value={overview.playsThisMonth}
                    max={playsGoal}
                    color="#ef4444"
                  />
                </motion.div>

                {/* Bar Chart */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25, duration: 0.3 }}
                  className="rounded-2xl bg-white/[0.05] border border-white/[0.07] p-6"
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-sm font-semibold text-white">
                      Daily Plays
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mb-4">
                    <span className="inline-block w-2.5 h-2.5 rounded-sm bg-blue-500 flex-shrink-0" />
                    <span className="text-sm text-white/50">
                      <span className="text-white font-semibold">
                        {fmtNum(overview.playsThisMonth)}
                      </span>{' '}
                      new plays this month
                    </span>
                  </div>
                  <BarChartSVG
                    data={dailyPlays.map((d) => ({
                      x: d.playDate,
                      y: Number(d.playCount),
                    }))}
                  />
                </motion.div>
              </div>
            </div>

            {/* Track Performance */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.32, duration: 0.3 }}
            >
              <TrackStatsTable tracks={trackStats} />
            </motion.div>

            {/* Top Listeners */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.40, duration: 0.3 }}
            >
              <TopListenersList listeners={topListeners} />
            </motion.div>
          </>
        )}
      </div>
    </div>
  );
};

export default Analytics;
