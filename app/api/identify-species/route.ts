import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { auth } from '@clerk/nextjs/server';
import { getUserTier } from '@/lib/tier-server';
import { enforceAiLimit, releaseAiUsage } from '@/lib/rate-limit';
import { saveSpeciesId } from '@/lib/db/species-ids';

export const maxDuration = 60;

interface SpeciesResult {
  taxonId: number;
  commonName: string;
  scientificName: string;
  iconicTaxon: string;
  photoUrl: string | null;
  score: number;
  wikipedia: string | null;
  conservationStatus: string | null;
}

/**
 * POST /api/identify-species  (Steward plan and above)
 *
 * Accepts a base64-encoded image and returns the top species suggestions with
 * confidence scores.
 *
 * Primary: iNaturalist computer vision (needs INATURALIST_API_TOKEN — note these
 * tokens expire after 24 hours, so they are not a stable production credential).
 * Fallback: Claude vision, used when no token is set or iNaturalist rejects the
 * request, so Species ID keeps working either way.
 */
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  // Free gets a few IDs to try it; the monthly allowance in lib/rate-limit.ts decides.
  const tier = await getUserTier();

  const body = await req.json().catch(() => ({})) as {
    imageBase64: string;   // base64-encoded image (without data: prefix)
    mimeType?: string;     // e.g. "image/jpeg"
    lat?: number;
    lng?: number;
    thumbnail?: string;    // small data-URL thumbnail saved to the user's history
    propertyId?: string;
  };

  if (!body.imageBase64) {
    return NextResponse.json({ error: 'imageBase64 is required' }, { status: 400 });
  }

  const limited = await enforceAiLimit(userId, 'identify-species', tier);
  if (limited) return limited;

  // Keep a record for "Your recent identifications" (best-effort, never blocks the result)
  const save = (results: SpeciesResult[]) =>
    results.length > 0
      ? saveSpeciesId({ clerkUserId: userId, propertyId: body.propertyId, thumbnail: body.thumbnail, results })
      : Promise.resolve(null);

  const token = process.env.INATURALIST_API_TOKEN;
  if (token) {
    const inat = await identifyWithInaturalist(token, body);
    if (inat) return NextResponse.json({ results: inat, saved: await save(inat) });
  }

  try {
    const results = await identifyWithClaude(body.imageBase64, body.mimeType, body.lat, body.lng);
    return NextResponse.json({ results, saved: await save(results) });
  } catch (err) {
    console.error('[identify-species] Claude vision error:', err);
    await releaseAiUsage(userId, 'identify-species');
    return NextResponse.json({ error: 'Species identification failed. Please try another photo.' }, { status: 502 });
  }
}

async function identifyWithInaturalist(
  token: string,
  body: { imageBase64: string; mimeType?: string; lat?: number; lng?: number },
): Promise<SpeciesResult[] | null> {
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
      console.error('[identify-species] iNaturalist error, falling back to Claude:', inatRes.status, err);
      return null;
    }

    const data = await inatRes.json() as InatCVResponse;
    const results: SpeciesResult[] = (data.results ?? []).slice(0, 6).map((r) => ({
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

    return results;
  } catch (err) {
    console.error('[identify-species] iNaturalist request failed, falling back to Claude:', err);
    return null;
  }
}

const ICONIC_TAXA = [
  'Plantae', 'Aves', 'Mammalia', 'Reptilia', 'Amphibia', 'Insecta',
  'Fungi', 'Arachnida', 'Actinopterygii', 'Mollusca', 'Unknown',
];

async function identifyWithClaude(
  imageBase64: string,
  mimeType: string | undefined,
  lat?: number,
  lng?: number,
): Promise<SpeciesResult[]> {
  const mediaType = (['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(mimeType ?? '')
    ? mimeType
    : 'image/jpeg') as 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';

  const where = lat !== undefined && lng !== undefined
    ? `The photo was taken near latitude ${lat.toFixed(3)}, longitude ${lng.toFixed(3)} in North America. Prefer species found there.`
    : 'The photo was taken on rural land in North America.';

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 600,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
        {
          type: 'text',
          text: `Identify the main plant, animal, or fungus in this photo. ${where}
Return ONLY JSON (no markdown): {"results":[{"commonName":"","scientificName":"","iconicTaxon":"one of ${ICONIC_TAXA.join(', ')}","confidence":0-100}]}
Give up to 3 candidates, most likely first. Use honest confidence values. If nothing living is identifiable, return {"results":[]}.`,
        },
      ],
    }],
  });

  const text = message.content[0]?.type === 'text' ? message.content[0].text : '';
  const raw = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  const parsed = JSON.parse(raw) as {
    results?: { commonName?: string; scientificName?: string; iconicTaxon?: string; confidence?: number }[];
  };

  return (parsed.results ?? []).slice(0, 3).map((r, i) => {
    const scientificName = r.scientificName?.trim() || 'Unknown';
    return {
      taxonId: -(i + 1), // no iNaturalist taxon — negative ids keep React keys unique
      commonName: r.commonName?.trim() || scientificName,
      scientificName,
      iconicTaxon: ICONIC_TAXA.includes(r.iconicTaxon ?? '') ? r.iconicTaxon! : 'Unknown',
      photoUrl: null,
      score: Math.max(0, Math.min(100, Math.round(r.confidence ?? 0))),
      wikipedia: scientificName !== 'Unknown'
        ? `https://en.wikipedia.org/wiki/${encodeURIComponent(scientificName.replace(/ /g, '_'))}`
        : null,
      conservationStatus: null,
    };
  });
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
