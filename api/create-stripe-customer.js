const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  try {
    const { userId, email } = req.body;
    if (!userId || !email) {
      return res.status(400).json({ error: 'Missing userId or email' });
    }

    // 1. Create Stripe customer
    const customer = await stripe.customers.create({
      email,
      metadata: { userId }
    });

    // 2. Store customer.id in Supabase
    const { error } = await supabase
      .from('users')
      .update({ stripe_customer_id: customer.id })
      .eq('id', userId);

    if (error) {
      return res.status(500).json({ error: error.message });
    }

    res.json({ stripeCustomerId: customer.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};