// Storefront refund policy — shown at checkout and in My Purchases.
// Keep in sync with the Refunds section of the Terms (info.re-mixed.net/terms).

/**
 * UI side of the sales kill switch. The server (STOREFRONT_SALES_ENABLED in
 * create-storefront-checkout) is the real gate; this only hides the Pay button.
 * Paused unless explicitly set to 'true' for the environment.
 */
export const STOREFRONT_SALES_ENABLED = import.meta.env.VITE_STOREFRONT_SALES_ENABLED === 'true';

export const SALES_PAUSED_MESSAGE = 'Storefront sales are paused right now. Please check back soon.';

export const REFUND_WINDOW_DAYS = 14;

/** One line for tight spaces (purchase modal). */
export const REFUND_POLICY_SHORT =
  `All sales are final. Refunds within ${REFUND_WINDOW_DAYS} days only for duplicate charges, or files that are broken or not as described.`;

/** Full wording for the purchases page and the Terms. */
export const REFUND_POLICY_FULL =
  `All Storefront sales are final, because downloads can't be returned. Within ${REFUND_WINDOW_DAYS} days of purchase ` +
  `we'll refund duplicate charges, and files that are broken, won't play, or aren't what the listing described. ` +
  `Duplicate charges are refunded automatically. For anything else, contact support with your Stripe receipt. ` +
  `A refunded purchase can no longer be downloaded. Tracks removed after a copyright claim can't be downloaded either; ` +
  `if that happens within ${REFUND_WINDOW_DAYS} days of your purchase, you can ask for a refund.`;
