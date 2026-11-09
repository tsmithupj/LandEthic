import { NextResponse } from 'next/server';
import { and, count, eq, gte } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { aiUsage } from '@/lib/db/schema';
import type { SubscriptionTier } from '@/types';

/**
 * Per-user daily cap on the AI routes.
 *
 * Every AI request is logged to the `ai_usage` table; before a new request we
 * count that user's requests to the same route over the last 24 hours and
 * refuse with a friendly 429 once they hit their plan's limit.
 *
 * Fails OPEN: if the table doesn't exist yet (`npx drizzle-kit push` not run)
 * or the database is unreachable, the request is allowed and a warning is
 * logged — a missing table must never take the app down.
 */

export type AiRoute =
  | 'analyze-property'
  | 'generate-plan'
  | 'replace-task'
  | 'task-chat'
  | 'identify-species'
  | 'monthly-update'
  | 'habitat-plan';

/** Requests allowed per user, per route, in any rolling 24-hour window. */
export const DAILY_AI_LIMITS: Record<AiRoute, Record<SubscriptionTier, number>> = {
  //                  free  steward  naturalist  conservationist
  'analyze-property': { free: 3,  steward: 5,  naturalist: 10, conservationist: 20 },
  'generate-plan':    { free: 3,  steward: 6,  naturalist: 10, conservationist: 15 },
  'replace-task':     { free: 0,  steward: 10, naturalist: 20, conservationist: 30 },
  'task-chat':        { free: 20, steward: 40, naturalist: 60, conservationist: 100 },
  'identify-species': { free: 0,  steward: 20, naturalist: 40, conservationist: 60 },
  // Monthly update runs once per property per month; the cap only stops retries looping.
  'monthly-update':   { free: 0,  steward: 0,  naturalist: 6,  conservationist: 10 },
  'habitat-plan':     { free: 0,  steward: 0,  naturalist: 0,  conservationist: 6 },
};

const ACTION_LABEL: Record<AiRoute, string> = {
  'analyze-property': 'property analyses',
  'generate-plan':    'plan builds',
  'replace-task':     'task swaps',
  'task-chat':        'task questions',
  'identify-species': 'species IDs',
  'monthly-update':   'monthly updates',
  'habitat-plan':     'food plot and nest box plans',
};

const TIER_NAME: Record<SubscriptionTier, string> = {
  free: 'Free',
  steward: 'Steward',
  naturalist: 'Naturalist',
  conservationist: 'Conservationist',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Check (and record) one AI request. Returns `null` when the request may go
 * ahead, or a ready-to-return 429 response when the user is over their limit.
 */
export async function enforceAiLimit(
  clerkUserId: string,
  route: AiRoute,
  tier: SubscriptionTier,
): Promise<NextResponse | null> {
  const limit = DAILY_AI_LIMITS[route][tier];

  try {
    const db = getDb();
    const since = new Date(Date.now() - DAY_MS);
    const [row] = await db
      .select({ n: count() })
      .from(aiUsage)
      .where(and(
        eq(aiUsage.clerkUserId, clerkUserId),
        eq(aiUsage.route, route),
        gte(aiUsage.createdAt, since),
      ));
    const used = Number(row?.n ?? 0);

    if (used >= limit) {
      const upgradeHint = tier === 'conservationist' ? '' : ' Upgrading your plan raises the limit.';
      return NextResponse.json(
        {
          error:
            `You've reached today's limit of ${limit} ${ACTION_LABEL[route]} on the ${TIER_NAME[tier]} plan. ` +
            `Please try again tomorrow.${upgradeHint}`,
          limit,
          used,
        },
        { status: 429, headers: { 'Retry-After': '3600' } },
      );
    }

    await db.insert(aiUsage).values({ clerkUserId, route });
    return null;
  } catch (err) {
    // Fail open — see note at the top of this file.
    console.warn(`[rate-limit] skipped for ${route} (is the ai_usage table created?):`, err instanceof Error ? err.message : err);
    return null;
  }
}
