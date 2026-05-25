const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing authorization token' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Invalid token' });

    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ error: 'Missing sessionId' });

    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription'],
    });

    if (session.payment_status !== 'paid' || session.mode !== 'subscription') {
      return res.status(400).json({ error: 'Session not completed or not a subscription' });
    }

    // Verify this session belongs to the authenticated user's Stripe customer
    const { data: profile } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', user.id)
      .single();

    if (profile?.stripe_customer_id && profile.stripe_customer_id !== session.customer) {
      return res.status(403).json({ error: 'Session does not belong to this account' });
    }

    const subscription = session.subscription;
    const priceId = subscription.items.data[0]?.price?.id;
    const plan = priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID ? 'yearly' : 'monthly';

    const { error: upsertError } = await supabase.from('pro_subscriptions').upsert({
      user_id: user.id,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: session.customer,
      plan,
      status: 'active',
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'stripe_subscription_id' });

    if (upsertError) {
      console.error('pro_subscriptions upsert failed:', upsertError);
      return res.status(500).json({ error: `Failed to save subscription: ${upsertError.message}` });
    }

    const { error: tierError } = await supabase
      .from('users')
      .update({ subscription_tier: 'pro', stripe_customer_id: session.customer })
      .eq('id', user.id);

    if (tierError) {
      console.error('users tier update failed:', tierError);
      return res.status(500).json({ error: `Failed to update subscription tier: ${tierError.message}` });
    }

    res.json({ success: true, plan });
  } catch (error) {
    console.error('Activate subscription error:', error);
    res.status(500).json({ error: error.message });
  }
};
