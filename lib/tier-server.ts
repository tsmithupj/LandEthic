import { currentUser } from '@clerk/nextjs/server';
import { count, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { properties } from '@/lib/db/schema';
import { isTier, TIER_PROPERTY_LIMITS } from '@/lib/tiers';
import type { SubscriptionTier } from '@/types';

/**
 * The signed-in user's tier, read server-side from Clerk publicMetadata.
 *
 * publicMetadata can only be written from the backend (the Stripe webhook and the
 * dev-only /api/set-tier route), so unlike a `tier` field in a request body it
 * can't be forged by the browser. Never trust a client-supplied tier.
 */
export async function getUserTier(): Promise<SubscriptionTier> {
  const user = await currentUser();
  const tier = user?.publicMetadata?.tier;
  return isTier(tier) ? tier : 'free';
}

/** How many properties this user has saved, and whether their tier allows another. */
export async function getPropertyAllowance(clerkUserId: string, tier: SubscriptionTier) {
  const [row] = await getDb()
    .select({ n: count() })
    .from(properties)
    .where(eq(properties.clerkUserId, clerkUserId));
  const used = Number(row?.n ?? 0);
  const limit = TIER_PROPERTY_LIMITS[tier];
  return { used, limit, canAdd: used < limit };
}
