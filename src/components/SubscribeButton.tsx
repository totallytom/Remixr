// src/components/SubscribeButton.tsx
import React from 'react';

interface SubscribeButtonProps {
  customerId: string; // From your Supabase users table
  priceId: string;    // Stripe Price ID for the subscription
}

const SubscribeButton: React.FC<SubscribeButtonProps> = ({ customerId, priceId }) => {
  const handleSubscribe = async () => {
    const response = await fetch('/api/create-subscription-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId,
        priceId,
        successUrl: window.location.origin + '/subscription-success',
        cancelUrl: window.location.origin + '/subscription-cancel',
      }),
    });
    const data = await response.json();
    if (data.url) {
      window.location.href = data.url; // Redirect to Stripe Checkout
    } else {
      alert('Failed to start subscription: ' + (data.error || 'Unknown error'));
    }
  };

  return (
    <button
      onClick={handleSubscribe}
      className="px-6 py-3 bg-primary-600 text-white rounded-lg font-semibold hover:bg-primary-700 transition-colors"
    >
      Subscribe for $10/month
    </button>
  );
};

export default SubscribeButton;