import { NextResponse } from 'next/server';
import { and, asc, count, desc, eq, gte, sql } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { aiUsage } from '@/lib/db/schema';
import { getAccess } from '@/lib/access';
import type { SubscriptionTier } from '@/types';

/**
 * Monthly allowances on the AI features.
 *
 * Every AI request is logged to the `ai_usage` table. Before a new request we
 * count that member's uses of the same feature over the last 30 days and
 * refuse with a friendly 429 (saying when the next one opens up) once they have
 * used their plan's allowance. If the AI call then fails, the route calls
 * `releaseAiUsage` so a failed attempt doesn't use up the allowance.
 *
 * Allowances come from the pricing analysis (claude/LandEthic-Pricing-Analysis.md):
 * they cap what one member can cost us in a month at roughly 50% of the yearly price.
 *
 * Also blocks every AI feature once a free plan (or a cancelled paid plan) has
 * ended — see lib/access.ts.
 *
 * Fails OPEN on database errors: a missing table must never take the app down.
 */

export type AiRoute =
  | 'analyze-property'   // set up a new property (first analysis)
  | 'refresh-insights'   // re-run the analysis for an existing property
  | 'generate-plan'      // first plan for a new property
  | 'rebuild-plan'       // rebuild ("restructure") an existing property's plan
  | 'plan-upgrade'       // expand a plan after moving up to a bigger membership (keeps finished tasks)
  | 'monthly-update'
  | 'habitat-plan'
  | 'replace-task'
  | 'task-chat'
  | 'identify-species';

export const ALLOWANCE_DAYS = 30;

/** Uses allowed per member, per feature, in any 30-day window. */
export const MONTHLY_ALLOWANCES: Record<AiRoute, Record<SubscriptionTier, number>> = {
  //                    free  steward  naturalist  conservationist
  'analyze-property': { free: 2,  steward: 1,  naturalist: 3,  conservationist: 5 },
  'generate-plan':    { free: 2,  steward: 1,  naturalist: 3,  conservationist: 5 },
  'refresh-insights': { free: 0,  steward: 1,  naturalist: 2,  conservationist: 3 },
  'rebuild-plan':     { free: 0,  steward: 1,  naturalist: 2,  conservationist: 3 },
  // Free with the upgrade — separate from rebuilds; only possible when the plan is below the membership
  'plan-upgrade':     { free: 0,  steward: 1,  naturalist: 1,  conservationist: 1 },
  'monthly-update':   { free: 0,  steward: 0,  naturalist: 3,  conservationist: 5 },
  'habitat-plan':     { free: 0,  steward: 0,  naturalist: 0,  conservationist: 2 },
  'replace-task':     { free: 0,  steward: 5,  naturalist: 10, conservationist: 15 },
  'identify-species': { free: 3,  steward: 20, naturalist: 30, conservationist: 60 },
  'task-chat':        { free: 15, steward: 25, naturalist: 40, conservationist: 60 },
};

const ACTION_LABEL: Record<AiRoute, [one: string, many: string]> = {
  'analyze-property': ['new property setup', 'new property setups'],
  'refresh-insights': ['insight update', 'insight updates'],
  'generate-plan':    ['new plan', 'new plans'],
  'rebuild-plan':     ['plan rebuild', 'plan rebuilds'],
  'plan-upgrade':     ['plan upgrade', 'plan upgrades'],
  'monthly-update':   ['monthly update', 'monthly updates'],
  'habitat-plan':     ['food plot and nest box plan', 'food plot and nest box plans'],
  'replace-task':     ['task swap', 'task swaps'],
  'task-chat':        ['task question', 'task questions'],
  'identify-species': ['photo ID', 'photo IDs'],
};

const TIER_NAME: Record<SubscriptionTier, string> = {
  free: 'Free',
  steward: 'Steward',
  naturalist: 'Naturalist',
  conservationist: 'Conservationist',
};

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_MS = ALLOWANCE_DAYS * DAY_MS;

function formatDay(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
}

/** The friendly "you've used your allowance" message. */
export function allowanceMessage(route: AiRoute, tier: SubscriptionTier, limit: number, nextOpens: Date | null): string {
  const [one, many] = ACTION_LABEL[route];
  if (limit === 0) {
    return tier === 'free'
      ? `${many.charAt(0).toUpperCase() + many.slice(1)} are part of the paid plans. Pick a plan to unlock them.`
      : `${many.charAt(0).toUpperCase() + many.slice(1)} aren't included in the ${TIER_NAME[tier]} plan. Upgrade to unlock them.`;
  }
  const used = `You've used ${limit === 1 ? `this month's ${one}` : `all ${limit} of this month's ${many}`} on the ${TIER_NAME[tier]} plan.`;
  const next = nextOpens ? ` Your next one opens up on ${formatDay(nextOpens)}.` : '';
  const upgrade = tier === 'conservationist' ? '' : ' Upgrading your plan gives you more.';
  return `${used}${next}${upgrade}`;
}

/**
 * Check (and record) one AI request. Returns `null` when it may go ahead, or a
 * ready-to-return response: 402 when the account is locked, 429 when the
 * member has used their allowance.
 */
export async function enforceAiLimit(
  clerkUserId: string,
  route: AiRoute,
  tier: SubscriptionTier,
): Promise<NextResponse | null> {
  // Free plan (or a cancelled plan) has ended → nothing AI until they pick a plan
  const access = await getAccess(clerkUserId, tier);
  if (access.locked) {
    return NextResponse.json(
      { error: 'Your free plan has ended. Pick a plan to keep building on your land.', locked: true },
      { status: 402 },
    );
  }

  const limit = MONTHLY_ALLOWANCES[route][tier];
  if (limit === 0) {
    return NextResponse.json(
      { error: allowanceMessage(route, tier, 0, null), limit, used: 0 },
      { status: tier === 'free' ? 402 : 403 },
    );
  }

  try {
    const db = getDb();
    const since = new Date(Date.now() - WINDOW_MS);
    const where = and(
      eq(aiUsage.clerkUserId, clerkUserId),
      eq(aiUsage.route, route),
      gte(aiUsage.createdAt, since),
    );

    // Record this use first, then count the uses that came before it. Two requests
    // sent at the same moment can't both squeeze into the last spot this way.
    const [mine] = await db.insert(aiUsage).values({ clerkUserId, route }).returning({ id: aiUsage.id });
    const [row] = await db
      .select({ n: count() })
      .from(aiUsage)
      .where(and(
        where,
        sql`(${aiUsage.createdAt}, ${aiUsage.id}) < (select created_at, id from ai_usage where id = ${mine.id})`,
      ));
    const used = Number(row?.n ?? 0);

    if (used >= limit) {
      await db.delete(aiUsage).where(eq(aiUsage.id, mine.id));
      // The oldest use in the window is the next one to expire
      const [oldest] = await db
        .select({ createdAt: aiUsage.createdAt })
        .from(aiUsage)
        .where(where)
        .orderBy(asc(aiUsage.createdAt))
        .limit(1);
      const nextOpens = oldest ? new Date(oldest.createdAt.getTime() + WINDOW_MS) : null;
      return NextResponse.json(
        { error: allowanceMessage(route, tier, limit, nextOpens), limit, used, nextOpens },
        { status: 429 },
      );
    }

    return null;
  } catch (err) {
    // Fail open — see note at the top of this file.
    console.warn(`[allowance] skipped for ${route} (is the ai_usage table created?):`, err instanceof Error ? err.message : err);
    return null;
  }
}

/** Give back the use recorded by `enforceAiLimit` when the AI call failed. */
export async function releaseAiUsage(clerkUserId: string, route: AiRoute): Promise<void> {
  try {
    const db = getDb();
    const [latest] = await db
      .select({ id: aiUsage.id })
      .from(aiUsage)
      .where(and(
        eq(aiUsage.clerkUserId, clerkUserId),
        eq(aiUsage.route, route),
        gte(aiUsage.createdAt, new Date(Date.now() - 15 * 60 * 1000)),
      ))
      .orderBy(desc(aiUsage.createdAt))
      .limit(1);
    if (latest) await db.delete(aiUsage).where(eq(aiUsage.id, latest.id));
  } catch (err) {
    console.warn('[allowance] could not release usage:', err instanceof Error ? err.message : err);
  }
}
