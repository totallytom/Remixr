import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart2, RefreshCw, ArrowUpRight, ArrowDownRight, Minus, Users, Heart, Music, Play } from 'lucide-react';
import { useStore } from '../store/useStore';
import {
  analyticsService,
  type ArtistOverview,
  type TrackStat,
  type DailyPlay,
  type DailyListeners,
  type TopListener,
} from '../services/analyticsService';
import { BrutalButton, hardShadow } from '../components/ui/brutal';
import {
  VIZ,
  ColumnChart,
  LineChart,
  RankedBars,
  DataTable,
  fmtCompact,
  fmtNumber,
  type DayPoint,
} from '../components/analytics/charts';

type Period = 7 | 30 | 90;

// ─── Small pieces ─────────────────────────────────────────────────────────────

/** Change vs the previous period of the same length. Up = good for every metric here. */
const Delta: React.FC<{ current: number; previous: number; period: Period }> = ({ current, previous, period }) => {
  if (previous === 0 && current === 0) return null;
  const label = `vs previous ${period} days`;
  if (previous === 0) {
    return <span className="text-xs font-semibold" style={{ color: VIZ.textSecondary }}>New this period</span>;
  }
  const pct = ((current - previous) / previous) * 100;
  const flat = Math.abs(pct) < 0.5;
  const up = pct > 0;
  const color = flat ? VIZ.textSecondary : up ? '#15803d' : '#b91c1c';
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color }}>
      <Icon size={14} aria-hidden="true" />
      {flat ? 'No change' : `${up ? '+' : '−'}${Math.abs(pct).toFixed(pct > -10 && pct < 10 ? 1 : 0)}%`}
      <span className="font-normal" style={{ color: VIZ.textMuted }}>{label}</span>
    </span>
  );
};

const Card: React.FC<{ title?: string; subtitle?: string; className?: string; children: React.ReactNode }> = ({
  title, subtitle, className = '', children,
}) => (
  <section className={`bg-white border-2 border-black rounded-2xl p-5 ${className}`} style={hardShadow(4)}>
    {title && (
      <header className="mb-4">
        <h2 className="!text-base !font-bold !m-0" style={{ color: VIZ.textPrimary }}>{title}</h2>
        {subtitle && <p className="text-xs mt-0.5" style={{ color: VIZ.textMuted }}>{subtitle}</p>}
      </header>
    )}
    {children}
  </section>
);

const StatTile: React.FC<{
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  note?: React.ReactNode;
}> = ({ label, value, icon: Icon, note }) => (
  <div className="bg-white border-2 border-black rounded-2xl p-4" style={hardShadow(3)}>
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold" style={{ color: VIZ.textSecondary }}>{label}</p>
      <Icon size={16} className="text-black/40" />
    </div>
    <p className="text-3xl font-bold mt-2 leading-none" style={{ color: VIZ.textPrimary }}>{value}</p>
    {note && <p className="text-xs mt-2" style={{ color: VIZ.textMuted }}>{note}</p>}
  </div>
);

const Gate: React.FC<{ title: string; body: string; cta: string; onCta: () => void; secondary?: { label: string; onClick: () => void } }> = ({
  title, body, cta, onCta, secondary,
}) => (
  <div className="min-h-full bg-[#faf6ec] px-4 py-10 flex items-center justify-center">
    <div className="max-w-md w-full bg-white border-2 border-black rounded-2xl p-8 text-center" style={hardShadow(6)}>
      <span className="w-14 h-14 rounded-2xl border-2 border-black bg-teal-300 flex items-center justify-center mx-auto mb-5">
        <BarChart2 size={26} />
      </span>
      <h1 className="font-kotra text-3xl text-black mb-2">{title}</h1>
      <p className="text-sm text-black/60 mb-6 leading-relaxed">{body}</p>
      <ul className="space-y-2 mb-7 text-left text-sm text-black/70">
        {['Daily plays and listeners, with change vs the previous period', 'Your top tracks, ranked', 'Who your biggest listeners are'].map((f) => (
          <li key={f} className="flex items-start gap-2">
            <span className="mt-1.5 w-2 h-2 rounded-full bg-teal-500 flex-shrink-0" aria-hidden="true" />
            {f}
          </li>
        ))}
      </ul>
      <BrutalButton className="w-full" onClick={onCta}>{cta}</BrutalButton>
      {secondary && (
        <BrutalButton tone="white" className="w-full mt-3" onClick={secondary.onClick}>{secondary.label}</BrutalButton>
      )}
    </div>
  </div>
);

// ─── Page ────────────────────────────────────────────────────────────────────

const Analytics: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useStore();
  const isPro = user?.subscriptionTier === 'artist';

  const [overview, setOverview] = useState<ArtistOverview | null>(null);
  const [trackStats, setTrackStats] = useState<TrackStat[]>([]);
  const [dailyPlays, setDailyPlays] = useState<DailyPlay[]>([]);
  const [dailyListeners, setDailyListeners] = useState<DailyListeners[]>([]);
  const [topListeners, setTopListeners] = useState<TopListener[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<Period>(30);
  const [showAllTracks, setShowAllTracks] = useState(false);

  const load = useCallback(() => {
    if (!user?.id || !isPro) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    // Fetch twice the period so every number can be compared with the
    // previous period of the same length.
    Promise.all([
      analyticsService.getOverview(user.id),
      analyticsService.getTrackStats(user.id),
      analyticsService.getDailyPlays(user.id, period * 2),
      analyticsService.getDailyListeners(user.id, period * 2),
      analyticsService.getTopListeners(user.id),
    ])
      .then(([ov, ts, dp, dl, tl]) => {
        setOverview(ov);
        setTrackStats(ts);
        setDailyPlays(dp);
        setDailyListeners(dl);
        setTopListeners(tl);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load analytics'))
      .finally(() => setLoading(false));
  }, [user?.id, isPro, period]);

  useEffect(() => { load(); }, [load]);

  // Split the 2× series into this period and the one before it.
  const periodData = useMemo(() => {
    const plays: DayPoint[] = dailyPlays.map((d) => ({ date: d.playDate, value: Number(d.playCount) }));
    const listeners: DayPoint[] = dailyListeners.map((d) => ({ date: d.playDate, value: Number(d.uniqueListeners) }));
    const cur = <T,>(a: T[]) => a.slice(-period);
    const prev = <T,>(a: T[]) => a.slice(Math.max(0, a.length - period * 2), a.length - period);
    const sum = (a: DayPoint[]) => a.reduce((s, d) => s + d.value, 0);
    const avg = (a: DayPoint[]) => (a.length ? sum(a) / a.length : 0);
    const curPlays = cur(plays);
    const curListeners = cur(listeners);
    const best = curPlays.reduce<DayPoint | null>((b, d) => (!b || d.value > b.value ? d : b), null);
    return {
      plays: curPlays,
      listeners: curListeners,
      playsTotal: sum(curPlays),
      playsPrev: sum(prev(plays)),
      listenersAvg: avg(curListeners),
      listenersAvgPrev: avg(prev(listeners)),
      bestDay: best && best.value > 0 ? best : null,
    };
  }, [dailyPlays, dailyListeners, period]);

  const tracksByPlays = useMemo(() => [...trackStats].sort((a, b) => b.playCount - a.playCount), [trackStats]);
  const listenerTotal = topListeners.reduce((s, l) => s + l.playCount, 0);

  // ── Gates ──
  if (!isAuthenticated) {
    return (
      <Gate
        title="Analytics"
        body="See how your music is doing — who's listening, when, and which tracks they love. Sign up as an artist to get started."
        cta="Sign up free"
        onCta={() => navigate('/signup')}
        secondary={{ label: 'Sign in', onClick: () => navigate('/login') }}
      />
    );
  }
  if (!loading && !isPro) {
    return (
      <Gate
        title="Analytics"
        body="See how your music is doing — who's listening, when, and which tracks they love. Included with Re-Mixed Pro."
        cta="Upgrade to Pro"
        onCta={() => navigate('/upgrade')}
      />
    );
  }

  const firstLoad = loading && !overview;

  return (
    <div className="min-h-full bg-[#faf6ec] px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-10">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex flex-wrap items-end justify-between gap-3 mb-6">
          <div>
            <h1 className="font-kotra text-4xl text-black leading-none">Analytics</h1>
            <p className="text-sm text-black/60 mt-1">How your music is doing on Re-Mixed.</p>
          </div>
          <button
            type="button"
            onClick={load}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-black bg-white text-sm font-bold shadow-[2px_2px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Refresh
          </button>
        </header>

        {firstLoad && (
          <div className="flex items-center justify-center py-28">
            <RefreshCw size={28} className="text-black/40 animate-spin" />
          </div>
        )}

        {!loading && error && (
          <div className="mb-6 rounded-2xl border-2 border-black bg-red-100 px-6 py-5 text-center">
            <p className="text-sm font-semibold text-red-800 mb-3">{error}</p>
            <BrutalButton tone="white" size="sm" onClick={load}><RefreshCw size={14} /> Try again</BrutalButton>
          </div>
        )}

        {overview && (
          // Refetch keeps the frame: dim the previous render instead of a spinner.
          <div className={`space-y-10 transition-opacity ${loading ? 'opacity-50' : ''}`} aria-busy={loading}>
            {/* ═══ This period ═══ */}
            <section aria-labelledby="period-heading">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <h2 id="period-heading" className="!text-sm !font-bold !uppercase !tracking-wide !m-0 text-black/60">Activity</h2>
                <div role="radiogroup" aria-label="Date range" className="inline-flex p-1 bg-white border-2 border-black rounded-xl">
                  {([7, 30, 90] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      role="radio"
                      aria-checked={period === p}
                      onClick={() => setPeriod(p)}
                      className={`px-3 py-1 rounded-lg text-sm font-bold whitespace-nowrap transition-colors ${period === p ? 'bg-black text-white' : 'text-black hover:bg-teal-50'}`}
                    >
                      <span className="hidden sm:inline">Last </span>{p} days
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Plays — the hero */}
                <Card className="lg:col-span-2">
                  <p className="text-sm font-semibold" style={{ color: VIZ.textSecondary }}>Plays</p>
                  <p className="text-5xl font-bold leading-none mt-1" style={{ color: VIZ.textPrimary }}>
                    {fmtNumber(periodData.playsTotal)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
                    <Delta current={periodData.playsTotal} previous={periodData.playsPrev} period={period} />
                    {periodData.bestDay && (
                      <span className="text-xs" style={{ color: VIZ.textMuted }}>
                        Best day: {new Date(periodData.bestDay.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ({fmtNumber(periodData.bestDay.value)})
                      </span>
                    )}
                  </div>
                  <div className="mt-5">
                    {periodData.playsTotal === 0 ? (
                      <p className="py-16 text-center text-sm" style={{ color: VIZ.textMuted }}>No plays in the last {period} days yet.</p>
                    ) : (
                      <ColumnChart data={periodData.plays} unit="plays" ariaLabel={`Plays per day, last ${period} days`} />
                    )}
                  </div>
                  <DataTable data={periodData.plays} valueLabel="Plays" />
                </Card>

                {/* Listeners */}
                <Card>
                  <p className="text-sm font-semibold" style={{ color: VIZ.textSecondary }}>Listeners per day</p>
                  <p className="text-3xl font-bold leading-none mt-1" style={{ color: VIZ.textPrimary }}>
                    {periodData.listenersAvg.toFixed(periodData.listenersAvg < 10 ? 1 : 0)}
                    <span className="text-sm font-semibold ml-1" style={{ color: VIZ.textMuted }}>avg</span>
                  </p>
                  <div className="mt-2">
                    <Delta current={periodData.listenersAvg} previous={periodData.listenersAvgPrev} period={period} />
                  </div>
                  <div className="mt-5">
                    <LineChart data={periodData.listeners} unit="listeners" height={190} ariaLabel={`Unique listeners per day, last ${period} days`} />
                  </div>
                  <DataTable data={periodData.listeners} valueLabel="Listeners" />
                </Card>
              </div>
            </section>

            {/* ═══ All time ═══ */}
            <section aria-labelledby="alltime-heading">
              <h2 id="alltime-heading" className="!text-sm !font-bold !uppercase !tracking-wide !m-0 !mb-4 text-black/60">All time</h2>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
                <StatTile label="Total plays" value={fmtCompact(overview.totalPlays)} icon={Play}
                  note={`${fmtNumber(overview.playsThisMonth)} this month`} />
                <StatTile label="Followers" value={fmtCompact(overview.totalFollowers)} icon={Users}
                  note={overview.newFollowersThisMonth > 0 ? `+${fmtNumber(overview.newFollowersThisMonth)} this month` : 'No new followers this month'} />
                <StatTile label="Likes" value={fmtCompact(overview.totalLikes)} icon={Heart}
                  note={overview.totalPlays > 0 ? `${((overview.totalLikes / overview.totalPlays) * 100).toFixed(1)}% of plays end in a like` : undefined} />
                <StatTile label="Tracks" value={fmtNumber(overview.totalTracks)} icon={Music}
                  note={overview.totalAlbums > 0 ? `${fmtNumber(overview.totalAlbums)} album${overview.totalAlbums === 1 ? '' : 's'}` : undefined} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top tracks */}
                <Card title="Top tracks" subtitle="By plays, all time" className="lg:col-span-2">
                  {tracksByPlays.length === 0 ? (
                    <p className="py-10 text-center text-sm" style={{ color: VIZ.textMuted }}>No tracks yet — upload your first one.</p>
                  ) : (
                    <>
                      <RankedBars
                        unit="plays"
                        rows={tracksByPlays.slice(0, 8).map((t) => ({
                          id: t.trackId,
                          label: t.title,
                          sub: `${fmtNumber(t.uniqueListeners)} listener${t.uniqueListeners === 1 ? '' : 's'} · ${fmtNumber(t.likeCount)} like${t.likeCount === 1 ? '' : 's'}`,
                          value: t.playCount,
                        }))}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAllTracks((v) => !v)}
                        aria-expanded={showAllTracks}
                        className="mt-4 text-xs font-semibold underline"
                        style={{ color: VIZ.textSecondary }}
                      >
                        {showAllTracks ? 'Hide table' : `Show all ${tracksByPlays.length} track${tracksByPlays.length === 1 ? '' : 's'} as a table`}
                      </button>
                      {showAllTracks && (
                        <div className="mt-3 overflow-x-auto rounded-lg border" style={{ borderColor: VIZ.grid }}>
                          <table className="w-full text-sm">
                            <thead>
                              <tr style={{ color: VIZ.textMuted }}>
                                {['Track', 'Genre', 'Plays', 'Listeners', 'Likes', 'Like rate'].map((h, i) => (
                                  <th key={h} className={`px-3 py-2 text-xs font-semibold ${i < 2 ? 'text-left' : 'text-right'}`}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {tracksByPlays.map((t) => (
                                <tr key={t.trackId} className="border-t" style={{ borderColor: VIZ.grid, color: VIZ.textPrimary }}>
                                  <td className="px-3 py-2 font-medium max-w-[14rem] truncate">{t.title}</td>
                                  <td className="px-3 py-2" style={{ color: VIZ.textSecondary }}>{t.genre}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(t.playCount)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(t.uniqueListeners)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums">{fmtNumber(t.likeCount)}</td>
                                  <td className="px-3 py-2 text-right tabular-nums" style={{ color: VIZ.textSecondary }}>
                                    {t.playCount > 0 ? `${((t.likeCount / t.playCount) * 100).toFixed(1)}%` : '—'}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </Card>

                {/* Top listeners */}
                <Card title="Top listeners" subtitle="Who plays you most, all time">
                  {topListeners.length === 0 ? (
                    <p className="py-10 text-center text-sm" style={{ color: VIZ.textMuted }}>No listeners yet.</p>
                  ) : (
                    <ol className="space-y-3">
                      {topListeners.map((l, i) => {
                        const share = listenerTotal ? l.playCount / listenerTotal : 0;
                        return (
                          <li key={l.listenerId} className="flex items-center gap-3">
                            <span className="w-4 text-xs text-right tabular-nums" style={{ color: VIZ.textMuted }}>{i + 1}</span>
                            <img src={l.avatar} alt="" className="w-8 h-8 rounded-lg border-2 border-black object-cover bg-black/5 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-baseline justify-between gap-2">
                                <a href={`/profile/${l.listenerId}`} className="text-sm font-semibold truncate hover:underline" style={{ color: VIZ.textPrimary }}>
                                  @{l.username}
                                </a>
                                <span className="text-xs tabular-nums flex-shrink-0" style={{ color: VIZ.textSecondary }}>
                                  {fmtNumber(l.playCount)} plays
                                </span>
                              </div>
                              {/* Meter: share of top-listener plays; track is a light step of the same hue */}
                              <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(13,148,136,0.15)' }} aria-hidden="true">
                                <div className="h-full rounded-full" style={{ width: `${share * 100}%`, background: VIZ.accent }} />
                              </div>
                            </div>
                          </li>
                        );
                      })}
                    </ol>
                  )}
                </Card>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
};

export default Analytics;
