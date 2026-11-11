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

export type BillingInterval = 'month' | 'year';

// Monthly prices keep their original env var names; yearly prices add _YEARLY.
const PRICE_ENV: Record<PaidTier, Record<BillingInterval, string | undefined>> = {
  steward:         { month: process.env.STRIPE_PRICE_STEWARD,         year: process.env.STRIPE_PRICE_STEWARD_YEARLY },
  naturalist:      { month: process.env.STRIPE_PRICE_NATURALIST,      year: process.env.STRIPE_PRICE_NATURALIST_YEARLY },
  conservationist: { month: process.env.STRIPE_PRICE_CONSERVATIONIST, year: process.env.STRIPE_PRICE_CONSERVATIONIST_YEARLY },
};

export function isInterval(value: unknown): value is BillingInterval {
  return value === 'month' || value === 'year';
}

export function priceIdForTier(tier: PaidTier, interval: BillingInterval = 'month'): string {
  const priceId = PRICE_ENV[tier][interval];
  if (!priceId) {
    const envVar = `STRIPE_PRICE_${tier.toUpperCase()}${interval === 'year' ? '_YEARLY' : ''}`;
    throw new Error(`Missing Stripe price id — set ${envVar}`);
  }
  return priceId;
}

/** Which tier (and billing interval) a Stripe price id belongs to. */
export function planForPriceId(priceId: string): { tier: PaidTier; interval: BillingInterval } | null {
  for (const tier of PAID_TIERS) {
    for (const interval of ['month', 'year'] as const) {
      if (PRICE_ENV[tier][interval] === priceId) return { tier, interval };
    }
  }
  return null;
}

export function tierForPriceId(priceId: string): SubscriptionTier | null {
  return planForPriceId(priceId)?.tier ?? null;
}

// Our prices carry lookup keys like "landethic_steward_yearly_2026" (scripts/stripe-setup.ts),
// so a price is still recognised after its id changes (new prices, test → live).
const LOOKUP_KEY = /^landethic_(steward|naturalist|conservationist)_(monthly|yearly)(?:_|$)/;

/** Which plan a Stripe price belongs to — by id first, then by its lookup key. */
export function planForPrice(price: { id: string; lookup_key?: string | null }): { tier: PaidTier; interval: BillingInterval } | null {
  const byId = planForPriceId(price.id);
  if (byId) return byId;
  const m = price.lookup_key ? LOOKUP_KEY.exec(price.lookup_key) : null;
  return m ? { tier: m[1] as PaidTier, interval: m[2] === 'yearly' ? 'year' : 'month' } : null;
}
