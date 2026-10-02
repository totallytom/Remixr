import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Check,
  X,
  Sparkles,
  Upload as UploadIcon,
  Compass,
  BarChart3,
  Disc3,
  CalendarDays,
  UserRound,
  ChevronDown,
  Loader2,
  Lock,
} from 'lucide-react';
import { useStore } from '../store/useStore';
import { proSubscriptionService } from '../services/proSubscriptionService';
import { PRICING } from '../config/pricing';
import { BrutalButton as PressButton, Sticker, hardShadow as shadow } from '../components/ui/brutal';

// ─── Content ──────────────────────────────────────────────────────────────────

const PRO_FEATURES = [
  { icon: UploadIcon, label: 'Unlimited uploads', detail: 'No cap on tracks or albums — release as much as you want.' },
  { icon: Compass, label: 'Priority in Discover', detail: 'Your tracks show up first in the Discover swipe stack.' },
  { icon: BarChart3, label: 'Analytics dashboard', detail: 'Plays, daily listener trends and per-track stats.' },
  { icon: Disc3, label: 'Full album management', detail: 'Unlimited albums with full metadata control.' },
  { icon: CalendarDays, label: 'Concert listings', detail: 'Post gigs and events at no extra cost.' },
  { icon: UserRound, label: 'Enhanced artist profile', detail: 'Banner image, custom @vanity URL and extended bio.' },
];

type Cell = boolean | string;
const COMPARISON: { label: string; free: Cell; pro: Cell }[] = [
  { label: 'Track uploads', free: 'Up to 10', pro: 'Unlimited' },
  { label: 'Albums', free: 'Up to 2', pro: 'Unlimited' },
  { label: 'Discover placement', free: 'Standard', pro: 'Priority' },
  { label: 'Analytics dashboard', free: false, pro: true },
  { label: 'Concert listings', free: false, pro: true },
  { label: 'Banner & @vanity URL', free: false, pro: true },
  { label: 'Playlists, following & chat', free: true, pro: true },
];

const FAQ = [
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel from Settings → Pro whenever you like. You keep Pro until the end of the period you already paid for, and you won’t be charged again.',
  },
  {
    q: 'What happens to my tracks if I go back to Free?',
    a: 'Everything you’ve already uploaded stays up. You just can’t add more than the Free limits (10 tracks, 2 albums) until you upgrade again.',
  },
  {
    q: 'Does Pro work in the Re-Mixed mobile app too?',
    a: 'Yes. Pro is tied to your account, so it unlocks on the website and in the app.',
  },
  {
    q: 'How does yearly billing work?',
    a: `You pay ${PRICING.yearly.total} once a year — the same as about ${PRICING.yearly.display} a month, so two months are free compared with paying monthly.`,
  },
];

// ─── Small building blocks ────────────────────────────────────────────────────

const CellValue: React.FC<{ value: Cell; highlight?: boolean }> = ({ value, highlight }) => {
  if (value === true) return <Check className={`w-5 h-5 mx-auto ${highlight ? 'text-black' : 'text-black/70'}`} strokeWidth={3} />;
  if (value === false) return <X className="w-4 h-4 mx-auto text-black/25" strokeWidth={3} />;
  return <span className={`text-sm ${highlight ? 'font-bold text-black' : 'text-black/70'}`}>{value}</span>;
};

/** Decorative preview of what Pro unlocks (no real data). */
const ProPreview: React.FC = () => {
  const bars = [32, 48, 40, 64, 56, 80, 92];
  return (
    <div className="relative hidden md:block w-72 h-64 flex-shrink-0" aria-hidden="true">
      <motion.div
        initial={{ opacity: 0, y: 20, rotate: 0 }}
        animate={{ opacity: 1, y: 0, rotate: 3 }}
        transition={{ delay: 0.2, type: 'spring', stiffness: 160, damping: 18 }}
        className="absolute right-0 top-2 w-60 bg-white border-2 border-black rounded-2xl p-4"
        style={shadow(6)}
      >
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4" />
          <p className="text-xs font-bold uppercase tracking-wide text-black">Analytics</p>
        </div>
        <div className="flex items-end gap-1.5 h-24">
          {bars.map((h, i) => (
            <motion.div
              key={i}
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ delay: 0.35 + i * 0.06, type: 'spring', stiffness: 200, damping: 20 }}
              className="flex-1 rounded-t-sm border-2 border-black bg-teal-300"
            />
          ))}
        </div>
        <p className="mt-2 text-[10px] text-black/50">Plays per day, per track</p>
      </motion.div>
      <motion.div
        initial={{ opacity: 0, x: -20, rotate: 0 }}
        animate={{ opacity: 1, x: 0, rotate: -5 }}
        transition={{ delay: 0.45, type: 'spring', stiffness: 160, damping: 18 }}
        className="absolute left-0 bottom-2 flex items-center gap-2 bg-yellow-300 border-2 border-black rounded-xl px-3 py-2"
        style={shadow(4)}
      >
        <Compass className="w-4 h-4" />
        <span className="text-xs font-bold text-black">Featured in Discover</span>
      </motion.div>
    </div>
  );
};

/** Lightweight confetti burst — no extra dependency. */
const Confetti: React.FC = () => {
  const pieces = useMemo(
    () =>
      Array.from({ length: 28 }, (_, i) => ({
        id: i,
        x: (Math.random() - 0.5) * 520,
        y: -(120 + Math.random() * 220),
        r: Math.random() * 540 - 270,
        color: ['bg-yellow-300', 'bg-teal-300', 'bg-pink-300', 'bg-black'][i % 4],
        size: 6 + Math.round(Math.random() * 6),
      })),
    []
  );
  return (
    <div className="pointer-events-none absolute left-1/2 top-16 z-10" aria-hidden="true">
      {pieces.map((p) => (
        <motion.span
          key={p.id}
          className={`absolute block ${p.color} border border-black`}
          style={{ width: p.size, height: p.size }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 260], rotate: p.r, opacity: [1, 1, 0] }}
          transition={{ duration: 1.8, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
};

const FaqItem: React.FC<{ q: string; a: string }> = ({ q, a }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-2 border-black rounded-xl bg-white overflow-hidden" style={shadow(3)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left font-semibold text-black"
      >
        {q}
        <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <p className="px-4 pb-4 text-sm text-black/70">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Upgrade() {
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [activationFailed, setActivationFailed] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser, player, setSettingsOpen, setSettingsInitialTab } = useStore();

  const success = searchParams.get('success') === 'true';
  const cancelled = searchParams.get('cancelled') === 'true';
  const sessionId = searchParams.get('session_id');

  useEffect(() => {
    if (!success) return;

    setActivating(true);
    let isCancelled = false;

    const poll = async () => {
      for (let i = 0; i < 12; i++) {
        await refreshUser();
        const tier = useStore.getState().user?.subscriptionTier;
        if (isCancelled) return;
        if (tier === 'artist') {
          setActivating(false);
          setActivated(true);
          return;
        }
        await new Promise((r) => setTimeout(r, 1500));
      }
      if (!isCancelled) {
        setActivating(false);
        setActivationFailed(true);
      }
    };

    const activate = async () => {
      // Try direct activation via session ID (works without webhook)
      if (sessionId) {
        try {
          await proSubscriptionService.activateFromSession(sessionId);
          await refreshUser();
          if (!isCancelled) {
            setActivating(false);
            setActivated(true);
            return;
          }
        } catch {
          // Fall through to polling if direct activation fails
        }
      }
      // Fallback: poll for webhook to update the DB
      await poll();
    };

    activate();
    return () => { isCancelled = true; };
  }, [success, sessionId, refreshUser]);

  const isPro = user?.subscriptionTier === 'artist';
  const showCelebration = (success && activated) || (success && !activating && isPro);
  const showPricing = !activating && !activated && !activationFailed;
  const price = plan === 'yearly' ? PRICING.yearly : PRICING.monthly;

  const openProSettings = () => {
    setSettingsInitialTab('pro');
    setSettingsOpen(true);
  };

  const handleUpgrade = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      await proSubscriptionService.startProCheckout(user.stripeCustomerId, plan, user.id, user.email);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  const ctaLabel = loading
    ? 'Redirecting to checkout…'
    : `Get Pro — ${price.checkoutLabel}`;

  return (
    <div
      className="relative min-h-screen bg-[#faf6ec] text-black px-4 pt-10 pb-40 lg:pb-16"
      // Subtle dot grid behind everything
      style={{
        backgroundImage: 'radial-gradient(rgba(0,0,0,0.08) 1px, transparent 1px)',
        backgroundSize: '18px 18px',
      }}
    >
      <div className="relative max-w-4xl mx-auto">

        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <header className="flex items-center justify-between gap-8 mb-12">
          <div className="max-w-xl">
            <Sticker className="mb-5">
              <Sparkles className="w-3.5 h-3.5" /> Re-Mixed Pro
            </Sticker>
            <h1 className="font-kotra text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-black mb-4">
              Get heard.
              <br />
              <span className="relative inline-block">
                <span className="relative z-10">Grow faster.</span>
                <span className="absolute left-0 right-0 bottom-1 h-3 sm:h-4 bg-teal-300 z-0 -rotate-1" aria-hidden="true" />
              </span>
            </h1>
            <p className="text-lg text-black/70">
              Unlimited releases, priority in Discover and real numbers on who’s listening —
              everything you need to grow as an artist.
            </p>
          </div>
          <ProPreview />
        </header>

        {/* ── Checkout result states ───────────────────────────────────────── */}
        {success && activating && (
          <div className="mb-8 p-8 rounded-2xl border-2 border-black bg-white text-center" style={shadow(6)}>
            <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" />
            <p className="font-bold text-lg text-black">Activating your Pro account…</p>
            <p className="text-black/60 text-sm mt-1">This takes just a moment. Please don’t close this page.</p>
          </div>
        )}

        {success && activationFailed && !isPro && (
          <div className="mb-8 p-8 rounded-2xl border-2 border-black bg-red-100 text-center" style={shadow(6)}>
            <p className="font-bold text-lg text-black mb-2">We couldn’t confirm your subscription yet</p>
            <p className="text-black/70 text-sm mb-6 max-w-lg mx-auto">
              Your payment may still have gone through. Check Settings → Pro in a minute — it can take a moment to sync.
              If your plan doesn’t update, email{' '}
              <a href="mailto:remix.official0714@gmail.com" className="underline font-semibold">remix.official0714@gmail.com</a>
              {' '}with your receipt and we’ll sort it out.
            </p>
            <PressButton tone="white" onClick={openProSettings}>Check Settings</PressButton>
          </div>
        )}

        {showCelebration && (
          <div className="relative mb-8">
            <Confetti />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16 }}
              className="p-8 rounded-2xl border-2 border-black bg-teal-300 text-center"
              style={shadow(8)}
            >
              <Sticker rotate={2} className="mb-4">
                <Sparkles className="w-3.5 h-3.5" /> Pro unlocked
              </Sticker>
              <h2 className="font-kotra text-3xl sm:text-4xl text-black mb-2">You’re on Re-Mixed Pro!</h2>
              <p className="text-black/70 mb-6">Unlimited uploads, priority Discover placement and your analytics are all ready.</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <PressButton onClick={() => navigate('/upload')}>Start uploading →</PressButton>
                <PressButton tone="white" onClick={() => navigate('/analytics')}>See your analytics</PressButton>
              </div>
            </motion.div>
          </div>
        )}

        {cancelled && (
          <div className="mb-8 px-4 py-3 rounded-xl border-2 border-black bg-white text-center text-sm text-black/70" style={shadow(3)}>
            Checkout cancelled — no charges made.
          </div>
        )}

        {isPro && !success && (
          <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 rounded-xl border-2 border-black bg-teal-300" style={shadow(4)}>
            <p className="font-semibold text-black">You’re already on Re-Mixed Pro. Thanks for supporting the platform!</p>
            <PressButton tone="white" onClick={openProSettings} className="py-2">Manage subscription</PressButton>
          </div>
        )}

        {showPricing && (
          <>
            {/* ── Billing toggle ───────────────────────────────────────────── */}
            {!isPro && (
              <div className="flex justify-center mb-10">
                <div className="relative inline-flex p-1 bg-white border-2 border-black rounded-xl" style={shadow(3)}>
                  {(['monthly', 'yearly'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlan(p)}
                      aria-pressed={plan === p}
                      className="relative px-6 py-2 rounded-lg text-sm font-bold text-black"
                    >
                      {plan === p && (
                        <motion.span
                          layoutId="billing-pill"
                          className="absolute inset-0 rounded-lg bg-black"
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                        />
                      )}
                      <span className={`relative z-10 ${plan === p ? 'text-white' : ''}`}>
                        {p === 'monthly' ? 'Monthly' : 'Yearly'}
                      </span>
                    </button>
                  ))}
                  <Sticker rotate={6} className="absolute -top-4 -right-10 !text-[10px] !px-2 !py-0.5">2 months free</Sticker>
                </div>
              </div>
            )}

            {/* ── Plans ────────────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr_1.15fr] gap-8 items-stretch mb-16">

              {/* Free */}
              <div className="rounded-2xl border-2 border-black bg-white p-6 flex flex-col md:self-start md:mt-6" style={shadow(5)}>
                <p className="text-sm font-bold uppercase tracking-widest text-black/60">Free</p>
                <p className="mt-2 font-kotra text-5xl text-black">$0</p>
                <p className="text-sm text-black/60 mt-1 mb-6">Forever free</p>
                <ul className="space-y-3 flex-1">
                  {COMPARISON.filter((c) => c.free !== false).map((c) => (
                    <li key={c.label} className="flex items-start gap-2.5 text-sm text-black">
                      <Check className="w-4 h-4 mt-0.5 flex-shrink-0 text-black/50" strokeWidth={3} />
                      <span>
                        {c.label}
                        {typeof c.free === 'string' && <span className="text-black/50"> — {c.free.toLowerCase()}</span>}
                      </span>
                    </li>
                  ))}
                </ul>
                {user && !isPro && (
                  <p className="mt-6 text-center text-xs font-semibold text-black/40 uppercase tracking-wide">Your current plan</p>
                )}
              </div>

              {/* Pro */}
              <motion.div
                initial={{ rotate: 0 }}
                animate={{ rotate: -1.5 }}
                whileHover={{ rotate: 0, y: -4 }}
                transition={{ type: 'spring', stiffness: 260, damping: 20 }}
                className="relative rounded-2xl border-2 border-black bg-teal-300 p-6 flex flex-col"
                style={shadow(8)}
              >
                <Sticker rotate={8} className="absolute -top-4 right-6">Most popular</Sticker>

                <p className="text-sm font-bold uppercase tracking-widest text-black">Pro</p>
                <div className="mt-2 flex items-end gap-2 h-14">
                  <AnimatePresence mode="wait">
                    <motion.p
                      key={plan}
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -12, opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="font-kotra text-5xl text-black"
                    >
                      {price.display}
                    </motion.p>
                  </AnimatePresence>
                  <p className="text-black/70 text-sm mb-2">/month</p>
                </div>
                <p className="text-sm text-black/70 mt-1 mb-6">
                  {plan === 'yearly' ? `${PRICING.yearly.total} ${PRICING.yearly.totalLabel}` : 'billed monthly'}
                </p>

                <p className="text-xs font-bold uppercase tracking-wide text-black/70 mb-3">Everything in Free, plus:</p>
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 flex-1 mb-6">
                  {PRO_FEATURES.map(({ icon: Icon, label, detail }) => (
                    <li key={label} className="flex items-start gap-2.5 bg-white/60 border-2 border-black rounded-xl p-3">
                      <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-black text-white flex items-center justify-center">
                        <Icon className="w-4 h-4" />
                      </span>
                      <span>
                        <span className="block text-sm font-bold text-black leading-snug">{label}</span>
                        <span className="block text-xs text-black/70 leading-snug mt-0.5">{detail}</span>
                      </span>
                    </li>
                  ))}
                </ul>

                {isPro ? (
                  <PressButton tone="white" onClick={openProSettings} className="w-full">
                    Current plan · Manage
                  </PressButton>
                ) : (
                  <PressButton onClick={handleUpgrade} disabled={loading} className="w-full text-base py-4">
                    {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                    {ctaLabel}
                  </PressButton>
                )}
                {error && <p className="mt-3 text-center text-sm font-semibold text-red-700">{error}</p>}
                <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-black/60">
                  <Lock className="w-3 h-3" /> Secure checkout by Stripe · Cancel anytime
                </p>
              </motion.div>
            </div>
          </>
        )}

        {/* ── Comparison ───────────────────────────────────────────────────── */}
        <section className="mb-16">
          <h2 className="font-kotra text-3xl text-black mb-6 text-center">Free vs Pro</h2>
          <div className="rounded-2xl border-2 border-black bg-white overflow-hidden" style={shadow(5)}>
            <table className="w-full">
              <thead>
                <tr className="border-b-2 border-black">
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-black/60">Feature</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-black/60 w-28">Free</th>
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wide text-black bg-teal-300 border-l-2 border-black w-28">Pro</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr key={row.label} className={i < COMPARISON.length - 1 ? 'border-b border-black/10' : ''}>
                    <td className="px-4 py-3 text-sm text-black">{row.label}</td>
                    <td className="px-4 py-3 text-center"><CellValue value={row.free} /></td>
                    <td className="px-4 py-3 text-center bg-teal-100 border-l-2 border-black"><CellValue value={row.pro} highlight /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────────── */}
        <section className="max-w-2xl mx-auto">
          <h2 className="font-kotra text-3xl text-black mb-6 text-center">Questions</h2>
          <div className="space-y-3">
            {FAQ.map((f) => <FaqItem key={f.q} q={f.q} a={f.a} />)}
          </div>
          <p className="mt-8 text-center text-xs text-black/50">
            Subscriptions renew automatically until cancelled. Payments are processed securely by Stripe.
            Questions? <a href="mailto:remix.official0714@gmail.com" className="underline">remix.official0714@gmail.com</a>
          </p>
        </section>
      </div>

      {/* ── Sticky upgrade bar (phones) — sits above the bottom nav / player ── */}
      {showPricing && !isPro && (
        <div
          className="lg:hidden fixed left-0 right-0 z-30 px-4"
          style={{ bottom: player?.visible ? 140 : 80 }}
        >
          <PressButton onClick={handleUpgrade} disabled={loading} className="w-full">
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {ctaLabel}
          </PressButton>
        </div>
      )}
    </div>
  );
}
