import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { tasks } from '@/lib/db/schema';
import { getOwnedTask } from '@/lib/db/ownership';
import type { ActionTask } from '@/types';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const owned = await getOwnedTask(userId, id);
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json()) as { completed: boolean };
  if (typeof body.completed !== 'boolean') {
    return NextResponse.json({ error: 'completed (boolean) is required' }, { status: 400 });
  }

  await getDb()
    .update(tasks)
    .set({ completed: body.completed, completedAt: body.completed ? new Date() : null })
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
