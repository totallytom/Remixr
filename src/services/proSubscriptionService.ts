import { supabase } from './supabase';
import {
  createSubscriptionSession,
  createPortalSession,
  activateSubscription,
  cancelProSubscription,
} from './api';

export interface ProSubscription {
  id: string;
  userId: string;
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  plan: 'monthly' | 'yearly';
  status: 'active' | 'cancelled' | 'past_due' | 'expired';
  currentPeriodStart: Date;
  currentPeriodEnd: Date;
  cancelAtPeriodEnd: boolean;
  createdAt: Date;
}

function transform(row: Record<string, unknown>): ProSubscription {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    stripeSubscriptionId: row.stripe_subscription_id as string,
    stripeCustomerId: row.stripe_customer_id as string,
    plan: row.plan as 'monthly' | 'yearly',
    status: row.status as ProSubscription['status'],
    currentPeriodStart: new Date(row.current_period_start as string),
    currentPeriodEnd: new Date(row.current_period_end as string),
    cancelAtPeriodEnd: row.cancel_at_period_end as boolean,
    createdAt: new Date(row.created_at as string),
  };
}

export const proSubscriptionService = {
  async getSubscription(userId: string): Promise<ProSubscription | null> {
    const { data, error } = await supabase
      .from('pro_subscriptions')
      .select('*')
      .eq('user_id', userId)
      .in('status', ['active', 'past_due'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return null;
    return transform(data);
  },

  isProUser(subscriptionTier?: string): boolean {
    return subscriptionTier === 'artist';
  },

  async startProCheckout(stripeCustomerId: string | null | undefined, plan: 'monthly' | 'yearly', userId?: string, email?: string): Promise<void> {
    const data = await createSubscriptionSession({
      ...(stripeCustomerId ? { customerId: stripeCustomerId } : {}),
      plan,
      userId,
      email,
      successUrl: `${window.location.origin}/upgrade?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancelUrl: `${window.location.origin}/upgrade?cancelled=true`,
    });
    if (data.url) {
      window.location.href = data.url;
    } else if (data.error === 'already_subscribed') {
      throw new Error('You already have an active Pro subscription. Manage it in Settings.');
    } else {
      throw new Error(data.error || 'Failed to start checkout');
    }
  },

  async openPortal(): Promise<void> {
    const { url } = await createPortalSession(window.location.origin + '/upgrade');
    window.location.href = url;
  },

  async activateFromSession(sessionId: string): Promise<void> {
    await activateSubscription(sessionId);
  },

  async cancelAtPeriodEnd(subscriptionId: string): Promise<{ currentPeriodEnd: Date }> {
    return cancelProSubscription(subscriptionId);
  },
};
