import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { properties } from '@/lib/db/schema';
import { getOwnedProperty } from '@/lib/db/ownership';

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { id } = await params;
  const owned = await getOwnedProperty(userId, id);
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await getDb().delete(properties).where(eq(properties.id, id));
  return NextResponse.json({ ok: true });
}
