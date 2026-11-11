import { clerkClient, currentUser } from '@clerk/nextjs/server';
import { getSubscriptionByClerkId } from '@/lib/db/subscriptions';
import { computeAccess, type AccessState } from '@/lib/access-rules';
import type { SubscriptionTier } from '@/types';

export type { AccessState };

/** When a cancelled paid plan's access ended (null if they never paid or are still paying). */
export async function paidAccessEndedAt(clerkUserId: string): Promise<Date | null> {
  try {
    const sub = await getSubscriptionByClerkId(clerkUserId);
    return sub?.status === 'canceled' && sub.currentPeriodEnd ? sub.currentPeriodEnd : null;
  } catch {
    return null;
  }
}

/**
 * The member's free-plan / lock state (server-side).
 * `tier` should come from getUserTier() — never from the browser.
 */
export async function getAccess(clerkUserId: string, tier: SubscriptionTier): Promise<AccessState> {
  if (tier !== 'free') return computeAccess({ tier, accountCreatedAt: new Date() });

  let createdAt: number | null = null;
  try {
    const me = await currentUser();
    if (me?.id === clerkUserId) createdAt = me.createdAt;
    else createdAt = (await (await clerkClient()).users.getUser(clerkUserId)).createdAt;
  } catch {
    // Can't reach Clerk — don't lock anyone out because of it
    return { tier, locked: false, endsAt: null, deleteAt: null, daysLeft: null };
  }

  return computeAccess({
    tier,
    accountCreatedAt: new Date(createdAt ?? Date.now()),
    paidAccessEndedAt: await paidAccessEndedAt(clerkUserId),
  });
}
