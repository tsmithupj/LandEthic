import { NextRequest, NextResponse } from 'next/server';
import { clerkClient } from '@clerk/nextjs/server';
import { eq, isNotNull, lt } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { aiUsage, properties, speciesIds, subscriptions } from '@/lib/db/schema';
import { computeAccess } from '@/lib/access-rules';
import { paidAccessEndedAt } from '@/lib/access';
import { isPayingStatus } from '@/lib/billing';
import { getStripe } from '@/lib/stripe';
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
//  3. If a member deleted their sign-in account, deletes their land data and
//     stops any subscription they still had, so nobody is billed for an account
//     that no longer exists.
//
// When in doubt it does nothing: any error reading a member skips them until tomorrow.
export const maxDuration = 300;

const MAX_MEMBERS_PER_RUN = 5000;
const CLERK_PAGE = 100;

type Member = { tier: SubscriptionTier; createdAt: Date };

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: 'CRON_SECRET is not set' }, { status: 500 });
  if (req.headers.get('authorization') !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  const now = new Date();

  await db.delete(aiUsage).where(lt(aiUsage.createdAt, new Date(now.getTime() - 35 * 24 * 60 * 60 * 1000)));

  // Everyone who has land data stored or a subscription on file
  const owners = new Set<string>();
  for (const r of await db.selectDistinct({ id: properties.clerkUserId }).from(properties)) owners.add(r.id);
  for (const r of await db.selectDistinct({ id: speciesIds.clerkUserId }).from(speciesIds)) owners.add(r.id);
  for (const r of await db.select({ id: subscriptions.clerkUserId }).from(subscriptions).where(isNotNull(subscriptions.stripeSubscriptionId))) owners.add(r.id);
  const ids = Array.from(owners).slice(0, MAX_MEMBERS_PER_RUN);

  // Look members up in Clerk 100 at a time. A page that fails is skipped (unknown ≠ gone).
  const clerk = await clerkClient();
  const found = new Map<string, Member>();
  const unknown = new Set<string>();
  for (let i = 0; i < ids.length; i += CLERK_PAGE) {
    const page = ids.slice(i, i + CLERK_PAGE);
    try {
      const res = await clerk.users.getUserList({ userId: page, limit: CLERK_PAGE });
      for (const u of res.data) {
        const t = u.publicMetadata?.tier;
        found.set(u.id, { tier: isTier(t) ? t : 'free', createdAt: new Date(u.createdAt) });
      }
    } catch {
      page.forEach((id) => unknown.add(id));
    }
  }

  let deleted = 0;
  let stopped = 0;
  for (const clerkUserId of ids) {
    if (unknown.has(clerkUserId)) continue;
    try {
      const member = found.get(clerkUserId);

      if (!member) {
        // Not in the list — make sure the account is really gone before acting
        if (!(await accountIsGone(clerk, clerkUserId))) continue;
        if (await stopSubscription(clerkUserId)) stopped++;
      } else {
        const access = computeAccess({
          tier: member.tier,
          accountCreatedAt: member.createdAt,
          paidAccessEndedAt: await paidAccessEndedAt(clerkUserId, { strict: true }),
          now,
        });
        if (!access.locked || !access.deleteAt || now < new Date(access.deleteAt)) continue;
      }

      await db.batch([
        db.delete(speciesIds).where(eq(speciesIds.clerkUserId, clerkUserId)),
        db.delete(properties).where(eq(properties.clerkUserId, clerkUserId)), // plans, tasks, habitat plans cascade
        db.delete(aiUsage).where(eq(aiUsage.clerkUserId, clerkUserId)),
      ]);
      deleted++;
    } catch (err) {
      console.warn('[cleanup] skipped a member:', err instanceof Error ? err.message : err);
    }
  }

  console.log(`[cleanup] checked ${ids.length} members, deleted land data for ${deleted}, stopped ${stopped} orphaned subscriptions`);
  return NextResponse.json({ checked: ids.length, deleted, stopped });
}

async function accountIsGone(clerk: Awaited<ReturnType<typeof clerkClient>>, clerkUserId: string): Promise<boolean> {
  try {
    await clerk.users.getUser(clerkUserId);
    return false;
  } catch (err) {
    return (err as { status?: number })?.status === 404;
  }
}

/** Cancel the subscription of a member whose account no longer exists. */
async function stopSubscription(clerkUserId: string): Promise<boolean> {
  const db = getDb();
  const [row] = await db.select().from(subscriptions).where(eq(subscriptions.clerkUserId, clerkUserId));
  if (!row?.stripeSubscriptionId || !isPayingStatus(row.status)) return false;
  await getStripe().subscriptions.cancel(row.stripeSubscriptionId);
  await db
    .update(subscriptions)
    .set({ stripeSubscriptionId: null, status: 'canceled', tier: 'free', updatedAt: new Date() })
    .where(eq(subscriptions.clerkUserId, clerkUserId));
  console.warn('[cleanup] stopped the subscription of a deleted account', row.stripeSubscriptionId);
  return true;
}
