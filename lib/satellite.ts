/**
 * Fetches a satellite image of a property's bounding box from the Mapbox Static Images API.
 * Returns the image as a base64-encoded string (PNG), or null if unavailable.
 *
 * The image coordinate system:
 *   Left  = west  (xMin = 0.0 in zoneRect)
 *   Right = east  (xMax = 1.0 in zoneRect)
 *   Top   = north (yMax = 1.0 in zoneRect)
 *   Bottom= south (yMin = 0.0 in zoneRect)
 */
export async function fetchSatelliteImage(
  boundary: number[][][] | number[][] | null | undefined,
  fallbackCoords?: { lat: number; lng: number },
): Promise<string | null> {
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  if (!token) return null;

  try {
    let west: number, south: number, east: number, north: number;

    // Determine bbox from drawn boundary or geocoded point
    const ring = Array.isArray(boundary?.[0]?.[0])
      ? (boundary as number[][][])[0]          // number[][][]
      : Array.isArray(boundary?.[0])
        ? (boundary as unknown as number[][])  // number[][]
        : null;

    if (ring && ring.length >= 3) {
      const lngs = ring.map((c) => c[0]);
      const lats  = ring.map((c) => c[1]);
      west  = Math.min(...lngs);
      east  = Math.max(...lngs);
      south = Math.min(...lats);
      north = Math.max(...lats);

      // Add a small padding so the property doesn't fill edge-to-edge
      const padLng = (east  - west)  * 0.15;
      const padLat = (north - south) * 0.15;
      west  -= padLng; east  += padLng;
      south -= padLat; north += padLat;
    } else if (fallbackCoords) {
      // ~0.3-mile radius around geocoded point when no boundary is drawn
      const delta = 0.004;
      west  = fallbackCoords.lng - delta;
      east  = fallbackCoords.lng + delta;
      south = fallbackCoords.lat - delta;
      north = fallbackCoords.lat + delta;
    } else {
      return null;
    }

    // Mapbox Static Images API — satellite-v9 style, 800×800 JPEG (default format from Mapbox)
    const bboxParam = `[${west},${south},${east},${north}]`;
    const url = `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/static/${bboxParam}/800x800?access_token=${token}&attribution=false&logo=false`;

    const res = await fetch(url);
    if (!res.ok) {
      console.warn('[satellite] Mapbox Static API returned', res.status);
      return null;
    }

    const buffer = await res.arrayBuffer();
    const base64 = Buffer.from(buffer).toString('base64');
    return base64;
  } catch (err) {
    console.warn('[satellite] Failed to fetch satellite image:', err);
    return null;
  }
}
