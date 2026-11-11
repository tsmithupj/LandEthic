'use client';

import type { BillingInterval } from '@/lib/pricing';
import type { SubscriptionTier } from '@/types';

/** Send the member straight to Stripe Checkout for a plan (one tap from the banner). */
export async function startCheckout(tier: Exclude<SubscriptionTier, 'free'>, interval: BillingInterval = 'year'): Promise<string | null> {
  try {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier, interval }),
    });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (res.status === 409) {
      window.location.href = '/upgrade';
      return null;
    }
    if (!res.ok || !data.url) return data.error ?? 'Could not open checkout. Please try again.';
    window.location.href = data.url;
    return null;
  } catch {
    return 'Could not open checkout. Please try again.';
  }
}
