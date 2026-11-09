import { NextRequest, NextResponse } from 'next/server';
import type { AnalyzePropertyRequest, AnalyzePropertyResponse } from '@/types';
import { auth } from '@clerk/nextjs/server';
import { analyzeProperty } from '@/lib/claude';
import { getUserTier, getPropertyAllowance } from '@/lib/tier-server';
import { getOwnedProperty } from '@/lib/db/ownership';
import { enforceAiLimit } from '@/lib/rate-limit';
import { fetchSatelliteSnapshot, ringFromPixels } from '@/lib/satellite';

export const maxDuration = 120;

// ─── Geocode address → lat/lng via Mapbox ─────────────────────────────────
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&types=address,place&limit=1`
    );
    const data = await res.json();
    const [lng, lat] = data.features?.[0]?.center ?? [];
    if (!lat || !lng) return null;
    return { lat, lng };
  } catch {
    return null;
  }
}

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
  try {
    const body: AnalyzePropertyRequest & { boundary?: number[][][]; refreshPropertyId?: string } = await req.json();

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

    const limited = await enforceAiLimit(userId, 'analyze-property', tier);
    if (limited) return limited;

    // Parse county/state from address (best-effort)
    const parts  = body.address.split(',').map((s) => s.trim());
    const state  = parts[parts.length - 1]?.replace(/\d+/g, '').trim();
    const county = parts[parts.length - 2]?.trim();

    // Enrich with real location data
    const coords = await geocodeAddress(body.address);
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

    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[analyze-property]', msg);
    return NextResponse.json(
      { error: 'We could not analyze this property just now. Please try again in a minute.' },
      { status: 500 }
    );
  }
}
