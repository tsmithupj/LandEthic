import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';
import { getOwnedTask } from '@/lib/db/ownership';
import { cleanSteps, cleanWeek } from '@/lib/db/mappers';
import type { ActionTask, TaskStep } from '@/types';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const owned = await getOwnedTask(userId, id);
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Either field may be sent: `completed` (checkbox) and/or `steps` (weekly checklist).
  const body = (await req.json().catch(() => ({}))) as { completed?: boolean; steps?: TaskStep[] };
  const hasCompleted = typeof body.completed === 'boolean';
  const steps = body.steps !== undefined ? cleanSteps(body.steps) : undefined;
  if (!hasCompleted && steps === undefined) {
    return NextResponse.json({ error: 'completed (boolean) or steps is required' }, { status: 400 });
  }

  await getDb()
    .update(tasks)
    .set({
      ...(hasCompleted ? { completed: body.completed, completedAt: body.completed ? new Date() : null } : {}),
      ...(steps !== undefined ? { steps } : {}),
    })
    .where(eq(tasks.id, id));

  return NextResponse.json({ ok: true });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const owned = await getOwnedTask(userId, id);
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const task = (await req.json()) as ActionTask;

  await getDb()
    .update(tasks)
    .set({
      title: task.title,
      description: task.description,
      whyItMatters: task.whyItMatters,
      locationDescription: task.locationDescription,
      area: task.area ?? null,
      week: cleanWeek(task.week),
      steps: cleanSteps(task.steps),
      impactScore: task.impactScore,
      impactBreakdown: task.impactBreakdown,
      recommendations: task.recommendations,
      tags: task.tags,
      month: task.month,
      season: task.season,
      tier: task.tier,
      completed: task.completed,
      completedAt: task.completed ? new Date() : null,
    })
    .where(eq(tasks.id, id));

  return NextResponse.json({ ok: true });
}
