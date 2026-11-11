import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { getStripe, isInterval, priceIdForTier, PAID_TIERS, type BillingInterval, type PaidTier } from '@/lib/stripe';
import { getSubscriptionByClerkId, upsertSubscription } from '@/lib/db/subscriptions';
import { isPayingStatus } from '@/lib/billing';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as { tier?: PaidTier; interval?: BillingInterval };
  if (!body.tier || !PAID_TIERS.includes(body.tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }
  const interval: BillingInterval = isInterval(body.interval) ? body.interval : 'year';

  // Already on a plan (including one whose last payment is being retried) —
  // they switch plans or fix their card instead of starting a second subscription.
  const existing = await getSubscriptionByClerkId(userId);
  if (existing?.stripeSubscriptionId && isPayingStatus(existing.status)) {
    return NextResponse.json({ error: 'Already subscribed — use plan switch instead' }, { status: 409 });
  }

  const stripe = getStripe();
  let customerId = existing?.stripeCustomerId ?? null;
  if (!customerId) {
    // Email + name so Stripe receipts and the billing page know who this is
    const me = await currentUser().catch(() => null);
    const customer = await stripe.customers.create({
      email: me?.primaryEmailAddress?.emailAddress ?? undefined,
      name: me?.fullName ?? undefined,
      metadata: { clerkUserId: userId },
    });
    customerId = customer.id;
    await upsertSubscription({ clerkUserId: userId, stripeCustomerId: customerId });
  } else {
    // Close any checkout this member left open (another tab, an earlier tap) so only
    // the newest one can be paid — never two subscriptions for one member.
    const open = await stripe.checkout.sessions.list({ customer: customerId, status: 'open', limit: 10 }).catch(() => null);
    await Promise.all((open?.data ?? []).map((s) => stripe.checkout.sessions.expire(s.id).catch(() => null)));
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: priceIdForTier(body.tier, interval), quantity: 1 }],
    // No paid trial — every account already gets the free 7-day plan first.
    subscription_data: {
      metadata: { clerkUserId: userId },
    },
    allow_promotion_codes: true,
    // session_id lets the dashboard apply the new plan right away (/api/stripe/sync)
    success_url: `${appUrl}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}/upgrade?checkout=cancelled`,
    metadata: { clerkUserId: userId, tier: body.tier, interval },
  });

  return NextResponse.json({ url: session.url });
}
