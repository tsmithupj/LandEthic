import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getUserTier } from '@/lib/tier-server';
import { getAccess } from '@/lib/access';

// The signed-in member's free-plan countdown / lock state, for the dashboard banner.
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tier = await getUserTier();
  return NextResponse.json(await getAccess(userId, tier));
}
