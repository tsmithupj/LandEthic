import Stripe from 'stripe';
import { clerkClient } from '@clerk/nextjs/server';
import { getStripe, planForPrice, type PaidTier } from '@/lib/stripe';
import { getSubscriptionByClerkId, getSubscriptionByStripeCustomerId, upsertSubscription } from '@/lib/db/subscriptions';
import type { SubscriptionTier } from '@/types';

// Turning Stripe subscriptions into a member's plan (tier). Used by the Stripe
// webhook and by the "just paid" sync on the dashboard, so both always agree.

/**
 * Statuses where the member keeps their paid plan. `past_due` is included on
 * purpose: Stripe is still retrying the card, and locking (or deleting) a paying
 * member's land data because one renewal bounced would be wrong. If every retry
 * fails, Stripe cancels the subscription and the normal lock clock starts.
 */
export const PAYING_STATUSES = new Set(['active', 'trialing', 'past_due']);

export function isPayingStatus(status: string | null | undefined): boolean {
  return !!status && PAYING_STATUSES.has(status);
}

/** Write the member's plan into Clerk (what the app reads as their tier). */
export async function setMemberTier(clerkUserId: string, tier: SubscriptionTier) {
  const client = await clerkClient();
  try {
    await client.users.updateUserMetadata(clerkUserId, { publicMetadata: { tier } });
  } catch (err) {
    // The sign-in account was deleted — nothing to update (the cleanup job stops their billing)
    if ((err as { status?: number })?.status === 404) {
      console.warn('[billing] account no longer exists, skipping plan update', clerkUserId);
      return;
    }
    throw err;
  }
}

/**
 * Which plan a subscription gives. Never drops a paying member to Free just
 * because their price isn't one we recognise (e.g. an older price kept for
 * existing members after a price change) — keeps their previous paid plan, or
 * the first paid plan, and logs it so it can be fixed.
 */
export function tierForSubscription(subscription: Stripe.Subscription, previousTier?: SubscriptionTier | null): SubscriptionTier {
  if (!isPayingStatus(subscription.status)) return 'free';
  const price = subscription.items.data[0]?.price;
  const mapped = price ? planForPrice(price)?.tier : null;
  if (mapped) return mapped;
  const fallback: PaidTier = previousTier && previousTier !== 'free' ? previousTier : 'steward';
  console.error('[billing] unrecognised price on a paying subscription — keeping', fallback, price?.id);
  return fallback;
}

/** Save a subscription for a member and update their plan. Returns the plan. */
export async function applySubscription(clerkUserId: string, subscription: Stripe.Subscription): Promise<SubscriptionTier> {
  const existing = await getSubscriptionByClerkId(clerkUserId);
  const tier = tierForSubscription(subscription, existing?.tier);
  const item = subscription.items.data[0];
  await upsertSubscription({
    clerkUserId,
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    stripePriceId: item?.price.id ?? null,
    tier,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: item?.current_period_end ? new Date(item.current_period_end * 1000) : null,
  });
  await setMemberTier(clerkUserId, tier);
  return tier;
}

/**
 * A Checkout just finished: apply its subscription. If the member somehow ended up
 * with two (e.g. paid in two tabs), keep the new one and cancel the older one with a
 * prorated credit so they're never billed twice. Safe to run more than once — the
 * webhook and the dashboard sync both call it, whichever runs first does the work.
 */
export async function applyCheckoutSubscription(clerkUserId: string, subscription: Stripe.Subscription): Promise<SubscriptionTier> {
  const before = await getSubscriptionByClerkId(clerkUserId);
  const tier = await applySubscription(clerkUserId, subscription);
  const older = before?.stripeSubscriptionId;
  if (older && older !== subscription.id && isPayingStatus(before?.status)) {
    console.error('[billing] member had two subscriptions — cancelling the older one', older);
    await getStripe().subscriptions.cancel(older, { prorate: true }).catch((err) =>
      console.error('[billing] could not cancel duplicate subscription', older, err instanceof Error ? err.message : err),
    );
  }
  return tier;
}

/** Find the member a Stripe subscription belongs to. */
export async function memberForSubscription(subscription: Stripe.Subscription) {
  const row = await getSubscriptionByStripeCustomerId(subscription.customer as string);
  const clerkUserId = row?.clerkUserId ?? (subscription.metadata?.clerkUserId as string | undefined) ?? null;
  return { row, clerkUserId };
}

/**
 * True when an event is about some other subscription than the member's current,
 * paying one (e.g. a duplicate that was cancelled) — those must not change their plan.
 */
export function isStaleSubscriptionEvent(
  row: { stripeSubscriptionId: string | null; status: string | null } | null,
  subscription: Stripe.Subscription,
): boolean {
  return !!row?.stripeSubscriptionId
    && row.stripeSubscriptionId !== subscription.id
    && isPayingStatus(row.status)
    && !isPayingStatus(subscription.status);
}

/**
 * Right after Checkout: read the finished Checkout session and apply it straight
 * away, so the member doesn't have to wait for the webhook to see their new plan.
 * Returns null if the session isn't this member's or isn't paid yet.
 */
export async function syncCheckoutSession(clerkUserId: string, sessionId: string): Promise<SubscriptionTier | null> {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.metadata?.clerkUserId !== clerkUserId) return null;
  if (session.mode !== 'subscription' || session.status !== 'complete' || !session.subscription) return null;
  const subscription = await stripe.subscriptions.retrieve(
    typeof session.subscription === 'string' ? session.subscription : session.subscription.id,
  );
  return applyCheckoutSubscription(clerkUserId, subscription);
}
