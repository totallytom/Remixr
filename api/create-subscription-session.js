const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  try {
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Missing authorization token' });

    const { data: { user: caller }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !caller) return res.status(401).json({ error: 'Invalid or expired token' });

    let { customerId, plan, successUrl, cancelUrl, userId, email } = req.body;
    if (!plan || !successUrl || !cancelUrl) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Ensure the session is being created for the authenticated user only
    if (userId && userId !== caller.id) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    userId = caller.id;

    if (!customerId) {
      return res.status(400).json({ error: 'Missing customerId' });
    }

    // Verify the customerId belongs to the authenticated user
    const { data: userRow } = await supabase
      .from('users')
      .select('stripe_customer_id')
      .eq('id', caller.id)
      .maybeSingle();
    if (userRow?.stripe_customer_id && userRow.stripe_customer_id !== customerId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const priceId = plan === 'yearly'
      ? process.env.STRIPE_PRO_YEARLY_PRICE_ID
      : process.env.STRIPE_PRO_MONTHLY_PRICE_ID;

    if (!priceId) {
      return res.status(500).json({ error: `Price ID for plan "${plan}" is not configured` });
    }

    // Block duplicate subscriptions — if this customer already has an active subscription, refuse
    const existing = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });
    if (existing.data.length > 0) {
      return res.status(409).json({ error: 'already_subscribed' });
    }

    const sessionParams = {
      mode: 'subscription',
      payment_method_types: ['card'],
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
    };

    let session;
    try {
      session = await stripe.checkout.sessions.create(sessionParams);
    } catch (stripeErr) {
      // Stale customer ID — create a fresh one and retry
      if (stripeErr.code === 'resource_missing' && userId && email) {
        const customer = await stripe.customers.create({ email, metadata: { userId } });
        customerId = customer.id;
        await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', userId);
        session = await stripe.checkout.sessions.create({ ...sessionParams, customer: customerId });
      } else {
        throw stripeErr;
      }
    }

    res.json({ url: session.url });
  } catch (error) {
    console.error('Stripe subscription session error:', error);
    res.status(500).json({ error: error.message });
  }
};
