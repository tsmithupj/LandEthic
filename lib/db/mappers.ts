import type { PropertyProfile, ActionPlan, ActionTask } from '@/types';
import type { PropertyEntry } from '@/lib/store';
import type { properties, plans, tasks } from './schema';

type PropertyRow = typeof properties.$inferSelect;
type PlanRow = typeof plans.$inferSelect;
type TaskRow = typeof tasks.$inferSelect;

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
    recommendations: row.recommendations ?? undefined,
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
