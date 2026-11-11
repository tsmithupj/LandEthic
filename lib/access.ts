import { clerkClient, currentUser } from '@clerk/nextjs/server';
import { getSubscriptionByClerkId } from '@/lib/db/subscriptions';
import { computeAccess, paidAccessEndFromSubscription, type AccessState } from '@/lib/access-rules';
import type { SubscriptionTier } from '@/types';

export type { AccessState };

/**
 * When a member's paid plan ended (null if they never paid or are still paying).
 * `strict` throws on a database error instead of returning null — the cleanup job
 * uses it so a hiccup can never make a past subscriber look like a never-paid one.
 */
export async function paidAccessEndedAt(clerkUserId: string, opts: { strict?: boolean } = {}): Promise<Date | null> {
  try {
    return paidAccessEndFromSubscription(await getSubscriptionByClerkId(clerkUserId));
  } catch (err) {
    if (opts.strict) throw err;
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
