import intersect from '@turf/intersect';
import area from '@turf/area';
import { featureCollection, polygon } from '@turf/helpers';
import type { MultiPolygon, Polygon } from 'geojson';

export type AreaShape = Polygon | MultiPolygon;

/** Share of an outlined area that must sit inside the property line to be shown at all. */
const MIN_INSIDE_SHARE = 0.25;

function closed(ring: number[][]): number[][] {
  if (ring.length < 3) return ring;
  const [a, b] = [ring[0], ring[ring.length - 1]];
  return a[0] === b[0] && a[1] === b[1] ? ring : [...ring, ring[0]];
}

/**
 * Trim an outlined spot so only the part inside the property line is left.
 *
 * - No property line known: the outline is returned as-is.
 * - Less than a quarter of the outline is inside the line: returns null, because
 *   the spot is really on someone else's land (the map should not show it).
 */
export function clipToProperty(
  ring: number[][] | undefined | null,
  boundary: number[][][] | null | undefined,
): AreaShape | null {
  if (!ring || ring.length < 3) return null;
  const spotRing = closed(ring);
  if (spotRing.length < 4) return null;
  const propRing = boundary?.[0] && boundary[0].length >= 3 ? closed(boundary[0]) : null;

  try {
    const spot = polygon([spotRing]);
    if (!propRing || propRing.length < 4) return spot.geometry;
    const inside = intersect(featureCollection([spot, polygon([propRing])]));
    if (!inside) return null;
    const total = area(spot);
    if (total > 0 && area(inside) / total < MIN_INSIDE_SHARE) return null;
    return inside.geometry as AreaShape;
  } catch {
    // An outline the geometry library can't read (e.g. it crosses itself) — don't guess.
    return null;
  }
}

/** Every [lng, lat] point of a shape (for fitting the map camera). */
export function shapePoints(shape: AreaShape): number[][] {
  return shape.type === 'Polygon' ? shape.coordinates.flat() : shape.coordinates.flat(2);
}

/** Rough middle of the biggest piece of a shape (for a number pin). */
export function shapeCenter(shape: AreaShape): [number, number] {
  const rings = shape.type === 'Polygon' ? [shape.coordinates[0]] : shape.coordinates.map((p) => p[0]);
  const biggest = rings.reduce((best, r) => (r.length > best.length ? r : best), rings[0]);
  const pts = biggest.slice(0, -1);
  return [
    pts.reduce((s, p) => s + p[0], 0) / pts.length,
    pts.reduce((s, p) => s + p[1], 0) / pts.length,
  ];
}
