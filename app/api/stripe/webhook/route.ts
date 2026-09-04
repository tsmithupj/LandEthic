import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import Stripe from 'stripe';
import { getStripe, tierForPriceId } from '@/lib/stripe';
import { getSubscriptionByStripeCustomerId, upsertSubscription } from '@/lib/db/subscriptions';
import type { SubscriptionTier } from '@/types';

async function setTier(clerkUserId: string, tier: SubscriptionTier) {
  const client = await clerkClient();
  await client.users.updateUserMetadata(clerkUserId, { publicMetadata: { tier } });
}

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const row = await getSubscriptionByStripeCustomerId(subscription.customer as string);
  const clerkUserId = row?.clerkUserId ?? (subscription.metadata?.clerkUserId as string | undefined);
  if (!clerkUserId) {
    console.error('Stripe webhook: could not resolve clerkUserId for customer', subscription.customer);
    return;
  }

  const item = subscription.items.data[0];
  const isActive = subscription.status === 'active' || subscription.status === 'trialing';
  let tier: SubscriptionTier = 'free';
  if (isActive) {
    tier = tierForPriceId(item.price.id) ?? 'free';
    if (tier === 'free') {
      console.error('Stripe webhook: unmapped price id, defaulting to free', item.price.id);
    }
  }

  await upsertSubscription({
    clerkUserId,
    stripeCustomerId: subscription.customer as string,
    stripeSubscriptionId: subscription.id,
    stripePriceId: item.price.id,
    tier,
    status: subscription.status,
    cancelAtPeriodEnd: subscription.cancel_at_period_end,
    currentPeriodEnd: new Date(item.current_period_end * 1000),
  });

  await setTier(clerkUserId, tier);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const row = await getSubscriptionByStripeCustomerId(subscription.customer as string);
  const clerkUserId = row?.clerkUserId ?? (subscription.metadata?.clerkUserId as string | undefined);
  if (!clerkUserId) {
    console.error('Stripe webhook: could not resolve clerkUserId for customer', subscription.customer);
    return;
  }

  await upsertSubscription({
    clerkUserId,
    stripeSubscriptionId: null,
    tier: 'free',
    status: 'canceled',
    cancelAtPeriodEnd: false,
  });

  await setTier(clerkUserId, 'free');
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature!, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Webhook signature verification failed: ${msg}` }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      if (session.mode === 'subscription' && session.subscription) {
        const subscription = await getStripe().subscriptions.retrieve(session.subscription as string);
        const clerkUserId = session.metadata?.clerkUserId;
        if (clerkUserId) {
          const item = subscription.items.data[0];
          const tier = tierForPriceId(item.price.id) ?? 'free';
          await upsertSubscription({
            clerkUserId,
            stripeCustomerId: subscription.customer as string,
            stripeSubscriptionId: subscription.id,
            stripePriceId: item.price.id,
            tier,
            status: subscription.status,
            cancelAtPeriodEnd: false,
            currentPeriodEnd: new Date(item.current_period_end * 1000),
          });
          await setTier(clerkUserId, tier);
        }
      }
      break;
    }
    case 'customer.subscription.updated': {
      await handleSubscriptionChange(event.data.object);
      break;
    }
    case 'customer.subscription.deleted': {
      await handleSubscriptionDeleted(event.data.object);
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
