/**
 * Satellite photos of a property from the Mapbox Static Images API.
 *
 * The photo is requested by center + zoom (not by bounding box) so its exact
 * edges are known. That lets us turn a spot the AI marks on the photo (pixel
 * x/y) back into real map coordinates (lng/lat) for highlighting on the map.
 */

export const SATELLITE_SIZE = 800; // photo is SATELLITE_SIZE × SATELLITE_SIZE pixels
const TILE = 512;                  // Mapbox static API tile size at zoom 0
const MAX_ZOOM = 19;

// Web Mercator helpers — x, y in 0..1 across the whole world (y grows southward)
const lngToX = (lng: number) => (lng + 180) / 360;
const latToY = (lat: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
};
const xToLng = (x: number) => x * 360 - 180;
const yToLat = (y: number) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;

export interface SatelliteSnapshot {
  /** Base64 JPEG/PNG. */
  base64: string;
  /** Whether the property line is drawn on the photo (yellow). */
  hasOutline: boolean;
  /** Convert a pixel on the photo (x from left, y from top) to [lng, lat]. */
  toLngLat: (px: number, py: number) => [number, number];
}

function outerRing(boundary: number[][][] | number[][] | null | undefined): number[][] | null {
  const ring = Array.isArray(boundary?.[0]?.[0])
    ? (boundary as number[][][])[0]
    : Array.isArray(boundary?.[0])
      ? (boundary as unknown as number[][])
      : null;
  return ring && ring.length >= 3 ? ring : null;
}

export async function fetchSatelliteSnapshot(
  boundary: number[][][] | number[][] | null | undefined,
  fallbackCoords?: { lat: number; lng: number },
): Promise<SatelliteSnapshot | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  try {
    const ring = outerRing(boundary);
    let minX: number, maxX: number, minY: number, maxY: number;

    if (ring) {
      const xs = ring.map((c) => lngToX(c[0]));
      const ys = ring.map((c) => latToY(c[1]));
      minX = Math.min(...xs); maxX = Math.max(...xs);
      minY = Math.min(...ys); maxY = Math.max(...ys);
    } else if (fallbackCoords) {
      // ~0.3-mile box around the geocoded point when there is no property line
      const cx = lngToX(fallbackCoords.lng), cy = latToY(fallbackCoords.lat);
      const half = lngToX(fallbackCoords.lng + 0.004) - cx;
      minX = cx - half; maxX = cx + half; minY = cy - half; maxY = cy + half;
    } else {
      return null;
    }

    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    // Fit the property with ~15% margin on each side
    const span = Math.max(maxX - minX, maxY - minY, 1e-7) * 1.3;
    const zoom = Math.min(MAX_ZOOM, Math.floor(Math.log2(SATELLITE_SIZE / (TILE * span)) * 100) / 100);
    const worldPx = TILE * Math.pow(2, zoom); // world width in pixels at this zoom

    const centerLng = xToLng(cx);
    const centerLat = yToLat(cy);
    const view = `${centerLng.toFixed(6)},${centerLat.toFixed(6)},${zoom}`;
    const query = `access_token=${token}&attribution=false&logo=false`;
    const base = 'https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static';

    // Draw the property line in yellow so the AI knows exactly which land is the owner's.
    // Long boundaries are thinned so the URL stays under Mapbox's length limit.
    let overlay = '';
    if (ring) {
      const step = Math.max(1, Math.ceil(ring.length / 120));
      const pts = ring.filter((_, i) => i % step === 0).map((c) => [+c[0].toFixed(5), +c[1].toFixed(5)]);
      pts.push(pts[0]);
      const feature = {
        type: 'Feature',
        properties: { stroke: '#ffd400', 'stroke-width': 3, 'stroke-opacity': 1, 'fill-opacity': 0 },
        geometry: { type: 'Polygon', coordinates: [pts] },
      };
      overlay = `geojson(${encodeURIComponent(JSON.stringify(feature))})/`;
    }

    let hasOutline = !!overlay;
    let res = await fetch(`${base}/${overlay}${view}/${SATELLITE_SIZE}x${SATELLITE_SIZE}?${query}`);
    if (!res.ok && overlay) {
      // Fall back to a plain photo if the outline couldn't be drawn
      hasOutline = false;
      res = await fetch(`${base}/${view}/${SATELLITE_SIZE}x${SATELLITE_SIZE}?${query}`);
    }
    if (!res.ok) {
      console.warn('[satellite] Mapbox Static API returned', res.status);
      return null;
    }

    const base64 = Buffer.from(await res.arrayBuffer()).toString('base64');
    const toLngLat = (px: number, py: number): [number, number] => [
      +xToLng(cx + (px - SATELLITE_SIZE / 2) / worldPx).toFixed(7),
      +yToLat(cy + (py - SATELLITE_SIZE / 2) / worldPx).toFixed(7),
    ];
    return { base64, hasOutline, toLngLat };
  } catch (err) {
    console.warn('[satellite] Failed to fetch satellite image:', err);
    return null;
  }
}

/** Back-compat: just the base64 photo. */
export async function fetchSatelliteImage(
  boundary: number[][][] | number[][] | null | undefined,
  fallbackCoords?: { lat: number; lng: number },
): Promise<string | null> {
  return (await fetchSatelliteSnapshot(boundary, fallbackCoords))?.base64 ?? null;
}

/**
 * Turn an outline the AI traced on the photo (pixel points) into a closed
 * [lng, lat] ring for the map. Returns undefined if the outline is unusable.
 */
export function ringFromPixels(
  snapshot: SatelliteSnapshot | null | undefined,
  areaPixels: unknown,
): number[][] | undefined {
  if (!snapshot || !Array.isArray(areaPixels)) return undefined;
  const pts = (areaPixels as unknown[]).filter(
    (p): p is number[] =>
      Array.isArray(p) && p.length >= 2 &&
      Number.isFinite(p[0]) && Number.isFinite(p[1]) &&
      p[0] >= 0 && p[0] <= SATELLITE_SIZE && p[1] >= 0 && p[1] <= SATELLITE_SIZE
  );
  if (pts.length < 3) return undefined;
  const ring = pts.map((p) => snapshot.toLngLat(p[0], p[1]));
  ring.push(ring[0]);
  return ring;
}

/** Prompt text explaining the photo, shared by every AI call that gets one. */
export function photoIntro(hasOutline: boolean): string {
  return `SATELLITE PHOTO:
The attached image is a current satellite photo of this property, ${SATELLITE_SIZE} × ${SATELLITE_SIZE} pixels. North is at the top, east is on the right.${hasOutline ? ' The property line is drawn in yellow. Only describe land inside it.' : ' The exact property line is not known; the property is near the center of the photo.'}
Study it closely before writing: find the house and outbuildings, the driveway and road frontage, the tree lines, open fields, fence rows, ponds, creeks, low wet-looking spots, and any bare or eroded areas. Base every location on what you actually see. Do not describe woods, water, or fields that are not in the photo.`;
}

/** Prompt rules for tracing a spot on the photo, shared by every AI call that gets one. */
export const AREA_PIXEL_RULES = `RULES FOR "areaPixels" (we draw this outline on the owner's map, so it must sit on the right spot in the photo):
- Trace the outline of the exact area where the work happens, as 4–12 [x, y] pixel points going around its edge. x is pixels from the LEFT edge of the photo (0–${SATELLITE_SIZE}), y is pixels from the TOP edge (0–${SATELLITE_SIZE}).
- Follow what you see: the edge of the tree line, the shape of the field, the bank of the pond. For a long strip (fence row, woods edge, creek bank) trace a thin shape along it. For a single spot (a nest box, a brush pile) trace a small shape around where it goes.
- Keep it inside the yellow property line when one is drawn.
- It must match the written location. If the work truly covers the whole property, trace the property line.`;

/** Image block for the Anthropic API. */
export function photoBlock(base64: string) {
  return {
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: (base64.startsWith('iVBOR') ? 'image/png' : 'image/jpeg') as 'image/png' | 'image/jpeg',
      data: base64,
    },
  };
}
