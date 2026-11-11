import { NextRequest, NextResponse } from 'next/server';
import type { GeneratePlanResponse, PropertyProfile } from '@/types';
import { generatePlan } from '@/lib/claude';
import { auth } from '@clerk/nextjs/server';
import { getUserTier } from '@/lib/tier-server';
import { enforceAiLimit, releaseAiUsage, type AiRoute } from '@/lib/rate-limit';
import { getOwnedProperty } from '@/lib/db/ownership';
import { fetchSatelliteSnapshot, ringFromPixels } from '@/lib/satellite';
import { replacePlan } from '@/lib/db/plans';
import { keepAliveJson } from '@/lib/keep-alive';

// Plan generation can produce up to ~16k tokens — give the function room to finish.
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  let charged: { userId: string; route: AiRoute } | null = null;
  try {
    const body = (await req.json().catch(() => ({}))) as {
      profile?: PropertyProfile;
      userGoalsText?: string;
      boundary?: number[][][];
      /** Set when rebuilding the plan of a property the member already has. */
      propertyId?: string;
    };

    if (!body.profile) {
      return NextResponse.json({ error: 'profile is required' }, { status: 400 });
    }

    // Tier comes from the server, never the request body — otherwise a free
    // account could ask for (and get) a paid-tier plan.
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tier = await getUserTier();

    // Plan generation is the most expensive call in the app. A first plan for a new
    // property and a rebuild of an existing one have separate monthly allowances.
    let route: AiRoute = 'generate-plan';
    if (body.propertyId) {
      if (!(await getOwnedProperty(userId, body.propertyId))) {
        return NextResponse.json({ error: 'Property not found' }, { status: 404 });
      }
      route = 'rebuild-plan';
    }
    const limited = await enforceAiLimit(userId, route, tier);
    if (limited) return limited;
    charged = { userId, route };
    const rebuildOf = body.propertyId ?? null;
    const profile = body.profile;

    // The AI part takes minutes: keep the connection alive while it works, and for a
    // rebuild save the new plan here — so it's kept even if the visitor's phone
    // sleeps or their connection drops before the answer arrives.
    const work = (async () => {
      try {
        // Satellite photo of the parcel so each task can point to a real spot
        const hasBoundary = (body.boundary?.[0]?.length ?? 0) >= 3;
        const satellite = hasBoundary ? await fetchSatelliteSnapshot(body.boundary) : null;

        const plan = await generatePlan({
          profile,
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

        if (rebuildOf) {
          const saved = await replacePlan(rebuildOf, plan);
          if (!saved) throw new Error('No existing plan for property');
          return { plan: saved, saved: true };
        }
        const response: GeneratePlanResponse = { plan };
        return response;
      } catch (err) {
        console.error('[generate-plan] ERROR:', err instanceof Error ? err.message : String(err));
        await releaseAiUsage(userId, route);
        return { error: 'We could not build your plan just now. Please try again in a minute.' };
      }
    })();
    return keepAliveJson(work);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[generate-plan] ERROR:', msg);
    if (charged) await releaseAiUsage(charged.userId, charged.route);
    return NextResponse.json(
      { error: 'We could not build your plan just now. Please try again in a minute.' },
      { status: 500 }
    );
  }
}
