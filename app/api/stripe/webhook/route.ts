import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { getStripe } from '@/lib/stripe';
import { upsertSubscription } from '@/lib/db/subscriptions';
import {
  applyCheckoutSubscription, applySubscription, isStaleSubscriptionEvent, memberForSubscription, setMemberTier,
} from '@/lib/billing';

async function handleSubscriptionChange(subscription: Stripe.Subscription) {
  const { row, clerkUserId } = await memberForSubscription(subscription);
  if (!clerkUserId) {
    console.error('Stripe webhook: could not resolve clerkUserId for customer', subscription.customer);
    return;
  }
  if (isStaleSubscriptionEvent(row, subscription)) {
    console.warn('Stripe webhook: ignoring update for a non-current subscription', subscription.id);
    return;
  }
  await applySubscription(clerkUserId, subscription);
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription) {
  const { row, clerkUserId } = await memberForSubscription(subscription);
  if (!clerkUserId) {
    console.error('Stripe webhook: could not resolve clerkUserId for customer', subscription.customer);
    return;
  }
  // A different subscription (e.g. a cancelled duplicate) ending must not end the member's plan
  if (row?.stripeSubscriptionId && row.stripeSubscriptionId !== subscription.id) {
    console.warn('Stripe webhook: ignoring deletion of a non-current subscription', subscription.id);
    return;
  }

  // Paid access ended now (or at period end) — the lock clock starts from here
  const endedAt = subscription.ended_at ?? subscription.items.data[0]?.current_period_end;
  await upsertSubscription({
    clerkUserId,
    stripeSubscriptionId: null,
    tier: 'free',
    status: 'canceled',
    cancelAtPeriodEnd: false,
    ...(endedAt ? { currentPeriodEnd: new Date(endedAt * 1000) } : {}),
  });

  await setMemberTier(clerkUserId, 'free');
}

export async function POST(req: NextRequest) {
  const rawBody = await req.text();
  const signature = req.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Webhook signature verification failed: ${msg}` }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object;
      const clerkUserId = session.metadata?.clerkUserId;
      if (session.mode === 'subscription' && session.subscription && clerkUserId) {
        const subscription = await getStripe().subscriptions.retrieve(session.subscription as string);
        await applyCheckoutSubscription(clerkUserId, subscription);
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
