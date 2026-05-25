// api/create-storefront-checkout.js
// Creates a Stripe Checkout Session for a storefront track purchase and returns
// the hosted payment page URL. The buyer is redirected there; on completion
// Stripe fires payment_intent.succeeded which the webhook uses to finalise the
// store_purchases record (same handler as the old PaymentIntent flow).
//
// POST /api/create-storefront-checkout
// Headers: Authorization: Bearer <supabase_jwt>
// Body:    { listingId: string }
// Returns: { url: string, sessionId: string }

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PLATFORM_FEE = Number(process.env.STOREFRONT_PLATFORM_FEE_PERCENT ?? 7) / 100;

function resolveAppUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  if (host) return `${proto}://${host}`;
  const raw = process.env.APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || 'https://re-mixed.net';
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
}

// Per-user rate limit: max 3 checkout attempts per 60 seconds (best-effort, per-instance).
const _rlMap = new Map();
const RL_MAX = 3;
const RL_WINDOW_MS = 60_000;

function isRateLimited(userId) {
  const now = Date.now();
  const cutoff = now - RL_WINDOW_MS;
  const hits = (_rlMap.get(userId) ?? []).filter(t => t > cutoff);
  if (hits.length >= RL_MAX) return true;
  hits.push(now);
  _rlMap.set(userId, hits);
  if (_rlMap.size > 10_000) _rlMap.delete(_rlMap.keys().next().value);
  return false;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── 1. Authenticate buyer ──────────────────────────────────────────────────
  const authHeader = req.headers['authorization'] ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Missing authorization token' });

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  if (isRateLimited(user.id)) {
    return res.status(429).json({ error: 'Too many checkout attempts. Please wait a moment and try again.' });
  }

  // ── 2. Validate listing ────────────────────────────────────────────────────
  const { listingId } = req.body ?? {};
  if (!listingId) return res.status(400).json({ error: 'Missing listingId' });

  const { data: listing, error: listingError } = await supabase
    .from('store_listings')
    .select(`
      id, track_id, seller_id, price, license_type, is_active,
      tracks:track_id (title, artist),
      users:seller_id (stripe_account_id)
    `)
    .eq('id', listingId)
    .maybeSingle();

  if (listingError) return res.status(500).json({ error: 'Failed to fetch listing' });
  if (!listing)            return res.status(404).json({ error: 'Listing not found' });
  if (!listing.is_active)  return res.status(400).json({ error: 'This listing is no longer active' });
  if (listing.seller_id === user.id) {
    return res.status(400).json({ error: "You can't purchase your own track" });
  }

  // ── 3. Prevent duplicate completed purchases ───────────────────────────────
  const { data: existing } = await supabase
    .from('store_purchases')
    .select('id')
    .eq('listing_id', listingId)
    .eq('buyer_id', user.id)
    .eq('status', 'completed')
    .maybeSingle();

  if (existing) return res.status(409).json({ error: 'You already own this track' });

  // ── 4. Build Checkout Session ──────────────────────────────────────────────
  const track      = Array.isArray(listing.tracks) ? listing.tracks[0] : (listing.tracks ?? {});
  const seller     = Array.isArray(listing.users)  ? listing.users[0]  : (listing.users  ?? {});
  const amountCents = Math.round(listing.price * 100);
  const platformFee = Math.round(amountCents * PLATFORM_FEE);
  const appUrl      = resolveAppUrl(req);

  const licenseLabel = listing.license_type.charAt(0).toUpperCase() + listing.license_type.slice(1);

  const sessionParams = {
    mode: 'payment',
    line_items: [{
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: amountCents,
        product_data: {
          name: track.title ?? 'Track Purchase',
          description: `${licenseLabel} License · by ${track.artist ?? 'Unknown Artist'}`,
        },
      },
    }],
    // Metadata on payment_intent_data so the existing payment_intent.succeeded
    // webhook handler picks it up without any changes.
    payment_intent_data: {
      metadata: {
        type:         'track_purchase',
        listing_id:   listingId,
        track_id:     listing.track_id,
        buyer_id:     user.id,
        seller_id:    listing.seller_id,
        license_type: listing.license_type,
      },
      ...(seller.stripe_account_id ? {
        transfer_data:          { destination: seller.stripe_account_id },
        application_fee_amount: platformFee,
      } : {}),
    },
    success_url: `${appUrl}/storefront?checkout_success=1&listing_id=${encodeURIComponent(listingId)}`,
    cancel_url:  `${appUrl}/storefront`,
  };

  // Pre-fill the buyer's email on the Stripe-hosted page if available.
  if (user.email) sessionParams.customer_email = user.email;

  let session;
  try {
    session = await stripe.checkout.sessions.create(sessionParams);
  } catch (stripeErr) {
    console.error('Stripe Checkout Session error:', stripeErr);
    return res.status(500).json({ error: stripeErr.message });
  }

  return res.json({ url: session.url, sessionId: session.id });
};
