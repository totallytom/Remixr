const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  try {
    const { customerId, songId } = req.body;
    if (!customerId || !songId) {
      return res.status(400).json({ error: 'Missing customerId or songId' });
    }

    // Create a subscription for $10/month (set up this price in Stripe dashboard)
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: process.env.BOOST_PRICE_ID }],
      metadata: { songId },
    });

    // Update your DB: set boosted=true, boost_expiry=now+1month for songId
    const boostExpiry = new Date();
    boostExpiry.setMonth(boostExpiry.getMonth() + 1);
    const { error: dbError } = await supabase
      .from('store_items')
      .update({ boosted: true, boost_expiry: boostExpiry.toISOString() })
      .eq('id', songId);
    if (dbError) {
      console.error('Supabase DB error:', dbError);
      return res.status(500).json({ error: dbError.message });
    }

    res.json({ subscriptionId: subscription.id, status: subscription.status });
  } catch (error) {
    console.error('Stripe Boost Subscription error:', error);
    res.status(500).json({ error: error.message });
  }
}; 