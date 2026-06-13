const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { isUUID, resolveAppUrl } = require('./_validate');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing authorization token' });

    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) return res.status(401).json({ error: 'Invalid or expired token' });

    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });
    if (!isUUID(userId)) return res.status(400).json({ error: 'Invalid userId' });

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
      return res.status(500).json({ error: 'Failed to save account. Please try again.' });
    }

    // 3. Create account onboarding link
    const appUrl = resolveAppUrl();
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${appUrl}/profile`,
      return_url: `${appUrl}/profile`,
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url, stripeAccountId: account.id });
  } catch (error) {
    console.error('Stripe onboarding error:', error);
    res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
}; 