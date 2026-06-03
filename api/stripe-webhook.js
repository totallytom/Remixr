// api/stripe-webhook.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const getRawBody = (req) =>
  new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });

const handler = async (req, res) => {
  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('STRIPE_WEBHOOK_SECRET is not set — rejecting all webhook events');
    return res.status(500).send('Webhook secret not configured');
  }

  const sig = req.headers['stripe-signature'];
  let event;

  try {
    const rawBody = await getRawBody(req);
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if (session.mode !== 'subscription') break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription);
        const customerId = session.customer;

        const priceId = subscription.items.data[0]?.price?.id;
        const plan = priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID ? 'yearly' : 'monthly';

        let { data: userData, error: userError } = await supabase
          .from('users')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();

        // Fallback: look up by email if customer ID isn't stored yet
        if (!userData && session.customer_details?.email) {
          const { data: byEmail } = await supabase
            .from('users')
            .select('id')
            .eq('email', session.customer_details.email)
            .maybeSingle();
          userData = byEmail;
        }

        if (!userData) {
          console.error('Could not find user for customer:', customerId, session.customer_details?.email);
          break;
        }

        const userId = userData.id;

        // Ensure stripe_customer_id is saved so future webhooks can find the user by ID
        await supabase.from('users').update({ stripe_customer_id: customerId }).eq('id', userId);

        await supabase.from('pro_subscriptions').upsert({
          user_id: userId,
          stripe_subscription_id: subscription.id,
          stripe_customer_id: customerId,
          plan,
          status: 'active',
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'stripe_subscription_id' });

        await supabase.from('users').update({ subscription_tier: 'pro' }).eq('id', userId);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const priceId = subscription.items.data[0]?.price?.id;
        const plan = priceId === process.env.STRIPE_PRO_YEARLY_PRICE_ID ? 'yearly' : 'monthly';

        const stripeStatus = subscription.status;
        const dbStatus = stripeStatus === 'active' ? 'active'
          : stripeStatus === 'past_due' ? 'past_due'
          : stripeStatus === 'canceled' ? 'cancelled'
          : 'expired';

        const { data: subData } = await supabase
          .from('pro_subscriptions')
          .update({
            plan,
            status: dbStatus,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_subscription_id', subscription.id)
          .select('user_id')
          .maybeSingle();

        if (subData?.user_id) {
          if (dbStatus === 'active') {
            // Re-confirm pro tier when subscription recovers from past_due → active
            await supabase.from('users').update({ subscription_tier: 'pro' }).eq('id', subData.user_id);
          } else if (dbStatus === 'cancelled' || dbStatus === 'expired') {
            // Stripe may fire subscription.updated with status=canceled before subscription.deleted;
            // downgrade here so access is revoked even if the deleted event is missed.
            await supabase.from('users').update({ subscription_tier: 'free' }).eq('id', subData.user_id);
          }
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;

        const { data: subData } = await supabase
          .from('pro_subscriptions')
          .update({ status: 'cancelled', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', subscription.id)
          .select('user_id')
          .maybeSingle();

        if (subData?.user_id) {
          await supabase.from('users').update({ subscription_tier: 'free' }).eq('id', subData.user_id);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        if (!invoice.subscription) break;

        await supabase
          .from('pro_subscriptions')
          .update({ status: 'past_due', updated_at: new Date().toISOString() })
          .eq('stripe_subscription_id', invoice.subscription);
        break;
      }

      // ── Track purchase confirmed ────────────────────────────────────────────
      // Fired after the buyer's card is charged successfully.
      // Marks the pending store_purchases row as completed, bumps sales_count,
      // and auto-delists exclusive-license tracks.
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        if (pi.metadata?.type !== 'track_purchase') break;

        const { listing_id, buyer_id, seller_id, license_type } = pi.metadata;

        // Verify the charged amount matches the listing price to catch any
        // race-condition or tampering where a PI was created with the wrong amount.
        const { data: listingCheck } = await supabase
          .from('store_listings')
          .select('price')
          .eq('id', listing_id)
          .maybeSingle();

        if (listingCheck) {
          const expectedCents = Math.round(listingCheck.price * 100);
          if (pi.amount !== expectedCents) {
            console.error(
              `PRICE MISMATCH on payment_intent ${pi.id} — expected=${expectedCents} got=${pi.amount}. Purchase not completed; requires manual review.`
            );
            break;
          }
        } else {
          // Listing was deleted after the PaymentIntent was created.
          // The PI amount was locked server-side so no price manipulation is possible,
          // but log for audit purposes.
          console.warn(`Listing ${listing_id} deleted before webhook; amount=${pi.amount} pi=${pi.id} — completing purchase`);
        }

        // Upsert — handles the rare case where the pending row wasn't created.
        const { error: upsertError } = await supabase
          .from('store_purchases')
          .upsert(
            {
              listing_id,
              buyer_id,
              seller_id,
              price:             pi.amount / 100,
              license_type,
              payment_intent_id: pi.id,
              status:            'completed',
            },
            { onConflict: 'payment_intent_id' },
          );

        if (upsertError) {
          console.error('store_purchases upsert failed:', upsertError.message);
          // Throw so the outer catch returns 500 and Stripe retries the event.
          throw upsertError;
        }

        // Increment sales counter atomically via the RPC defined in the migration.
        await supabase.rpc('increment_listing_sales', { listing_id });

        // Exclusive purchases automatically delist the track so it can't be
        // sold again — the RLS update policy allows the service role to do this.
        if (license_type === 'exclusive') {
          await supabase
            .from('store_listings')
            .update({ is_active: false })
            .eq('id', listing_id);
        }

        console.log(`Track purchase completed: listing=${listing_id} buyer=${buyer_id}`);
        break;
      }

      // ── Track purchase refunded ─────────────────────────────────────────────
      // Fired when a charge is fully or partially refunded in the Stripe dashboard
      // or via API. Marks the purchase as refunded so download-purchase.js rejects
      // further download requests (it only grants access for status = 'completed').
      case 'charge.refunded': {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;
        if (!paymentIntentId) break;

        const { error: refundError } = await supabase
          .from('store_purchases')
          .update({ status: 'refunded' })
          .eq('payment_intent_id', paymentIntentId);

        if (refundError) {
          console.error('Failed to mark purchase refunded:', refundError.message);
        } else {
          console.log(`Purchase refunded: payment_intent=${paymentIntentId}`);
        }
        break;
      }

      // ── Connect account onboarding completed ───────────────────────────────
      // Fired when a seller finishes Stripe Express onboarding and their account
      // is fully enabled for payouts.
      case 'account.updated': {
        const account = event.data.object;
        if (!account.charges_enabled || !account.payouts_enabled) break;

        await supabase
          .from('users')
          .update({ stripe_account_verified: true })
          .eq('stripe_account_id', account.id);
        break;
      }

      default:
        break;
    }

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook handler error:', error);
    res.status(500).json({ error: 'Webhook handler failed' });
  }
};

// config must be set on the exported function, not before reassigning module.exports
handler.config = { api: { bodyParser: false } };
module.exports = handler;
