import Stripe from 'stripe';
import type { SubscriptionTier } from '@/types';

export type PaidTier = Exclude<SubscriptionTier, 'free'>;

export const PAID_TIERS: PaidTier[] = ['steward', 'naturalist', 'conservationist'];

// Lazy init — evaluating `new Stripe()` at module load time would crash `next build`
// if STRIPE_SECRET_KEY isn't set yet, same reasoning as lib/db/client.ts's getDb().
let _stripe: Stripe | null = null;

export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
      apiVersion: '2026-08-26.dahlia',
    });
  }
  return _stripe;
}

const TIER_PRICE_ENV: Record<PaidTier, string | undefined> = {
  steward: process.env.STRIPE_PRICE_STEWARD,
  naturalist: process.env.STRIPE_PRICE_NATURALIST,
  conservationist: process.env.STRIPE_PRICE_CONSERVATIONIST,
};

export function priceIdForTier(tier: PaidTier): string {
  const priceId = TIER_PRICE_ENV[tier];
  if (!priceId) throw new Error(`Missing price id env var for tier "${tier}" — run "npm run stripe:setup"`);
  return priceId;
}

export function tierForPriceId(priceId: string): SubscriptionTier | null {
  for (const tier of PAID_TIERS) {
    if (TIER_PRICE_ENV[tier] === priceId) return tier;
  }
  return null;
}
