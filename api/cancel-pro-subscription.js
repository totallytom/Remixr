// api/cancel-pro-subscription.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { isStripeId } = require('./_validate');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    // Verify caller identity from Supabase JWT
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: 'Missing authorization token' });
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const { subscriptionId } = req.body;
    if (!subscriptionId) {
      return res.status(400).json({ error: 'subscriptionId is required' });
    }
    if (!isStripeId(subscriptionId)) {
      return res.status(400).json({ error: 'Invalid subscriptionId' });
    }

    // Confirm this subscription belongs to the authenticated user
    const { data: sub, error: subError } = await supabase
      .from('pro_subscriptions')
      .select('id')
      .eq('stripe_subscription_id', subscriptionId)
      .eq('user_id', user.id)
      .in('status', ['active', 'past_due'])
      .maybeSingle();

    if (subError) {
      console.error('Subscription lookup error:', subError);
      return res.status(500).json({ error: 'Failed to verify subscription ownership' });
    }
    if (!sub) {
      return res.status(403).json({ error: 'Subscription not found or does not belong to this account' });
    }

    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });

    await supabase
      .from('pro_subscriptions')
      .update({ cancel_at_period_end: true, updated_at: new Date().toISOString() })
      .eq('stripe_subscription_id', subscriptionId);

    res.json({
      cancel_at_period_end: subscription.cancel_at_period_end,
      current_period_end: subscription.current_period_end,
    });
  } catch (error) {
    console.error('Cancel subscription error:', error);
    res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
};
