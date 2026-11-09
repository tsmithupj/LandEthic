import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { properties } from '@/lib/db/schema';
import { getOwnedProperty } from '@/lib/db/ownership';
import type { Insight } from '@/lib/store';

// Replace a property's insights (used by "Update insights" on the dashboard).
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id: propertyId } = await params;
  const owned = await getOwnedProperty(userId, propertyId);
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json()) as { insights?: Insight[] };
  if (!Array.isArray(body.insights)) {
    return NextResponse.json({ error: 'insights are required' }, { status: 400 });
  }

  await getDb()
    .update(properties)
    .set({ insights: body.insights })
    .where(eq(properties.id, propertyId));

  return NextResponse.json({ insights: body.insights });
}
