import type { SubscriptionTier } from '@/types';

// Shared tier rules — safe to import from both client and server code.

export const TIER_ORDER: SubscriptionTier[] = ['free', 'steward', 'naturalist', 'conservationist'];

export const TIER_PROPERTY_LIMITS: Record<SubscriptionTier, number> = {
  free:            1,
  steward:         1,
  naturalist:      3,
  conservationist: 10,
};

export function isTier(value: unknown): value is SubscriptionTier {
  return typeof value === 'string' && (TIER_ORDER as string[]).includes(value);
}

/** True when `tier` is the same as or higher than `minimum`. */
export function tierAtLeast(tier: SubscriptionTier, minimum: SubscriptionTier): boolean {
  return TIER_ORDER.indexOf(tier) >= TIER_ORDER.indexOf(minimum);
}
