import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { desc, eq } from 'drizzle-orm';
import type { BatchItem } from 'drizzle-orm/batch';
import { getDb } from '@/lib/db/client';
import { plans, tasks } from '@/lib/db/schema';
import { toActionPlan, toPropertyProfile, toTaskInsert } from '@/lib/db/mappers';
import { getOwnedProperty } from '@/lib/db/ownership';
import { getUserTier } from '@/lib/tier-server';
import { enforceAiLimit, releaseAiUsage } from '@/lib/rate-limit';
import { generateMonthlyUpdate } from '@/lib/claude';
import { fetchSatelliteSnapshot, ringFromPixels } from '@/lib/satellite';
import { keepAliveJson } from '@/lib/keep-alive';
import {
  MONTHLY_PLAN, monthKey, monthLabel, monthNumOf, parseMonthKey, parseMonthLabel, planMonthlyUpdate, seasonOf,
} from '@/lib/months';
import type { ActionTask } from '@/types';

// New tasks for up to 6 months can take a while to write.
export const maxDuration = 300;

const CARRIED_TAG = 'Carried over';

/**
 * Monthly update (Naturalist / Conservationist).
 *
 * Once per calendar month, per property:
 *  - unfinished tasks from past months move into this month (tagged "Carried over"),
 *  - new tasks are written for any month in the plan's window that has none yet
 *    (normally just the month that was added at the far end), built around what
 *    the owner finished,
 *  - a short note for the top of the dashboard.
 * Finished tasks are never touched.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const tier = await getUserTier();
  const cfg = MONTHLY_PLAN[tier];
  if (!cfg) {
    return NextResponse.json(
      { error: 'Monthly updates are part of the Naturalist and Conservationist plans.' },
      { status: 403 },
    );
  }

  const { id: propertyId } = await params;
  const property = await getOwnedProperty(userId, propertyId);
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { month?: string; userGoalsText?: string };

  // Use the owner's own calendar month (sent by the browser) when it is within a
  // month of the server's, so the update lines up with what their dashboard shows.
  const serverMonth = monthNumOf(new Date());
  const clientMonth = parseMonthKey(body.month);
  const current = clientMonth !== null && Math.abs(clientMonth - serverMonth) <= 1 ? clientMonth : serverMonth;

  const db = getDb();
  const [plan] = await db
    .select()
    .from(plans)
    .where(eq(plans.propertyId, propertyId))
    .orderBy(desc(plans.generatedAt))
    .limit(1);
  if (!plan) return NextResponse.json({ error: 'No plan for this property yet' }, { status: 404 });

  const taskRows = await db.select().from(tasks).where(eq(tasks.planId, plan.id));

  if (plan.tier !== tier) {
    return NextResponse.json(
      { error: 'Your plan was built for a different membership. Tap "Refresh plan" to rebuild it for your current plan.' },
      { status: 409 },
    );
  }
  if (parseMonthKey(plan.lastMonthlyUpdate) === current) {
    return NextResponse.json({ plan: toActionPlan(propertyId, plan, taskRows), alreadyUpdated: true });
  }

  const limited = await enforceAiLimit(userId, 'monthly-update', tier);
  if (limited) return limited;

  // The AI part can take a few minutes — keep the connection alive, and finish and
  // save even if the visitor's connection drops part-way.
  const work = (async () => {
    try {
      // ── Work out what changes ────────────────────────────────────────────────
      const { overdue, newMonths, upcoming } = planMonthlyUpdate(taskRows, current, cfg.months);
      const completed = taskRows
        .filter((t) => t.completed)
        .sort((a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0));

      const ring = property.boundary?.[0];
      const satellite = newMonths.length > 0 && ring && ring.length >= 3
        ? await fetchSatelliteSnapshot(property.boundary)
        : null;

      const update = await generateMonthlyUpdate({
        profile: toPropertyProfile(property),
        tier,
        userGoalsText: typeof body.userGoalsText === 'string' ? body.userGoalsText.slice(0, 2000) : undefined,
        currentMonth: monthLabel(current),
        currentSeason: seasonOf(current),
        newMonths: newMonths.map(monthLabel),
        perMonth: cfg.perMonth,
        completedTitles: completed.slice(0, 30).map((t) => t.title),
        carriedOverTitles: overdue.map((t) => t.title),
        upcomingTitles: upcoming.slice(0, 40).map((t) => t.title),
        satelliteImageBase64: satellite?.base64,
        hasBoundary: !!satellite?.hasOutline,
      });

      const newTasks: ActionTask[] = update.tasks.map((t) => {
        const { areaPixels, ...task } = t;
        const area = ringFromPixels(satellite, areaPixels);
        const m = parseMonthLabel(task.month);
        return {
          ...task,
          id: '',
          ...(area ? { area } : {}),
          season: m !== null ? seasonOf(m) : task.season,
        } as ActionTask;
      });

      // ── Save ─────────────────────────────────────────────────────────────────
      const queries: BatchItem<'pg'>[] = [
        ...overdue.map((t) =>
          db
            .update(tasks)
            .set({
              month: monthLabel(current),
              season: seasonOf(current),
              tags: t.tags.includes(CARRIED_TAG) ? t.tags : [CARRIED_TAG, ...t.tags],
            })
            .where(eq(tasks.id, t.id)),
        ),
        db
          .update(plans)
          .set({ lastMonthlyUpdate: monthKey(current), monthlyNote: update.note || null })
          .where(eq(plans.id, plan.id)),
      ];
      if (newTasks.length) {
        queries.push(db.insert(tasks).values(newTasks.map((t) => toTaskInsert(t, plan.id, propertyId))));
      }
      await db.batch(queries as [BatchItem<'pg'>, ...BatchItem<'pg'>[]]);

      const [savedPlan] = await db.select().from(plans).where(eq(plans.id, plan.id));
      const savedTasks = await db.select().from(tasks).where(eq(tasks.planId, plan.id));

      return {
        plan: toActionPlan(propertyId, savedPlan, savedTasks),
        added: newTasks.length,
        carriedOver: overdue.length,
      };
    } catch (err) {
      console.error('[monthly-update] error:', err instanceof Error ? err.message : err);
      await releaseAiUsage(userId, 'monthly-update');
      return { error: 'We could not build your monthly update just now. Please try again in a minute.' };
    }
  })();
  return keepAliveJson(work);
}
