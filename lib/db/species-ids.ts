import { and, desc, eq } from 'drizzle-orm';
import { getDb } from './client';
import { speciesIds } from './schema';
import { getOwnedProperty } from './ownership';

const MAX_THUMBNAIL_CHARS = 200_000; // ~150 KB image; real thumbnails are ~20 KB
const RECENT_LIMIT = 30;

export interface SavedSpeciesId {
  id: string;
  propertyId: string | null;
  thumbnail: string | null;
  commonName: string;
  scientificName: string | null;
  iconicTaxon: string | null;
  score: number | null;
  results: Record<string, unknown>[];
  createdAt: string;
}

type Row = typeof speciesIds.$inferSelect;

function toSaved(row: Row): SavedSpeciesId {
  return {
    id: row.id,
    propertyId: row.propertyId,
    thumbnail: row.thumbnail,
    commonName: row.commonName,
    scientificName: row.scientificName,
    iconicTaxon: row.iconicTaxon,
    score: row.score,
    results: row.results,
    createdAt: row.createdAt.toISOString(),
  };
}

/**
 * Save an identification to the user's history. Never throws — if the
 * species_ids table doesn't exist yet the ID still works, it just isn't saved.
 */
export async function saveSpeciesId(input: {
  clerkUserId: string;
  propertyId?: string;
  thumbnail?: string;
  results: Array<{ commonName: string; scientificName?: string; iconicTaxon?: string; score?: number }>;
}): Promise<SavedSpeciesId | null> {
  const top = input.results[0];
  if (!top) return null;
  try {
    const thumbnail =
      typeof input.thumbnail === 'string' &&
      input.thumbnail.startsWith('data:image/') &&
      input.thumbnail.length <= MAX_THUMBNAIL_CHARS
        ? input.thumbnail
        : null;
    // Only link to a property the user actually owns
    const propertyId =
      input.propertyId && (await getOwnedProperty(input.clerkUserId, input.propertyId))
        ? input.propertyId
        : null;

    const [row] = await getDb()
      .insert(speciesIds)
      .values({
        clerkUserId: input.clerkUserId,
        propertyId,
        thumbnail,
        commonName: top.commonName,
        scientificName: top.scientificName ?? null,
        iconicTaxon: top.iconicTaxon ?? null,
        score: typeof top.score === 'number' ? top.score : null,
        results: input.results as unknown as Record<string, unknown>[],
      })
      .returning();
    return row ? toSaved(row) : null;
  } catch (err) {
    console.warn('[species-ids] not saved (is the species_ids table created?):', err instanceof Error ? err.message : err);
    return null;
  }
}

export async function listSpeciesIds(clerkUserId: string): Promise<SavedSpeciesId[]> {
  try {
    const rows = await getDb()
      .select()
      .from(speciesIds)
      .where(eq(speciesIds.clerkUserId, clerkUserId))
      .orderBy(desc(speciesIds.createdAt))
      .limit(RECENT_LIMIT);
    return rows.map(toSaved);
  } catch (err) {
    console.warn('[species-ids] list failed:', err instanceof Error ? err.message : err);
    return [];
  }
}

export async function deleteSpeciesId(clerkUserId: string, id: string): Promise<boolean> {
  const rows = await getDb()
    .delete(speciesIds)
    .where(and(eq(speciesIds.id, id), eq(speciesIds.clerkUserId, clerkUserId)))
    .returning({ id: speciesIds.id });
  return rows.length > 0;
}
