import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { eq } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { habitatPlans } from '@/lib/db/schema';
import { toHabitatPlan, toPropertyProfile } from '@/lib/db/mappers';
import { getOwnedProperty } from '@/lib/db/ownership';
import { getUserTier } from '@/lib/tier-server';
import { enforceAiLimit, releaseAiUsage } from '@/lib/rate-limit';
import { generateHabitatPlan } from '@/lib/claude';
import { fetchSatelliteSnapshot, ringFromPixels } from '@/lib/satellite';
import { keepAliveJson } from '@/lib/keep-alive';
import type { FoodPlot, NestingBox } from '@/types';

// Studying the photo and writing both plans can take a minute or two.
export const maxDuration = 300;

const locked = () => NextResponse.json(
  { error: 'Food plot and nesting box planners are part of the Conservationist plan.' },
  { status: 403 },
);

/** The saved food plot + nesting box plan for a property (or null). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if ((await getUserTier()) !== 'conservationist') return locked();

  const { id: propertyId } = await params;
  if (!(await getOwnedProperty(userId, propertyId))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const [row] = await getDb().select().from(habitatPlans).where(eq(habitatPlans.propertyId, propertyId));
    return NextResponse.json({ habitat: row ? toHabitatPlan(row) : null });
  } catch (err) {
    // Table missing (`npx drizzle-kit push` not run yet) — treat as "no plan yet".
    console.warn('[habitat] read failed:', err instanceof Error ? err.message : err);
    return NextResponse.json({ habitat: null });
  }
}

/** Build (or rebuild) the food plot + nesting box plan from the satellite photo. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const tier = await getUserTier();
  if (tier !== 'conservationist') return locked();

  const { id: propertyId } = await params;
  const property = await getOwnedProperty(userId, propertyId);
  if (!property) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = (await req.json().catch(() => ({}))) as { userGoalsText?: string };

  const limited = await enforceAiLimit(userId, 'habitat-plan', tier);
  if (limited) return limited;

  // Studying the photo and writing both plans takes a few minutes — keep the
  // connection alive, and finish and save even if the visitor's connection drops.
  const work = (async () => {
    try {
      const ring = property.boundary?.[0];
      const satellite = ring && ring.length >= 3 ? await fetchSatelliteSnapshot(property.boundary) : null;

      const out = await generateHabitatPlan({
        profile: toPropertyProfile(property),
        userGoalsText: typeof body.userGoalsText === 'string' ? body.userGoalsText.slice(0, 2000) : undefined,
        satelliteImageBase64: satellite?.base64,
        hasBoundary: !!satellite?.hasOutline,
      });

      const num = (v: unknown, fallback = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : Number(v) || fallback);
      const strs = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && !!x.trim()) : []);

      const foodPlots: FoodPlot[] = out.foodPlots.map((p) => {
        const area = ringFromPixels(satellite, p.areaPixels);
        return {
          id: randomUUID(),
          name: String(p.name ?? 'Food plot'),
          acres: Math.round(num(p.acres, 0.25) * 100) / 100,
          where: String(p.where ?? ''),
          ...(area ? { area } : {}),
          targetWildlife: strs(p.targetWildlife),
          seedMix: (Array.isArray(p.seedMix) ? p.seedMix : [])
            .filter((s) => s && typeof s.seed === 'string')
            .map((s) => ({ seed: s.seed, lbsPerAcre: num(s.lbsPerAcre), ...(s.notes ? { notes: String(s.notes) } : {}) })),
          plantingWindow: String(p.plantingWindow ?? ''),
          soilPrep: strs(p.soilPrep),
          limeAndFertilizer: p.limeAndFertilizer ? String(p.limeAndFertilizer) : undefined,
          maintenance: strs(p.maintenance),
          why: String(p.why ?? ''),
        };
      });

      const nestingBoxes: NestingBox[] = out.nestingBoxes.map((b) => {
        const area = ringFromPixels(satellite, b.areaPixels);
        return {
          id: randomUUID(),
          species: String(b.species ?? 'Nest box'),
          boxType: String(b.boxType ?? ''),
          count: Math.max(1, Math.round(num(b.count, 1))),
          mountHeight: String(b.mountHeight ?? ''),
          facing: String(b.facing ?? ''),
          spacing: b.spacing ? String(b.spacing) : undefined,
          where: String(b.where ?? ''),
          ...(area ? { area } : {}),
          putUpBy: b.putUpBy ? String(b.putUpBy) : undefined,
          cleanOut: b.cleanOut ? String(b.cleanOut) : undefined,
          tips: strs(b.tips),
          why: String(b.why ?? ''),
        };
      });

      const values = {
        foodPlots,
        foodPlotNote: out.foodPlotNote ?? null,
        nestingBoxes,
        nestingBoxNote: out.nestingBoxNote ?? null,
        generatedAt: new Date(),
      };

      const db = getDb();
      const [row] = await db
        .insert(habitatPlans)
        .values({ propertyId, ...values })
        .onConflictDoUpdate({ target: habitatPlans.propertyId, set: values })
        .returning();
      return { habitat: toHabitatPlan(row) };
    } catch (err) {
      console.error('[habitat] error:', err instanceof Error ? err.message : err);
      await releaseAiUsage(userId, 'habitat-plan');
      return { error: 'We could not build your plan just now. Please try again in a minute.' };
    }
  })();
  return keepAliveJson(work);
}
