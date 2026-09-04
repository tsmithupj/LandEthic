import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStripe, priceIdForTier, PAID_TIERS, type PaidTier } from '@/lib/stripe';
import { getSubscriptionByClerkId, upsertSubscription } from '@/lib/db/subscriptions';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await getSubscriptionByClerkId(userId);
  if (!row) {
    return NextResponse.json({ status: null, cancelAtPeriodEnd: false, currentPeriodEnd: null });
  }

  return NextResponse.json({
    status: row.status,
    cancelAtPeriodEnd: row.cancelAtPeriodEnd,
    currentPeriodEnd: row.currentPeriodEnd,
  });
}

export async function PATCH(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { tier: PaidTier };
  if (!PAID_TIERS.includes(body.tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const row = await getSubscriptionByClerkId(userId);
  if (!row?.stripeSubscriptionId) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 404 });
  }

  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(row.stripeSubscriptionId);
  const currentItem = subscription.items.data[0];

  await stripe.subscriptions.update(row.stripeSubscriptionId, {
    items: [{ id: currentItem.id, price: priceIdForTier(body.tier) }],
    proration_behavior: 'create_prorations',
    cancel_at_period_end: false,
  });

  await upsertSubscription({
    clerkUserId: userId,
    tier: body.tier,
    stripePriceId: priceIdForTier(body.tier),
    cancelAtPeriodEnd: false,
  });

  return NextResponse.json({ ok: true });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await getSubscriptionByClerkId(userId);
  if (!row?.stripeSubscriptionId) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 404 });
  }

  const subscription = await getStripe().subscriptions.update(row.stripeSubscriptionId, {
    cancel_at_period_end: true,
  });

  const currentPeriodEnd = new Date(subscription.items.data[0].current_period_end * 1000);
  await upsertSubscription({ clerkUserId: userId, cancelAtPeriodEnd: true, currentPeriodEnd });

  return NextResponse.json({ ok: true, currentPeriodEnd });
}

export async function PUT() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await getSubscriptionByClerkId(userId);
  if (!row?.stripeSubscriptionId) {
    return NextResponse.json({ error: 'No active subscription' }, { status: 404 });
  }

  await getStripe().subscriptions.update(row.stripeSubscriptionId, { cancel_at_period_end: false });
  await upsertSubscription({ clerkUserId: userId, cancelAtPeriodEnd: false });

  return NextResponse.json({ ok: true });
}
