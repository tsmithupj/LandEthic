import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { getOwnedProperty } from '@/lib/db/ownership';
import { replacePlan } from '@/lib/db/plans';
import type { ActionPlan } from '@/types';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: propertyId } = await params;
  const owned = await getOwnedProperty(userId, propertyId);
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { plan?: ActionPlan };
  if (!body.plan || !Array.isArray(body.plan.tasks) || body.plan.tasks.length === 0) {
    return NextResponse.json({ error: 'plan is required' }, { status: 400 });
  }

  const plan = await replacePlan(propertyId, body.plan);
  if (!plan) return NextResponse.json({ error: 'No existing plan for property' }, { status: 404 });
  return NextResponse.json({ plan });
}
