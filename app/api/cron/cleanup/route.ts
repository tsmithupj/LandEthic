import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { eq, lt } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { aiUsage, properties, speciesIds } from '@/lib/db/schema';
import { computeAccess } from '@/lib/access-rules';
import { paidAccessEndedAt } from '@/lib/access';
import { isTier } from '@/lib/tiers';
import type { SubscriptionTier } from '@/types';

// Daily cleanup (Vercel Cron — see vercel.json). Protected by CRON_SECRET:
// Vercel sends "Authorization: Bearer <CRON_SECRET>" with every cron request.
//
//  1. Deletes AI usage rows older than the 30-day allowance window.
//  2. Deletes the land data of members whose free plan (or cancelled paid plan)
//     ended more than 30 days ago — properties (with their plans, tasks, and
//     food plot / nest box plans) and photo identifications. Their sign-in
//     account stays so they can start again.
export const maxDuration = 300;

const MAX_USERS_PER_RUN = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();

  await db.delete(aiUsage).where(lt(aiUsage.createdAt, new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000)));

  // Everyone who has land data stored
  const owners = new Set<string>();
  for (const r of await db.selectDistinct({ id: properties.clerkUserId }).from(properties)) owners.add(r.id);
  for (const r of await db.selectDistinct({ id: speciesIds.clerkUserId }).from(speciesIds)) owners.add(r.id);

  const clerk = await clerkClient();
  const deletedFor: string[] = [];
  let checked = 0;

  for (const clerkUserId of Array.from(owners).slice(0, MAX_USERS_PER_RUN)) {
    checked++;
    let accountGone = false;
    let tier: SubscriptionTier = 'free';
    let createdAt = now;
    try {
      const user = await clerk.users.getUser(clerkUserId);
      const t = user.publicMetadata?.tier;
      tier = isTier(t) ? t : 'free';
      createdAt = new Date(user.createdAt);
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 404) accountGone = true; // sign-in account was deleted — its data has no owner
      else continue;                          // Clerk hiccup — try again tomorrow
    }

    if (!accountGone) {
      const access = computeAccess({ tier, accountCreatedAt: createdAt, paidAccessEndedAt: await paidAccessEndedAt(clerkUserId), now });
      if (!access.locked || !access.deleteAt || now < new Date(access.deleteAt)) continue;
    }

    await db.batch([
      db.delete(speciesIds).where(eq(speciesIds.clerkUserId, clerkUserId)),
      db.delete(properties).where(eq(properties.clerkUserId, clerkUserId)), // plans, tasks, habitat plans cascade
      db.delete(aiUsage).where(eq(aiUsage.clerkUserId, clerkUserId)),
    ]);
    deletedFor.push(clerkUserId);
  }

  console.log(`[cleanup] checked ${checked} members, deleted land data for ${deletedFor.length}`);
  return NextResponse.json({ checked, deleted: deletedFor.length });
}
