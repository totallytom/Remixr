// POST /api/create-stripe-account
// Stripe Connect (Express) for storefront sellers.
//
// Body: { userId, action? }
//   action 'onboard' (default) → reuse the seller's existing Express account (or
//                                create one) and return an onboarding link
//   action 'status'            → { connected, ready, requirementsDue } live from
//                                Stripe; also syncs users.stripe_account_verified
//   action 'dashboard'         → login link to the seller's Express dashboard
//
// One file for all three so the project stays within Vercel's function limit.

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { isUUID, resolveAppUrl } = require('./_validate');
const { isAccountReady, syncAccountReadiness } = require('./_stripeConnect');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Returns the seller's Stripe account, or null if none is saved or it was
// deleted on Stripe's side.
async function loadExistingAccount(accountId) {
  if (!accountId) return null;
  try {
    const account = await stripe.accounts.retrieve(accountId);
    return account.deleted ? null : account;
  } catch (err) {
    if (err?.code === 'resource_missing' || err?.statusCode === 404) return null;
    throw err;
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing authorization token' });

    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) return res.status(401).json({ error: 'Invalid or expired token' });

    const { userId, action = 'onboard' } = req.body ?? {};
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    if (!isUUID(userId)) return res.status(400).json({ error: 'Invalid userId' });
    if (caller.id !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (!['onboard', 'status', 'dashboard'].includes(action)) {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('stripe_account_id')
      .eq('id', userId)
      .maybeSingle();
    if (profileError || !profile) return res.status(404).json({ error: 'User not found' });

    let account = await loadExistingAccount(profile.stripe_account_id);

    // ── status ──
    if (action === 'status') {
      if (!account) return res.json({ connected: false, ready: false, requirementsDue: [] });
      const ready = await syncAccountReadiness(supabase, account);
      return res.json({
        connected: true,
        ready,
        requirementsDue: account.requirements?.currently_due ?? [],
      });
    }

    // ── dashboard ──
    if (action === 'dashboard') {
      if (!account || !account.details_submitted) {
        return res.status(400).json({ error: 'Finish Stripe onboarding first.' });
      }
      const login = await stripe.accounts.createLoginLink(account.id);
      return res.json({ url: login.url });
    }

    // ── onboard ──
    if (!account) {
      account = await stripe.accounts.create({
        type: 'express',
        email: caller.email ?? undefined,
        capabilities: {
          card_payments: { requested: true },
          transfers:     { requested: true },
        },
        metadata: { user_id: userId },
      });

      const { error: dbError } = await supabase
        .from('users')
        .update({ stripe_account_id: account.id, stripe_account_verified: false })
        .eq('id', userId);
      if (dbError) {
        console.error('Supabase DB error:', dbError);
        return res.status(500).json({ error: 'Failed to save account. Please try again.' });
      }
    } else if (isAccountReady(account)) {
      await syncAccountReadiness(supabase, account);
      return res.json({ url: null, ready: true, stripeAccountId: account.id });
    }

    const appUrl = resolveAppUrl();
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      // refresh_url is hit when the link expires; the Storefront re-requests a link.
      refresh_url: `${appUrl}/storefront?stripe=refresh`,
      return_url:  `${appUrl}/storefront?stripe=return`,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url, ready: false, stripeAccountId: account.id });
  } catch (error) {
    console.error('Stripe onboarding error:', error);
    res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
};
