import { randomUUID } from 'node:crypto';
import type { PropertyProfile, ActionPlan, ActionTask, HabitatPlan, TaskStep } from '@/types';
import type { PropertyEntry } from '@/lib/store';
import type { properties, plans, tasks, habitatPlans } from './schema';

type PropertyRow = typeof properties.$inferSelect;
type PlanRow = typeof plans.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;
type HabitatRow = typeof habitatPlans.$inferSelect;

export function toActionTask(row: TaskRow): ActionTask {
  return {
    id: row.id,
    propertyId: row.propertyId,
    title: row.title,
    description: row.description,
    whyItMatters: row.whyItMatters,
    impactScore: row.impactScore,
    impactBreakdown: row.impactBreakdown,
    tags: row.tags,
    month: row.month ?? undefined,
    season: row.season ?? undefined,
    tier: row.tier,
    completed: row.completed,
    completedAt: row.completedAt ? row.completedAt.toISOString() : undefined,
    locationDescription: row.locationDescription ?? undefined,
    area: row.area ?? undefined,
    week: row.week ?? undefined,
    steps: row.steps ?? undefined,
    recommendations: row.recommendations ?? undefined,
  };
}

/** Keep only well-formed checklist steps (from the AI or the browser). */
export function cleanSteps(value: unknown): TaskStep[] | null {
  if (!Array.isArray(value)) return null;
  const steps = value
    .map((s) => {
      if (typeof s === 'string') return { text: s, done: false };
      if (s && typeof s === 'object' && typeof (s as TaskStep).text === 'string') {
        return { text: (s as TaskStep).text, done: (s as TaskStep).done === true };
      }
      return null;
    })
    .filter((s): s is TaskStep => !!s && s.text.trim().length > 0)
    .slice(0, 12)
    .map((s) => ({ text: s.text.trim().slice(0, 300), done: s.done }));
  return steps.length ? steps : null;
}

/** Week of the month (1–4), or null. */
export function cleanWeek(value: unknown): number | null {
  const n = typeof value === 'string' ? parseInt(value, 10) : value;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 4 ? n : null;
}

/** Column values for inserting a task from the AI / browser shape. */
export function toTaskInsert(t: ActionTask, planId: string, propertyId: string) {
  return {
    id: randomUUID(),
    planId,
    propertyId,
    title: t.title,
    description: t.description,
    whyItMatters: t.whyItMatters,
    locationDescription: t.locationDescription,
    area: t.area ?? null,
    week: cleanWeek(t.week),
    steps: cleanSteps(t.steps),
    impactScore: t.impactScore,
    impactBreakdown: t.impactBreakdown,
    recommendations: t.recommendations,
    tags: t.tags ?? [],
    month: t.month,
    season: t.season,
    tier: t.tier,
    completed: t.completed ?? false,
  };
}

export function toHabitatPlan(row: HabitatRow): HabitatPlan {
  return {
    propertyId: row.propertyId,
    foodPlots: row.foodPlots,
    foodPlotNote: row.foodPlotNote ?? undefined,
    nestingBoxes: row.nestingBoxes,
    nestingBoxNote: row.nestingBoxNote ?? undefined,
    generatedAt: row.generatedAt.toISOString(),
  };
}

export function toPropertyProfile(row: PropertyRow): PropertyProfile {
  return {
    id: row.id,
    name: row.name,
    address: row.address,
    acreage: row.acreage,
    county: row.county,
    state: row.state,
    goals: row.goals,
    // The AI never returns a real ParcelBoundary — the actual map geometry
    // lives on PropertyEntry.boundary (raw rings), mapped separately below.
    boundary: null,
    woodedAcres: row.woodedAcres ?? undefined,
    openAcres: row.openAcres ?? undefined,
    soilType: row.soilType ?? undefined,
    waterFeatures: row.waterFeatures ?? undefined,
    ecosystemScore: row.ecosystemScore ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };
}

export function toActionPlan(propertyId: string, plan: PlanRow, taskRows: TaskRow[]): ActionPlan {
  return {
    id: plan.id,
    propertyId,
    tier: plan.tier,
    generatedAt: plan.generatedAt.toISOString(),
    summary: plan.summary,
    lastMonthlyUpdate: plan.lastMonthlyUpdate ?? undefined,
    monthlyNote: plan.monthlyNote ?? undefined,
    tasks: taskRows.map(toActionTask),
  };
}

export function toPropertyEntry(property: PropertyRow, plan: PlanRow, taskRows: TaskRow[]): PropertyEntry {
  return {
    property: toPropertyProfile(property),
    plan: toActionPlan(property.id, plan, taskRows),
    insights: property.insights,
    boundary: property.boundary,
  };
}
