import { NextRequest, NextResponse } from 'next/server';
import type { ParcelLookupRequest, ParcelLookupResponse, ParcelBoundary } from '@/types';
import { cleanLocation, locateAddress } from '@/lib/places';

/**
 * POST /api/parcel-lookup
 *
 * Uses the exact spot sent by the address box ({ lat, lng }), or geocodes the
 * address with Mapbox, then calls the Regrid API for a parcel
 * boundary polygon. Returns { parcels, ownerMatch } or { parcels: [] } if
 * nothing is found.
 *
 * Required env vars:
 *   NEXT_PUBLIC_MAPBOX_TOKEN  -- for geocoding
 *   REGRID_API_KEY            -- for parcel lookup
 */
export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as ParcelLookupRequest & { lat?: unknown; lng?: unknown };

  if (!body.address) {
    return NextResponse.json({ error: 'address is required' }, { status: 400 });
  }

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const regridToken = process.env.REGRID_API_KEY;

  // No Regrid key → nothing to look up (onboarding falls back to drawing)
  if (!regridToken) {
    // No Regrid key configured -- return empty so onboarding falls back to manual draw
    console.warn('[parcel-lookup] REGRID_API_KEY not set -- skipping parcel lookup');
    return NextResponse.json({ parcels: [], ownerMatch: false } satisfies ParcelLookupResponse);
  }

  // Step 1: Where the land is — the exact spot from the address box (a picked
  // suggestion or GPS coordinates), otherwise look up the address text
  const sent = cleanLocation(body);
  const spot = sent ?? await locateAddress(body.address, mapboxToken);
  if (!spot) {
    console.error('[parcel-lookup] could not find the address');
    return NextResponse.json({ parcels: [], ownerMatch: false } satisfies ParcelLookupResponse);
  }
  const { lat, lng } = spot;

  // Step 2: Ask Regrid for the parcel at that spot
  try {
    const regridUrl =
      'https://app.regrid.com/api/v1/query.json?lat=' + lat +
      '&lon=' + lng +
      '&token=' + regridToken +
      '&return_geometry=true&strict_mode=false';

    const regridRes = await fetch(regridUrl, {
      headers: { Accept: 'application/json' },
    });

    if (!regridRes.ok) {
      console.error('[parcel-lookup] Regrid error', regridRes.status);
      return NextResponse.json({ parcels: [], ownerMatch: false } satisfies ParcelLookupResponse);
    }

    const regridData = await regridRes.json();

    // Response: { results: { type: 'FeatureCollection', features: [...] } }
    const features: RegridFeature[] = regridData?.results?.features ?? [];

    if (!features.length) {
      return NextResponse.json({ parcels: [], ownerMatch: false } satisfies ParcelLookupResponse);
    }

    const parcels: ParcelBoundary[] = features
      .filter((f) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')
      .map((f) => {
        const fields = f.properties?.fields ?? {};
        return {
          type: f.geometry.type as 'Polygon' | 'MultiPolygon',
          coordinates: f.geometry.coordinates as number[][][],
          acreage: parseFloat(fields.calc_acres ?? fields.ll_gisacre ?? '0') || 0,
          ownerName: fields.owner ?? fields.mailadd ?? undefined,
          parcelId: fields.parcelnumb ?? f.properties?.path ?? undefined,
          county: fields.county ?? undefined,
          state: fields.state2 ?? undefined,
        };
      });

    return NextResponse.json({ parcels, ownerMatch: true } satisfies ParcelLookupResponse);
  } catch (err) {
    console.error('[parcel-lookup] Regrid fetch error:', err);
    return NextResponse.json({ parcels: [], ownerMatch: false } satisfies ParcelLookupResponse);
  }
}

// Regrid feature shape (partial)
interface RegridFeature {
  geometry: {
    type: string;
    coordinates: unknown;
  };
  properties?: {
    path?: string;
    fields?: Record<string, string | undefined>;
  };
}
