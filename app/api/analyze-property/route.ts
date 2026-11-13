import { NextRequest, NextResponse } from 'next/server';
import type { AnalyzePropertyRequest, AnalyzePropertyResponse } from '@/types';
import { auth } from '@clerk/nextjs/server';
import { analyzeProperty } from '@/lib/claude';
import { getUserTier, getPropertyAllowance } from '@/lib/tier-server';
import { getOwnedProperty } from '@/lib/db/ownership';
import { enforceAiLimit, releaseAiUsage, type AiRoute } from '@/lib/rate-limit';
import { fetchSatelliteSnapshot, ringFromPixels } from '@/lib/satellite';
import { keepAliveJson } from '@/lib/keep-alive';
import { cleanLocation, locateAddress } from '@/lib/places';

export const maxDuration = 120;

// ─── USDA hardiness zone from lat/lng ─────────────────────────────────────
async function getHardinessZone(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(`https://phzmapi.org/${lat}/${lng}.json`);
    const data = await res.json();
    return data.zone ?? null;
  } catch {
    return null;
  }
}

// ─── USDA soil data via UC Davis SoilWeb API ──────────────────────────────
interface SoilMapUnit {
  muname?: string;
  mukey?: string;
}

async function getSoilData(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://casoilresource.lawr.ucdavis.edu/api/mapunit/?lon=${lng}&lat=${lat}&key=rhizeome&format=json`
    );
    if (!res.ok) return null;
    const data: unknown = await res.json();
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    return (data as SoilMapUnit[])
      .slice(0, 2)
      .map((mu) => `${mu.muname ?? 'Unknown'} (${mu.mukey ?? ''})`)
      .join(', ');
  } catch {
    return null;
  }
}

// ─── Main route ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  let charged: { userId: string; route: AiRoute } | null = null;
  try {
    const body: AnalyzePropertyRequest & { boundary?: number[][][]; refreshPropertyId?: string } = await req.json().catch(() => ({}));

    if (!body.address || !body.goals?.length) {
      return NextResponse.json({ error: 'address and goals are required' }, { status: 400 });
    }

    // Enforce the property limit before spending an AI call on a property that
    // can't be saved anyway.
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const tier = await getUserTier();
    if (body.refreshPropertyId) {
      // Re-analyzing a property the user already has — no new-property limit applies.
      const owned = await getOwnedProperty(userId, body.refreshPropertyId);
      if (!owned) return NextResponse.json({ error: 'Property not found' }, { status: 404 });
    } else {
      const allowance = await getPropertyAllowance(userId, tier);
      if (!allowance.canAdd) {
        return NextResponse.json(
          { error: `Your plan allows ${allowance.limit} ${allowance.limit === 1 ? 'property' : 'properties'}. Upgrade to add more.` },
          { status: 403 }
        );
      }
    }

    // A new property and an insight update for an existing one have separate monthly allowances
    const route: AiRoute = body.refreshPropertyId ? 'refresh-insights' : 'analyze-property';
    const limited = await enforceAiLimit(userId, route, tier);
    if (limited) return limited;
    charged = { userId, route };

    // The AI part can take a minute or more — keep the connection alive while it works
    const work = (async () => {
      try {
        // Where the land is: the exact spot the member picked (suggestion or GPS
        // coordinates), otherwise the best match for the address text
        const spot = cleanLocation((body as { location?: unknown }).location)
          ?? await locateAddress(body.address, process.env.NEXT_PUBLIC_MAPBOX_TOKEN);
        const coords = spot ? { lat: spot.lat, lng: spot.lng } : null;

        // County and state: from the map lookup when we have them, else a best guess from the text
        const parts  = body.address.split(',').map((s) => s.trim());
        const state  = spot?.state ?? parts[parts.length - 1]?.replace(/\d+/g, '').trim();
        const county = spot?.county ?? parts[parts.length - 2]?.trim();
        const hasBoundary = (body.boundary?.[0]?.length ?? 0) >= 3;
        const [hardinessZone, soilData, satellite] = await Promise.all([
          coords ? getHardinessZone(coords.lat, coords.lng) : null,
          coords ? getSoilData(coords.lat, coords.lng) : null,
          // Satellite photo of the parcel so the AI can point to real spots on the land
          hasBoundary || coords ? fetchSatelliteSnapshot(body.boundary, coords ?? undefined) : null,
        ]);

        console.log('[analyze-property] enriched data:', { coords, hardinessZone, soilData, satellite: !!satellite });

        const result = await analyzeProperty({
          address:       body.address,
          acreage:       body.acreage ? parseFloat(String(body.acreage)) : undefined,
          goals:         body.goals,
          userGoalsText: (body as { userGoalsText?: string }).userGoalsText,
          county,
          state,
          coordinates:   coords ?? undefined,
          hardinessZone: hardinessZone ?? undefined,
          soilData:      soilData ?? undefined,
          satelliteImageBase64: satellite?.base64,
          hasBoundary: !!satellite?.hasOutline,
        });

        const response: AnalyzePropertyResponse = {
          profile: {
            ...result.profile,
            id:           `prop-${Date.now()}`,
            createdAt:    new Date().toISOString(),
            ecosystemScore: result.ecosystemScore,
          },
          // Turn each outline the AI traced on the photo into map coordinates
          insights: result.insights.map(({ areaPixels, ...insight }) => {
            const area = ringFromPixels(satellite, areaPixels);
            return area ? { ...insight, area } : insight;
          }),
        };
        return response;
      } catch (err) {
        console.error('[analyze-property]', err instanceof Error ? err.message : String(err));
        await releaseAiUsage(userId, route);
        return { error: 'We could not analyze this property just now. Please try again in a minute.' };
      }
    })();
    return keepAliveJson(work);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[analyze-property]', msg);
    if (charged) await releaseAiUsage(charged.userId, charged.route);
    return NextResponse.json(
      { error: 'We could not analyze this property just now. Please try again in a minute.' },
      { status: 500 }
    );
  }
}
