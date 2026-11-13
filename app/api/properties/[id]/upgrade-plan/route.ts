import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { plans, tasks } from '@/lib/db/schema';
import { toPropertyProfile } from '@/lib/db/mappers';
import { getOwnedProperty } from '@/lib/db/ownership';
import { upgradePlan } from '@/lib/db/plans';
import { getUserTier } from '@/lib/tier-server';
import { TIER_ORDER } from '@/lib/tiers';
import { enforceAiLimit, releaseAiUsage } from '@/lib/rate-limit';
import { generatePlan } from '@/lib/claude';
import { fetchSatelliteSnapshot, ringFromPixels } from '@/lib/satellite';
import { keepAliveJson } from '@/lib/keep-alive';

// Writing a bigger plan can take a few minutes.
export const maxDuration = 300;

/**
 * POST /api/properties/[id]/upgrade-plan  { userGoalsText? }
 *
 * After a member moves up (e.g. Steward → Naturalist), expand their plan to the
 * new membership: more tasks per month, how-to steps, time and cost for each.
 * Everything they already finished stays on the plan, and the new tasks build on it.
 * Only works while the plan is below their membership, and doesn't use up a rebuild.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tier = await getUserTier();

  const { id: propertyId } = await params;
  const property = await getOwnedProperty(userId, propertyId);
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const db = getDb();
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.propertyId, propertyId))
    .orderBy(desc(plans.generatedAt))
    .limit(1);
  if (!plan) return NextResponse.json({ error: 'No plan for this property yet' }, { status: 404 });

  if (TIER_ORDER.indexOf(plan.tier) >= TIER_ORDER.indexOf(tier)) {
    return NextResponse.json({ error: 'Your plan already matches your membership.', upToDate: true }, { status: 409 });
  }

  const body = (await req.json().catch(() => ({}))) as { userGoalsText?: unknown };
  const limited = await enforceAiLimit(userId, 'plan-upgrade', tier);
  if (limited) return limited;

  // What they already finished stays on the plan — the new tasks build on it
  const completedTitles = (
    await db.select({ title: tasks.title, completed: tasks.completed }).from(tasks).where(eq(tasks.planId, plan.id))
  ).filter((t) => t.completed).map((t) => t.title);

  const work = (async () => {
    try {
      const ring = property.boundary?.[0];
      const satellite = ring && ring.length >= 3 ? await fetchSatelliteSnapshot(property.boundary) : null;

      const newPlan = await generatePlan({
        profile: toPropertyProfile(property),
        tier,
        userGoalsText: typeof body.userGoalsText === 'string' ? body.userGoalsText.slice(0, 2000) : undefined,
        satelliteImageBase64: satellite?.base64,
        hasBoundary: !!satellite?.hasOutline,
        completedTitles,
      });

      newPlan.tasks = newPlan.tasks.map((t) => {
        const { areaPixels, ...task } = t as typeof t & { areaPixels?: unknown };
        const area = ringFromPixels(satellite, areaPixels);
        return area ? { ...task, area } : task;
      });

      const saved = await upgradePlan(propertyId, plan.id, newPlan);
      return { plan: saved, saved: true };
    } catch (err) {
      console.error('[upgrade-plan] error:', err instanceof Error ? err.message : err);
      await releaseAiUsage(userId, 'plan-upgrade');
      return { error: 'We could not expand your plan just now. Please try again in a minute.' };
    }
  })();
  return keepAliveJson(work);
}
