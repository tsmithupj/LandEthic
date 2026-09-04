import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStripe, priceIdForTier, PAID_TIERS, type PaidTier } from '@/lib/stripe';
import { getSubscriptionByClerkId, upsertSubscription } from '@/lib/db/subscriptions';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as { tier: PaidTier };
  if (!PAID_TIERS.includes(body.tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const existing = await getSubscriptionByClerkId(userId);
  if (existing?.stripeSubscriptionId && (existing.status === 'active' || existing.status === 'trialing')) {
    return NextResponse.json({ error: 'Already subscribed — use plan switch instead' }, { status: 409 });
  }

  const stripe = getStripe();
  let customerId = existing?.stripeCustomerId ?? null;
  if (!customerId) {
    const customer = await stripe.customers.create({ metadata: { clerkUserId: userId } });
    customerId = customer.id;
    await upsertSubscription({ clerkUserId: userId, stripeCustomerId: customerId });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceIdForTier(body.tier), quantity: 1 }],
    subscription_data: {
      trial_period_days: 14,
      metadata: { clerkUserId: userId },
    },
    success_url: `${appUrl}/upgrade?checkout=success`,
    cancel_url: `${appUrl}/upgrade?checkout=cancelled`,
    metadata: { clerkUserId: userId, tier: body.tier },
  });

  return NextResponse.json({ url: session.url });
}
