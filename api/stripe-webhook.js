// api/stripe-webhook.js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');
const { syncAccountReadiness, reverseSellerShare } = require('./_stripeConnect');

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

  // Events about connected (seller) accounts come from a separate "Connected
  // accounts" endpoint in Stripe with its own signing secret; both point here.
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(Boolean);
  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    return res.status(400).send('Could not read request body');
  }
  let lastError;
  for (const secret of secrets) {
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, secret);
      break;
    } catch (err) {
      lastError = err;
    }
  }
  if (!event) {
    console.error('Webhook signature verification failed:', lastError?.message);
    return res.status(400).send(`Webhook Error: ${lastError?.message}`);
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

        // Fallback: look up by email if customer ID isn't stored yet. Emails
        // live only in auth.users, so use the server-only lookup function.
        if (!userData && session.customer_details?.email) {
          const { data: idByEmail } = await supabase.rpc('user_id_by_email', {
            p_email: session.customer_details.email,
          });
          userData = idByEmail ? { id: idByEmail } : null;
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
        // users.subscription_tier is derived by a trigger on pro_subscriptions
        // (recompute_subscription_tier), so it isn't written here.
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

        // The status update above re-derives users.subscription_tier via the
        // pro_subscriptions trigger — including downgrades, which now respect an
        // App Store subscription the user may still have.
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

        // Tier re-derived by the pro_subscriptions trigger.
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
      // Fired after the buyer's card is charged successfully. Records the
      // purchase (once — Stripe retries are no-ops), bumps sales_count and
      // auto-delists exclusive-license tracks.
      case 'payment_intent.succeeded': {
        const pi = event.data.object;
        if (pi.metadata?.type !== 'track_purchase') break;

        const { listing_id, buyer_id, seller_id, license_type, track_id, price_cents } = pi.metadata;

        // Check against the price locked in at checkout. Sessions created
        // before price_cents existed fall back to the listing's current price.
        let expectedCents = price_cents ? Number(price_cents) : null;
        if (expectedCents === null) {
          const { data: listingCheck } = await supabase
            .from('store_listings').select('price').eq('id', listing_id).maybeSingle();
          if (listingCheck) expectedCents = Math.round(listingCheck.price * 100);
        }
        if ((expectedCents !== null && pi.amount !== expectedCents) || pi.currency !== 'usd') {
          console.error(
            `AMOUNT MISMATCH on payment_intent ${pi.id} — expected=${expectedCents} usd, got=${pi.amount} ${pi.currency}. Purchase not completed; requires manual review.`
          );
          break;
        }

        // Already bought (e.g. paid in two tabs): refund this duplicate charge
        // in full, including the seller's share and the platform fee.
        const { data: owned } = await supabase
          .from('store_purchases')
          .select('id')
          .eq('listing_id', listing_id)
          .eq('buyer_id', buyer_id)
          .eq('status', 'completed')
          .neq('payment_intent_id', pi.id)
          .limit(1);
        const isDuplicate = Boolean(owned?.length);

        // Snapshot the track so the buyer's library survives delisting/takedowns.
        let snapshot = {};
        if (track_id) {
          const { data: t } = await supabase
            .from('tracks').select('title, artist, cover').eq('id', track_id).maybeSingle();
          if (t) snapshot = { track_id, track_title: t.title, track_artist: t.artist, track_cover: t.cover };
        }

        // ignoreDuplicates: a retried event (or one arriving after a refund)
        // must not flip the status back or count the sale twice.
        const { data: inserted, error: insertError } = await supabase
          .from('store_purchases')
          .upsert(
            {
              listing_id,
              buyer_id,
              seller_id,
              price:             pi.amount / 100,
              license_type,
              payment_intent_id: pi.id,
              status:            isDuplicate ? 'refunded' : 'completed',
              ...(isDuplicate ? { refunded_at: new Date().toISOString() } : {}),
              ...snapshot,
            },
            { onConflict: 'payment_intent_id', ignoreDuplicates: true },
          )
          .select('id');

        if (insertError) {
          console.error('store_purchases insert failed:', insertError.message);
          // Throw so the outer catch returns 500 and Stripe retries the event.
          throw insertError;
        }
        if (!inserted?.length) break; // already recorded

        if (isDuplicate) {
          await stripe.refunds.create(
            {
              payment_intent: pi.id,
              reason: 'duplicate',
              reverse_transfer: Boolean(pi.transfer_data?.destination),
              refund_application_fee: Boolean(pi.application_fee_amount),
            },
            { idempotencyKey: `dup-purchase-refund-${pi.id}` },
          );
          console.log(`Duplicate purchase refunded: listing=${listing_id} buyer=${buyer_id} pi=${pi.id}`);
          break;
        }

        // Increment sales counter atomically via the RPC defined in the migration.
        await supabase.rpc('increment_listing_sales', { listing_id });

        // Exclusive purchases automatically delist the track so it can't be
        // sold again.
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
      // Fired when a charge is fully or partially refunded (dashboard or API).
      // Only a FULL refund revokes the download. Either way the seller's share
      // and the platform fee are returned proportionally, so dashboard refunds
      // don't leave the platform paying the refund.
      case 'charge.refunded': {
        const charge = event.data.object;
        const paymentIntentId = charge.payment_intent;
        if (!paymentIntentId) break;

        const { data: purchase } = await supabase
          .from('store_purchases')
          .select('id, listing_id, license_type, status')
          .eq('payment_intent_id', paymentIntentId)
          .maybeSingle();
        if (!purchase) break; // not a storefront purchase (e.g. a subscription invoice)

        await reverseSellerShare(stripe, charge, charge.amount_refunded);

        if (!charge.refunded) {
          console.log(`Partial refund on purchase ${purchase.id}: ${charge.amount_refunded}/${charge.amount} cents; access kept.`);
          break;
        }

        if (purchase.status !== 'refunded') {
          const { error: refundError } = await supabase
            .from('store_purchases')
            .update({ status: 'refunded', refunded_at: new Date().toISOString() })
            .eq('id', purchase.id);
          if (refundError) throw refundError;

          // A refunded exclusive goes back on sale (if the track is still published
          // and the seller hasn't listed it again in the meantime).
          if (purchase.license_type === 'exclusive' && purchase.status === 'completed') {
            const { data: listing } = await supabase
              .from('store_listings')
              .select('id, tracks:track_id (status)')
              .eq('id', purchase.listing_id)
              .maybeSingle();
            const trackStatus = Array.isArray(listing?.tracks) ? listing.tracks[0]?.status : listing?.tracks?.status;
            if (listing && trackStatus === 'published') {
              const { error: relistError } = await supabase
                .from('store_listings').update({ is_active: true }).eq('id', listing.id);
              if (relistError) console.warn(`Could not relist exclusive ${listing.id}:`, relistError.message);
            }
          }
        }
        console.log(`Purchase refunded: payment_intent=${paymentIntentId}`);
        break;
      }

      // ── Chargebacks ─────────────────────────────────────────────────────────
      // Open dispute → no downloads. Won → access restored. Lost → treated as a
      // full refund, including taking back the seller's share.
      case 'charge.dispute.created': {
        const dispute = event.data.object;
        if (!dispute.payment_intent) break;
        await supabase
          .from('store_purchases')
          .update({ status: 'disputed' })
          .eq('payment_intent_id', dispute.payment_intent)
          .eq('status', 'completed');
        break;
      }

      case 'charge.dispute.closed': {
        const dispute = event.data.object;
        if (!dispute.payment_intent) break;

        if (dispute.status === 'lost') {
          const { data: purchase } = await supabase
            .from('store_purchases')
            .select('id')
            .eq('payment_intent_id', dispute.payment_intent)
            .maybeSingle();
          if (!purchase) break;
          const chargeId = typeof dispute.charge === 'string' ? dispute.charge : dispute.charge?.id;
          if (chargeId) {
            const charge = await stripe.charges.retrieve(chargeId);
            await reverseSellerShare(stripe, charge, dispute.amount);
          }
          await supabase
            .from('store_purchases')
            .update({ status: 'refunded', refunded_at: new Date().toISOString() })
            .eq('id', purchase.id);
        } else {
          // won / warning_closed → buyer keeps access
          await supabase
            .from('store_purchases')
            .update({ status: 'completed' })
            .eq('payment_intent_id', dispute.payment_intent)
            .eq('status', 'disputed');
        }
        break;
      }

      // ── Connect account changes ─────────────────────────────────────────────
      // Sent to the "Connected accounts" endpoint. Keeps
      // users.stripe_account_verified in sync both ways (onboarding finished,
      // or Stripe later restricts the account).
      case 'account.updated': {
        await syncAccountReadiness(supabase, event.data.object);
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
