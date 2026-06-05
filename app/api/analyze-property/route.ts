import { NextRequest, NextResponse } from 'next/server';
import type { AnalyzePropertyRequest, AnalyzePropertyResponse } from '@/types';
import { analyzeProperty } from '@/lib/claude';

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
async function getSoilData(lat: number, lng: number): Promise<string | null> {
  try {
    const res = await fetch(
      `https://casoilresource.lawr.ucdavis.edu/api/mapunit/?lon=${lng}&lat=${lat}&key=rhizeome&format=json`
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !Array.isArray(data) || data.length === 0) return null;
    return data
      .slice(0, 2)
      .map((mu: any) => `${mu.muname ?? 'Unknown'} (${mu.mukey ?? ''})`)
      .join(', ');
  } catch {
    return null;
  }
}

// ─── Main route ───────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body: AnalyzePropertyRequest & { boundary?: number[][][] } = await req.json();

    if (!body.address || !body.goals?.length) {
      return NextResponse.json({ error: 'address and goals are required' }, { status: 400 });
    }

    // Parse county/state from address (best-effort)
    const parts  = body.address.split(',').map((s) => s.trim());
    const state  = parts[parts.length - 1]?.replace(/\d+/g, '').trim();
    const county = parts[parts.length - 2]?.trim();

    // Enrich with real location data
    const coords = await geocodeAddress(body.address);
    const [hardinessZone, soilData] = coords
      ? await Promise.all([
          getHardinessZone(coords.lat, coords.lng),
          getSoilData(coords.lat, coords.lng),
        ])
      : [null, null];

    console.log('[analyze-property] enriched data:', { coords, hardinessZone, soilData });

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
    });

    const response: AnalyzePropertyResponse = {
      profile: {
        ...result.profile,
        id:           `prop-${Date.now()}`,
        createdAt:    new Date().toISOString(),
        ecosystemScore: result.ecosystemScore,
      },
      insights: result.insights,
    };

    return NextResponse.json(response);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[analyze-property]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
