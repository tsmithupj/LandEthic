import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/identify-species
 *
 * Accepts a base64-encoded image and sends it to iNaturalist's computer vision
 * API to identify the species. Returns the top suggestions with confidence scores.
 *
 * Requires: INATURALIST_API_TOKEN in .env.local
 * Get your token at: https://www.inaturalist.org/users/api_token
 */
export async function POST(req: NextRequest) {
  const token = process.env.INATURALIST_API_TOKEN;
  if (!token) {
    return NextResponse.json(
      { error: 'INATURALIST_API_TOKEN not set in .env.local. Get yours at https://www.inaturalist.org/users/api_token' },
      { status: 503 }
    );
  }

  const body = await req.json() as {
    imageBase64: string;   // base64-encoded image (without data: prefix)
    mimeType?: string;     // e.g. "image/jpeg"
    lat?: number;
    lng?: number;
  };

  if (!body.imageBase64) {
    return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 });
  }

  try {
    // Convert base64 → Blob for multipart upload
    const mimeType = body.mimeType ?? 'image/jpeg';
    const imageBytes = Buffer.from(body.imageBase64, 'base64');
    const blob = new Blob([imageBytes], { type: mimeType });

    const form = new FormData();
    form.append('image', blob, 'photo.jpg');

    // Optional: include location to improve accuracy
    if (body.lat !== undefined && body.lng !== undefined) {
      form.append('lat', String(body.lat));
      form.append('lng', String(body.lng));
    }

    const inatRes = await fetch('https://api.inaturalist.org/v1/computervision/score_image', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        // Don't set Content-Type — let fetch set the multipart boundary
      },
      body: form,
    });

    if (!inatRes.ok) {
      const err = await inatRes.text();
      console.error('[identify-species] iNaturalist error:', inatRes.status, err);
      return NextResponse.json(
        { error: `iNaturalist API error ${inatRes.status}: ${err}` },
        { status: 502 }
      );
    }

    const data = await inatRes.json() as InatCVResponse;
    const results = (data.results ?? []).slice(0, 6).map((r) => ({
      taxonId:        r.taxon.id,
      commonName:     r.taxon.preferred_common_name ?? r.taxon.name,
      scientificName: r.taxon.name,
      iconicTaxon:    r.taxon.iconic_taxon_name ?? 'Unknown',
      photoUrl:       r.taxon.default_photo?.medium_url ?? null,
      score:          Math.round((r.combined_score ?? r.score ?? 0) * 100),
      wikipedia:      r.taxon.wikipedia_url ?? null,
      // iNaturalist marks native/introduced at observation level, not CV result
      // We include the conservation status if available
      conservationStatus: r.taxon.conservation_status?.status_name ?? null,
    }));

    return NextResponse.json({ results });
  } catch (err) {
    console.error('[identify-species] error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Species identification failed' },
      { status: 500 }
    );
  }
}

// ── iNaturalist CV response types ──────────────────────────────────────────
interface InatCVResponse {
  results: InatCVResult[];
}

interface InatCVResult {
  combined_score?: number;
  score?: number;
  taxon: {
    id: number;
    name: string;
    preferred_common_name?: string;
    iconic_taxon_name?: string;
    wikipedia_url?: string;
    default_photo?: { medium_url: string };
    conservation_status?: { status_name: string };
  };
}
