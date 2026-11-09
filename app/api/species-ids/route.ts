import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { listSpeciesIds } from '@/lib/db/species-ids';

// GET /api/species-ids — the signed-in user's most recent identifications
export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  return NextResponse.json({ items: await listSpeciesIds(userId) });
}
