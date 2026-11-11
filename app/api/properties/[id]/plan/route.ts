import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { plans, tasks } from '@/lib/db/schema';
import { toActionPlan, toTaskInsert } from '@/lib/db/mappers';
import { getOwnedProperty } from '@/lib/db/ownership';
import type { ActionPlan } from '@/types';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: propertyId } = await params;
  const owned = await getOwnedProperty(userId, propertyId);
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { plan: ActionPlan };
  if (!body.plan) return NextResponse.json({ error: 'plan is required' }, { status: 400 });

  const db = getDb();
  const [existingPlan] = await db.select().from(plans).where(eq(plans.propertyId, propertyId));
  if (!existingPlan) return NextResponse.json({ error: 'No existing plan for property' }, { status: 404 });

  await db.batch([
    db.delete(tasks).where(eq(tasks.planId, existingPlan.id)),
    db
      .update(plans)
      .set({ tier: body.plan.tier, summary: body.plan.summary, generatedAt: new Date(), lastMonthlyUpdate: null, monthlyNote: null })
      .where(eq(plans.id, existingPlan.id)),
    db.insert(tasks).values(body.plan.tasks.map((t) => toTaskInsert(t, existingPlan.id, propertyId))),
  ]);

  const [savedPlan] = await db.select().from(plans).where(eq(plans.id, existingPlan.id));
  const savedTasks = await db.select().from(tasks).where(eq(tasks.planId, existingPlan.id));

  return NextResponse.json({ plan: toActionPlan(propertyId, savedPlan, savedTasks) });
}
