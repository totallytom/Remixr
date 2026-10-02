// Shared Stripe Connect helpers for the storefront API routes.
// Underscore prefix: Vercel does not deploy this file as a function.

/** True when an Express account can take destination charges and pay out. */
function isAccountReady(account) {
  return Boolean(
    account &&
    !account.deleted &&
    account.charges_enabled &&
    account.payouts_enabled &&
    account.capabilities?.transfers === 'active'
  );
}

/** Mirror the account's readiness onto users.stripe_account_verified. */
async function syncAccountReadiness(supabase, account) {
  const ready = isAccountReady(account);
  const { error } = await supabase
    .from('users')
    .update({ stripe_account_verified: ready })
    .eq('stripe_account_id', account.id);
  if (error) console.error('stripe_account_verified sync failed:', error.message);
  return ready;
}

/**
 * After a (full or partial) refund or a lost dispute on a destination charge,
 * take the seller's share back and return the platform fee proportionally.
 * Refunds issued with reverse_transfer / refund_application_fee already did
 * this, so only the outstanding difference is moved — safe to call repeatedly
 * (Stripe webhook retries).
 */
async function reverseSellerShare(stripe, charge, amountReturnedCents) {
  if (!charge.amount) return;
  const fraction = Math.min(1, amountReturnedCents / charge.amount);

  if (charge.transfer) {
    const transferId = typeof charge.transfer === 'string' ? charge.transfer : charge.transfer.id;
    const transfer = await stripe.transfers.retrieve(transferId);
    const target = Math.floor(transfer.amount * fraction);
    const outstanding = target - (transfer.amount_reversed ?? 0);
    if (outstanding > 0) {
      await stripe.transfers.createReversal(transferId, {
        amount: outstanding,
        metadata: { reason: 'storefront_refund', charge: charge.id },
      });
    }
  }

  if (charge.application_fee) {
    const feeId = typeof charge.application_fee === 'string' ? charge.application_fee : charge.application_fee.id;
    const fee = await stripe.applicationFees.retrieve(feeId);
    const target = Math.floor(fee.amount * fraction);
    const outstanding = target - (fee.amount_refunded ?? 0);
    if (outstanding > 0) {
      await stripe.applicationFees.createRefund(feeId, { amount: outstanding });
    }
  }
}

module.exports = { isAccountReady, syncAccountReadiness, reverseSellerShare };
