import { eq } from 'drizzle-orm';
import { getDb } from './client';
import { plans, tasks } from './schema';
import { toActionPlan, toTaskInsert } from './mappers';
import type { ActionPlan } from '@/types';

/**
 * Replace a property's plan with a newly built one (finished tasks included —
 * a rebuild starts fresh). Returns the saved plan, or null if the property has
 * no plan to replace.
 */
export async function replacePlan(propertyId: string, plan: Pick<ActionPlan, 'tier' | 'summary' | 'tasks'>): Promise<ActionPlan | null> {
  if (!Array.isArray(plan.tasks) || plan.tasks.length === 0) throw new Error('The new plan has no tasks');

  const db = getDb();
  const [existingPlan] = await db.select().from(plans).where(eq(plans.propertyId, propertyId));
  if (!existingPlan) return null;

  await db.batch([
    db.delete(tasks).where(eq(tasks.planId, existingPlan.id)),
    db
      .update(plans)
      .set({ tier: plan.tier, summary: plan.summary, generatedAt: new Date(), lastMonthlyUpdate: null, monthlyNote: null })
      .where(eq(plans.id, existingPlan.id)),
    db.insert(tasks).values(plan.tasks.map((t) => toTaskInsert(t, existingPlan.id, propertyId))),
  ]);

  const [savedPlan] = await db.select().from(plans).where(eq(plans.id, existingPlan.id));
  const savedTasks = await db.select().from(tasks).where(eq(tasks.planId, existingPlan.id));
  return toActionPlan(propertyId, savedPlan, savedTasks);
}
