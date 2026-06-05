import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import type { SubscriptionTier } from '@/types';

const VALID_TIERS: SubscriptionTier[] = ['free', 'steward', 'naturalist', 'conservationist'];

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json() as { tier: SubscriptionTier };
  if (!VALID_TIERS.includes(body.tier)) {
    return NextResponse.json({ error: 'Invalid tier' }, { status: 400 });
  }

  const client = await clerkClient();
  await client.users.updateUserMetadata(userId, {
    publicMetadata: { tier: body.tier },
  });

  return NextResponse.json({ ok: true, tier: body.tier });
}
