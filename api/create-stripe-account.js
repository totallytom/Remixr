const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

function resolveAppUrl(req) {
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  if (host) return `${proto}://${host}`;
  const raw = process.env.APP_URL
    || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
    || 'https://re-mixed.net';
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`;
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing authorization token' });

    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) return res.status(401).json({ error: 'Invalid or expired token' });

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

    if (caller.id !== userId) return res.status(403).json({ error: 'Forbidden' });

    // 1. Create Stripe Express account
    const account = await stripe.accounts.create({ type: 'express' });

    // 2. Save account.id to your users table for userId
    const { error: dbError } = await supabase
      .from('users')
      .update({ stripe_account_id: account.id })
      .eq('id', userId);
    if (dbError) {
      console.error('Supabase DB error:', dbError);
      return res.status(500).json({ error: dbError.message });
    }

    // 3. Create account onboarding link
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${resolveAppUrl(req)}/profile`,
      return_url: `${resolveAppUrl(req)}/profile`,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url, stripeAccountId: account.id });
  } catch (error) {
    console.error('Stripe onboarding error:', error);
    res.status(500).json({ error: error.message });
  }
}; 