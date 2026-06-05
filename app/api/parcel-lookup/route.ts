import { NextRequest, NextResponse } from 'next/server';
import type { ParcelLookupRequest, ParcelLookupResponse, ParcelBoundary } from '@/types';

/**
 * POST /api/parcel-lookup
 *
 * Geocodes the address with Mapbox, then calls the Regrid API for a parcel
 * boundary polygon. Returns { parcels, ownerMatch } or { parcels: [] } if
 * nothing is found.
 *
 * Required env vars:
 *   NEXT_PUBLIC_MAPBOX_TOKEN  -- for geocoding
 *   REGRID_API_KEY            -- for parcel lookup
 */
export async function POST(req: NextRequest) {
  const body: ParcelLookupRequest = await req.json();

  if (!body.address) {
    return NextResponse.json({ error: 'address is required' }, { status: 400 });
  }

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const regridToken = process.env.REGRID_API_KEY;

  // Step 1: Geocode the address with Mapbox
  let lat: number;
  let lng: number;

  try {
    const geoUrl =
      'https://api.mapbox.com/geocoding/v5/mapbox.places/' +
      encodeURIComponent(body.address) +
      '.json?access_token=' + mapboxToken +
      '&limit=1&types=address,poi';
    const geoRes = await fetch(geoUrl);
    if (!geoRes.ok) throw new Error('Geocoding failed');
    const geoData = await geoRes.json();
    const [feature] = geoData.features ?? [];
    if (!feature) throw new Error('Address not found');
    [lng, lat] = feature.center as [number, number];
  } catch (err) {
    console.error('[parcel-lookup] geocoding error:', err);
    return NextResponse.json({ parcels: [], ownerMatch: false } satisfies ParcelLookupResponse);
  }

  // Step 2: Call Regrid for parcel data
  if (!regridToken) {
    // No Regrid key configured -- return empty so onboarding falls back to manual draw
    console.warn('[parcel-lookup] REGRID_API_KEY not set -- skipping parcel lookup');
    return NextResponse.json({ parcels: [], ownerMatch: false } satisfies ParcelLookupResponse);
  }

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
