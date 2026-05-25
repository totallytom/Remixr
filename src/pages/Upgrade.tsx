import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { proSubscriptionService } from '../services/proSubscriptionService';
import { PRICING } from '../config/pricing';
import { supabase } from '../services/supabase';

const FREE_FEATURES = [
  'Upload & share tracks (up to 10)',
  'Create albums (up to 2)',
  'Follow artists & listeners',
  'Playlists & discovery',
  'Chat with other users',
];

const PRO_FEATURES: { label: string; detail: string }[] = [
  {
    label: 'Unlimited uploads',
    detail: 'No cap on tracks or albums — release as much as you want',
  },
  {
    label: 'Priority placement in Discover',
    detail: 'Your tracks are auto-boosted to the front of the swipe stack',
  },
  {
    label: 'Full album management',
    detail: 'Create, edit and manage unlimited albums with full metadata control',
  },
  {
    label: 'Concert listings included',
    detail: 'Post gigs and events at no extra cost',
  },
  {
    label: 'Analytics Dashboard',
    detail: 'Play counts, daily listener trends and per-track performance stats',
  },
  {
    label: 'Enhanced Artist Profile',
    detail: 'Banner image, custom @vanity URL and extended bio',
  },
];

export default function Upgrade() {
  const [plan, setPlan] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activating, setActivating] = useState(false);
  const [activated, setActivated] = useState(false);
  const [activationFailed, setActivationFailed] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, refreshUser } = useStore();

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
        if (tier === 'pro') {
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

  const isPro = user?.subscriptionTier === 'pro';

  const handleUpgrade = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setError(null);
    setLoading(true);

    try {
      let customerId = user.stripeCustomerId;

      const timeout = (ms: number) => new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Request timed out. Please try again.')), ms)
      );

      // Create Stripe customer if user doesn't have one yet
      if (!customerId) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.access_token) throw new Error('Not authenticated');
        const res = await Promise.race([
          fetch('/api/create-stripe-customer', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ userId: user.id, email: user.email }),
          }),
          timeout(8000),
        ]);
        const text = await res.text();
        let data: Record<string, string> = {};
        try { data = JSON.parse(text); } catch { throw new Error(`API error (${res.status}): ${text.slice(0, 200)}`); }
        if (!res.ok || !data.stripeCustomerId) throw new Error(data.error || 'Could not create billing account');
        customerId = data.stripeCustomerId;
      }

      await proSubscriptionService.startProCheckout(customerId, plan, user.id, user.email);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-900 text-white px-4 py-12">
      <div className="max-w-3xl mx-auto">

        {/* Header */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 bg-yellow-500/10 border border-yellow-500/30 rounded-full px-4 py-1.5 text-yellow-400 text-sm font-semibold mb-4">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            Remixr Pro
          </div>
          <h1 className="text-4xl font-bold mb-3">Unlock the full experience</h1>
          <p className="text-white/60 text-lg">Everything you need to grow as an artist — uploads, analytics, discovery and more.</p>
        </div>

        {/* Activation state — shown while polling after checkout */}
        {success && activating && (
          <div className="mb-8 p-8 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <svg className="w-5 h-5 text-yellow-400 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              <p className="text-yellow-400 font-semibold text-lg">Activating your Pro account…</p>
            </div>
            <p className="text-white/40 text-sm">This takes just a moment. Please don't close this page.</p>
          </div>
        )}

        {/* Activation failed — polling exhausted without confirming Pro */}
        {success && activationFailed && !isPro && (
          <div className="mb-8 p-8 rounded-2xl bg-red-500/10 border border-red-500/30 text-center">
            <p className="text-red-400 font-semibold text-lg mb-2">We couldn't confirm your subscription yet</p>
            <p className="text-white/50 text-sm mb-6">
              Your payment may still have gone through. Check Settings → Pro tab in a minute — it can take a moment to sync.
              If your plan doesn't update, contact us at{' '}
              <a href="mailto:support@remixr.app" className="text-white/70 underline hover:text-white">support@remixr.app</a>
              {' '}with your receipt and we'll sort it out.
            </p>
            <button
              onClick={() => navigate('/settings')}
              className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-colors"
            >
              Check Settings
            </button>
          </div>
        )}

        {/* Activation success — shown when tier confirmed as pro */}
        {(success && activated) || (success && !activating && isPro) ? (
          <div className="mb-8 p-8 rounded-2xl bg-yellow-500/10 border border-yellow-500/40 text-center">
            <div className="text-5xl mb-4">🎉</div>
            <h2 className="text-2xl font-bold text-yellow-400 mb-2">You're on Remixr Pro!</h2>
            <p className="text-white/60 mb-6">Unlimited uploads, priority Discover placement, and more — all unlocked.</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => navigate('/upload')}
                className="px-6 py-3 rounded-xl bg-yellow-500 hover:bg-yellow-400 text-dark-900 font-semibold text-sm transition-colors"
              >
                Start uploading →
              </button>
              <button
                onClick={() => navigate('/profile')}
                className="px-6 py-3 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-colors"
              >
                View profile
              </button>
            </div>
          </div>
        ) : null}

        {/* Cancelled banner */}
        {cancelled && (
          <div className="mb-6 p-4 rounded-xl bg-white/5 border border-white/10 text-white/60 text-center">
            Checkout cancelled — no charges made.
          </div>
        )}

        {/* Already Pro (not coming from checkout) */}
        {isPro && !success && (
          <div className="mb-6 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-center font-medium">
            You're already on Remixr Pro. Manage your subscription in Settings.
          </div>
        )}

        {/* Billing toggle */}
        {!isPro && !activating && !activated && (
          <div className="flex justify-center mb-8">
            <div className="inline-flex bg-dark-800 border border-white/10 rounded-xl p-1 gap-1">
              <button
                onClick={() => setPlan('monthly')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  plan === 'monthly' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setPlan('yearly')}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${
                  plan === 'yearly' ? 'bg-white/10 text-white' : 'text-white/50 hover:text-white/80'
                }`}
              >
                Yearly
                <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full font-semibold">
                  2 months free
                </span>
              </button>
            </div>
          </div>
        )}

        {/* Pricing cards */}
        {!activating && !activated && !activationFailed && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* Free */}
          <div className="rounded-2xl border border-white/10 bg-dark-800 p-6 flex flex-col">
            <div className="mb-5">
              <p className="text-sm font-semibold text-black uppercase tracking-widest mb-1">Free</p>
              <p className="text-3xl text-black font-bold">$0</p>
              <p className="text-black text-sm mt-1">Forever free</p>
            </div>
            <ul className="space-y-2.5 flex-1 mb-6">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-black">
                  <svg className="w-4 h-4 text-white/30 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <div className="h-10" />
          </div>

          {/* Pro */}
          <div className="rounded-2xl border border-yellow-500/40 bg-dark-800 p-6 flex flex-col relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent pointer-events-none" />
            <div className="mb-5 relative">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-yellow-400 uppercase tracking-widest">Pro</p>
                <span className="bg-yellow-500/20 text-yellow-400 text-xs px-2 py-0.5 rounded-full font-semibold">
                  Most Popular
                </span>
              </div>
              <div className="flex items-end gap-2">
                <p className="text-3xl text-black font-bold">
                  {plan === 'yearly' ? PRICING.yearly.display : PRICING.monthly.display}
                </p>
                <p className="text-black text-sm mb-1">/month</p>
              </div>
              {plan === 'yearly' ? (
                <p className="text-black text-sm mt-1">{PRICING.yearly.total} {PRICING.yearly.totalLabel}</p>
              ) : (
                <p className="text-black text-sm mt-1">billed monthly</p>
              )}
            </div>
            <div className="mb-3 relative">
              <p className="text-xs text-black font-medium uppercase tracking-wider">Includes everything in Free, plus:</p>
            </div>
            <ul className="space-y-3.5 flex-1 mb-6 relative">
              {PRO_FEATURES.map((f) => (
                <li key={f.label} className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <div>
                    <p className="text-sm text-black font-medium leading-snug">{f.label}</p>
                    <p className="text-xs text-black mt-0.5 leading-snug">{f.detail}</p>
                  </div>
                </li>
              ))}
            </ul>

            {!isPro && (
              <button
                onClick={handleUpgrade}
                disabled={loading}
                className="relative w-full py-3 rounded-xl font-semibold text-sm bg-yellow-500 hover:bg-yellow-400 text-dark-900 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {loading ? 'Redirecting to checkout…' : `Get Pro — ${plan === 'yearly' ? PRICING.yearly.checkoutLabel : PRICING.monthly.checkoutLabel}`}
              </button>
            )}

            {isPro && (
              <div className="relative w-full py-3 rounded-xl font-semibold text-sm bg-yellow-500/20 text-yellow-400 text-center border border-yellow-500/30">
                Current plan
              </div>
            )}
          </div>
        </div>
        )}

        {error && (
          <p className="mt-4 text-center text-red-400 text-sm">{error}</p>
        )}

        <p className="mt-6 text-center text-white/30 text-xs">
          Subscriptions auto-renew. Cancel anytime from Settings. Payments processed securely by Stripe.
        </p>
      </div>
    </div>
  );
}
