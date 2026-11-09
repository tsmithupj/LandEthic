import { NextRequest, NextResponse } from 'next/server';
import type { GeneratePlanResponse, PropertyProfile } from '@/types';
import { generatePlan } from '@/lib/claude';
import { auth } from '@clerk/nextjs/server';
import { getUserTier } from '@/lib/tier-server';
import { enforceAiLimit } from '@/lib/rate-limit';
import { fetchSatelliteSnapshot, ringFromPixels } from '@/lib/satellite';

// Plan generation can produce up to ~16k tokens — give the function room to finish.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { profile?: PropertyProfile; userGoalsText?: string; boundary?: number[][][] };

    if (!body.profile) {
      return NextResponse.json({ error: 'profile is required' }, { status: 400 });
    }

    // Tier comes from the server, never the request body — otherwise a free
    // account could ask for (and get) a paid-tier plan.
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tier = await getUserTier();

    // Plan generation is the most expensive call in the app — cap it per day.
    const limited = await enforceAiLimit(userId, 'generate-plan', tier);
    if (limited) return limited;

    // Satellite photo of the parcel so each task can point to a real spot
    const hasBoundary = (body.boundary?.[0]?.length ?? 0) >= 3;
    const satellite = hasBoundary ? await fetchSatelliteSnapshot(body.boundary) : null;

    const plan = await generatePlan({
      profile: body.profile,
      tier,
      userGoalsText: body.userGoalsText,
      satelliteImageBase64: satellite?.base64,
      hasBoundary: !!satellite?.hasOutline,
    });

    // Turn each outline the AI traced on the photo into map coordinates
    plan.tasks = plan.tasks.map((t) => {
      const { areaPixels, ...task } = t as typeof t & { areaPixels?: unknown };
      const area = ringFromPixels(satellite, areaPixels);
      return area ? { ...task, area } : task;
    });

    const response: GeneratePlanResponse = { plan };
    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate-plan] ERROR:', msg);
    return NextResponse.json(
      { error: 'We could not build your plan just now. Please try again in a minute.' },
      { status: 500 }
    );
  }
}
