import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getStripe } from '@/lib/stripe';
import { getSubscriptionByClerkId } from '@/lib/db/subscriptions';

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const row = await getSubscriptionByClerkId(userId);
  if (!row?.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing account' }, { status: 404 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? req.nextUrl.origin;
  const session = await getStripe().billingPortal.sessions.create({
    customer: row.stripeCustomerId,
    return_url: `${appUrl}/upgrade?portal=return`,
  });

  return NextResponse.json({ url: session.url });
}
