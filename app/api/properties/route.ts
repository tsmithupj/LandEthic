import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq, desc } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { properties, plans, tasks } from '@/lib/db/schema';
import { toPropertyEntry } from '@/lib/db/mappers';
import type { PropertyEntry } from '@/lib/store';
import type { PropertyProfile, ActionPlan } from '@/types';

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const db = getDb();
  const propertyRows = await db
    .select()
    .from(properties)
    .where(eq(properties.clerkUserId, userId))
    .orderBy(properties.createdAt);

  const entries: PropertyEntry[] = [];
  for (const property of propertyRows) {
    const [plan] = await db
      .select()
      .from(plans)
      .where(eq(plans.propertyId, property.id))
      .orderBy(desc(plans.generatedAt))
      .limit(1);
    if (!plan) continue; // shouldn't happen — properties are always created with a plan
    const taskRows = await db.select().from(tasks).where(eq(tasks.planId, plan.id));
    entries.push(toPropertyEntry(property, plan, taskRows));
  }

  return NextResponse.json({ entries });
}

interface CreatePropertyBody {
  profile: PropertyProfile;
  insights: PropertyEntry['insights'];
  boundary: number[][][] | null;
  plan: ActionPlan;
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await req.json()) as CreatePropertyBody;
  if (!body.profile || !body.plan) {
    return NextResponse.json({ error: 'profile and plan are required' }, { status: 400 });
  }

  const propertyId = randomUUID();
  const planId = randomUUID();
  const { profile, plan, insights, boundary } = body;

  const db = getDb();
  await db.batch([
    db.insert(properties).values({
      id: propertyId,
      clerkUserId: userId,
      name: profile.name,
      address: profile.address,
      acreage: profile.acreage,
      county: profile.county,
      state: profile.state,
      goals: profile.goals,
      boundary,
      woodedAcres: profile.woodedAcres,
      openAcres: profile.openAcres,
      soilType: profile.soilType,
      waterFeatures: profile.waterFeatures,
      ecosystemScore: profile.ecosystemScore,
      insights: insights ?? [],
    }),
    db.insert(plans).values({
      id: planId,
      propertyId,
      tier: plan.tier,
      summary: plan.summary,
    }),
    db.insert(tasks).values(
      plan.tasks.map((t) => ({
        id: randomUUID(),
        planId,
        propertyId,
        title: t.title,
        description: t.description,
        whyItMatters: t.whyItMatters,
        locationDescription: t.locationDescription,
        impactScore: t.impactScore,
        impactBreakdown: t.impactBreakdown,
        recommendations: t.recommendations,
        tags: t.tags,
        month: t.month,
        season: t.season,
        tier: t.tier,
        completed: t.completed,
      }))
    ),
  ]);

  const [property] = await db.select().from(properties).where(eq(properties.id, propertyId));
  const [savedPlan] = await db.select().from(plans).where(eq(plans.id, planId));
  const savedTasks = await db.select().from(tasks).where(eq(tasks.planId, planId));

  return NextResponse.json({ entry: toPropertyEntry(property, savedPlan, savedTasks) });
}
