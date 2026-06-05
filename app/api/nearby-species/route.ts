import { NextRequest, NextResponse } from 'next/server';

/**
 * GET /api/nearby-species?lat=X&lng=Y&radius=20
 *
 * Fetches species observed near a location from iNaturalist's public API.
 * No authentication required.
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat    = searchParams.get('lat');
  const lng    = searchParams.get('lng');
  const radius = searchParams.get('radius') ?? '20';

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  try {
    // Get species observed near the location, sorted by observation count
    const url = new URL('https://api.inaturalist.org/v1/observations/species_counts');
    url.searchParams.set('lat', lat);
    url.searchParams.set('lng', lng);
    url.searchParams.set('radius', radius);         // km
    url.searchParams.set('quality_grade', 'research'); // verified IDs only
    url.searchParams.set('per_page', '48');
    url.searchParams.set('order', 'desc');
    url.searchParams.set('order_by', 'count');

    const res = await fetch(url.toString(), {
      headers: { Accept: 'application/json' },
      next: { revalidate: 3600 }, // cache 1 hour
    });

    if (!res.ok) {
      throw new Error(`iNaturalist returned ${res.status}`);
    }

    const data = await res.json() as InatSpeciesCountsResponse;

    const species = (data.results ?? []).map((r) => ({
      taxonId:        r.taxon.id,
      commonName:     r.taxon.preferred_common_name ?? r.taxon.name,
      scientificName: r.taxon.name,
      iconicTaxon:    r.taxon.iconic_taxon_name ?? 'Unknown',
      photoUrl:       r.taxon.default_photo?.medium_url ?? null,
      observationCount: r.count,
      wikipedia:      r.taxon.wikipedia_url ?? null,
    }));

    return NextResponse.json({ species, total: data.total_results ?? species.length });
  } catch (err) {
    console.error('[nearby-species] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to fetch nearby species' },
      { status: 500 }
    );
  }
}

// ── iNaturalist species_counts response types ────────────────────────────
interface InatSpeciesCountsResponse {
  total_results?: number;
  results: {
    count: number;
    taxon: {
      id: number;
      name: string;
      preferred_common_name?: string;
      iconic_taxon_name?: string;
      wikipedia_url?: string;
      default_photo?: { medium_url: string };
    };
  }[];
}
