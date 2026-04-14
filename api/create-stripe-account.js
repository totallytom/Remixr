const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) return res.status(400).json({ error: 'Missing userId' });

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
      refresh_url: 'https://yourdomain.com/reauth',
      return_url: 'https://yourdomain.com/dashboard',
      type: 'account_onboarding',
    });

    res.json({ url: accountLink.url, stripeAccountId: account.id });
  } catch (error) {
    console.error('Stripe onboarding error:', error);
    res.status(500).json({ error: error.message });
  }
}; 