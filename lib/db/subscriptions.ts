import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { subscriptions } from './schema';
import type { SubscriptionTier } from '@/types';

export async function getSubscriptionByClerkId(clerkUserId: string) {
  const [row] = await getDb().select().from(subscriptions).where(eq(subscriptions.clerkUserId, clerkUserId));
  return row ?? null;
}

export async function getSubscriptionByStripeCustomerId(stripeCustomerId: string) {
  const [row] = await getDb()
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.stripeCustomerId, stripeCustomerId));
  return row ?? null;
}

interface UpsertSubscriptionInput {
  clerkUserId: string;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  stripePriceId?: string | null;
  tier?: SubscriptionTier;
  status?: string | null;
  cancelAtPeriodEnd?: boolean;
  currentPeriodEnd?: Date | null;
}

export async function upsertSubscription(row: UpsertSubscriptionInput) {
  const { clerkUserId, ...rest } = row;
  await getDb()
    .insert(subscriptions)
    .values({ clerkUserId, ...rest })
    .onConflictDoUpdate({
      target: subscriptions.clerkUserId,
      set: { ...rest, updatedAt: new Date() },
    });
}
