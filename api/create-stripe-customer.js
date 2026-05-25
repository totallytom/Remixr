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

    const { userId, email } = req.body;
    if (!userId || !email) {
      return res.status(400).json({ error: 'Missing userId or email' });
    }

    if (caller.id !== userId) {
      return res.status(403).json({ error: 'Forbidden' });
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