import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserTier } from '@/lib/tier-server';
import { getAccess } from '@/lib/access';
import { getSubscriptionByClerkId } from '@/lib/db/subscriptions';

// The signed-in member's free-plan countdown / lock state, for the dashboard banner.
// Paying members also get `paymentIssue` when a renewal payment is failing.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tier = await getUserTier();
  const access = await getAccess(userId, tier);

  let paymentIssue = false;
  if (tier !== 'free') {
    try {
      paymentIssue = (await getSubscriptionByClerkId(userId))?.status === 'past_due';
    } catch {
      // not worth failing the page over
    }
  }
  return NextResponse.json({ ...access, paymentIssue });
}
