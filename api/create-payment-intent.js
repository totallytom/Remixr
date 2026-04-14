const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  try {
    const { amount, currency = 'usd', sellerStripeAccountId, metadata = {} } = req.body;
    
    if (!amount) {
      return res.status(400).json({ error: 'Missing amount' });
    }

    // Create PaymentIntent
    const paymentIntentData = {
      amount,
      currency,
      metadata,
    };

    // If sellerStripeAccountId is provided, this is a marketplace payment
    if (sellerStripeAccountId) {
      const fee = Math.round(amount * 0.07); // 7% fee
      paymentIntentData.application_fee_amount = fee;
      paymentIntentData.transfer_data = {
        destination: sellerStripeAccountId,
      };
    }

    const paymentIntent = await stripe.paymentIntents.create(paymentIntentData);

    res.json({ 
      id: paymentIntent.id,
      clientSecret: paymentIntent.client_secret 
    });
  } catch (error) {
    console.error('Stripe PaymentIntent error:', error);
    res.status(500).json({ error: error.message });
  }
}; 