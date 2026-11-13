// Finding a property's location: address suggestions while typing, GPS
// coordinates, and turning either into a map spot + county/state.
//
// Uses Mapbox's Geocoding API v6 with the public NEXT_PUBLIC_MAPBOX_TOKEN (the
// same token the maps use), so it works both in the browser and on the server.
// US only — the soil, hardiness-zone and wildlife data behind the plans are US data.

const GEOCODE = 'https://api.mapbox.com/search/geocode/v6';

/** Where a property is, as precisely as we know it. */
export interface PlaceLocation {
  lng: number;
  lat: number;
  /** County without the word "County", e.g. "Somerset". */
  county?: string;
  /** Two-letter state, e.g. "PA". */
  state?: string;
}

/** One suggestion in the address box. */
export interface Place extends PlaceLocation {
  id: string;
  /** Main line, e.g. "168 Leister Road". */
  label: string;
  /** Second line, e.g. "Fairhope, Pennsylvania 15538". */
  detail: string;
  /** What gets saved as the property's address. */
  address: string;
  kind: string;
}

// ─── GPS coordinates ─────────────────────────────────────────────────────────

const NUM = String.raw`[-+]?\d{1,3}(?:\.\d+)?`;
// 40.44062, -79.99589  ·  40.44062 -79.99589  ·  40.44062° N, 79.99589° W
const DECIMAL = new RegExp(String.raw`^\s*(${NUM})\s*°?\s*([NnSs])?\s*[,;\s]\s*(${NUM})\s*°?\s*([EeWw])?`);
// 40°26'46"N 79°59'45"W  ·  40°26.767'N, 79°59.75'W
const DMS_PART = String.raw`(\d{1,3})\s*°\s*(\d{1,2}(?:\.\d+)?)\s*['′’]\s*(?:(\d{1,2}(?:\.\d+)?)\s*(?:["″”]|'')\s*)?([NnSsEeWw])`;
const DMS = new RegExp(String.raw`^\s*${DMS_PART}\s*[,;\s]\s*${DMS_PART}`);

export interface Coordinates {
  lat: number;
  lng: number;
  /** True when we added the minus sign a US longitude needs (people often drop it). */
  assumedWest?: boolean;
}

/**
 * Read GPS coordinates typed or pasted by a member. Latitude first, like Google
 * Maps and most GPS apps. With `allowTrailing`, text after the numbers is ignored
 * (e.g. a saved address like "39.84120, -78.95000 (near Berlin, PA)").
 */
export function parseCoordinates(text: string, { allowTrailing = false } = {}): Coordinates | null {
  if (!text) return null;
  const end = (m: RegExpMatchArray) => allowTrailing || !text.slice(m[0].length).trim();

  let lat: number, lng: number;
  let latHem: string | undefined, lngHem: string | undefined;

  const dms = text.match(DMS);
  if (dms && end(dms)) {
    const deg = (d: string, m: string, s?: string) => Number(d) + Number(m) / 60 + (s ? Number(s) / 3600 : 0);
    const a = { v: deg(dms[1], dms[2], dms[3]), h: dms[4].toUpperCase() };
    const b = { v: deg(dms[5], dms[6], dms[7]), h: dms[8].toUpperCase() };
    const [la, lo] = 'NS'.includes(a.h) ? [a, b] : [b, a];
    if (!'NS'.includes(la.h) || !'EW'.includes(lo.h)) return null;
    lat = la.v; lng = lo.v; latHem = la.h; lngHem = lo.h;
  } else {
    const m = text.match(DECIMAL);
    if (!m || !end(m)) return null;
    // Needs decimals or N/S/E/W — otherwise "12 34" could be part of an address
    const hasDecimals = m[1].includes('.') && m[3].includes('.');
    if (!hasDecimals && !m[2] && !m[4]) return null;
    lat = Number(m[1]); lng = Number(m[3]);
    latHem = m[2]?.toUpperCase(); lngHem = m[4]?.toUpperCase();
    // Longitude first by mistake (e.g. -79.99, 40.44 or -104.9, 39.7) — a US spot read
    // the other way round would be in Antarctica
    const usLngFirst = lat < -64 && lat >= -180 && lng > 17 && lng < 72;
    if (!latHem && !lngHem && ((Math.abs(lat) > 90 && Math.abs(lng) <= 90) || usLngFirst)) [lat, lng] = [lng, lat];
  }

  if (latHem === 'S') lat = -Math.abs(lat);
  if (latHem === 'N') lat = Math.abs(lat);
  if (lngHem === 'W') lng = -Math.abs(lng);
  if (lngHem === 'E') lng = Math.abs(lng);

  let assumedWest = false;
  // A US spot typed without the minus sign on the longitude
  if (!lngHem && lng > 64 && lng <= 180 && lat > 17 && lat < 72) { lng = -lng; assumedWest = true; }

  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return assumedWest ? { lat, lng, assumedWest } : { lat, lng };
}

// ─── Mapbox results → our shape ──────────────────────────────────────────────

interface MapboxFeature {
  id?: string;
  geometry?: { coordinates?: [number, number] };
  properties?: {
    mapbox_id?: string;
    feature_type?: string;
    name?: string;
    name_preferred?: string;
    place_formatted?: string;
    full_address?: string;
    coordinates?: { longitude?: number; latitude?: number };
    context?: {
      place?: { name?: string };
      locality?: { name?: string };
      district?: { name?: string };
      region?: { name?: string; region_code?: string };
    };
  };
}

const noCountry = (s: string) => s.replace(/,?\s*United States$/, '').trim();
const countyName = (s?: string) => s?.replace(/\s+(County|Parish|Borough|Census Area|Municipality)$/i, '').trim() || undefined;

export function placeFromFeature(f: MapboxFeature): Place | null {
  const p = f.properties ?? {};
  const lng = p.coordinates?.longitude ?? f.geometry?.coordinates?.[0];
  const lat = p.coordinates?.latitude ?? f.geometry?.coordinates?.[1];
  const label = p.name_preferred || p.name;
  if (typeof lng !== 'number' || typeof lat !== 'number' || !label) return null;
  const detail = noCountry(p.place_formatted ?? '');
  const kind = p.feature_type ?? 'place';
  const ctx = p.context ?? {};
  return {
    id: p.mapbox_id ?? f.id ?? `${lng},${lat}`,
    label,
    detail,
    address: p.full_address ? noCountry(p.full_address) : [label, detail].filter(Boolean).join(', '),
    kind,
    lng,
    lat,
    county: kind === 'district' ? countyName(label) : countyName(ctx.district?.name),
    state: ctx.region?.region_code ?? ctx.region?.name,
  };
}

async function getFeatures(url: string, signal?: AbortSignal): Promise<MapboxFeature[]> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Mapbox ${res.status}`);
  const data = (await res.json()) as { features?: MapboxFeature[] };
  return data.features ?? [];
}

// ─── Lookups ─────────────────────────────────────────────────────────────────

/** Suggestions while typing. `nearMe` favors results near the person typing. */
export async function searchPlaces(
  query: string,
  token: string,
  { signal, nearMe = true, limit = 5, autocomplete = true }: { signal?: AbortSignal; nearMe?: boolean; limit?: number; autocomplete?: boolean } = {},
): Promise<Place[]> {
  const q = query.trim();
  if (q.length < 3) return [];
  const params = new URLSearchParams({
    q,
    access_token: token,
    autocomplete: String(autocomplete),
    country: 'us',
    language: 'en',
    limit: String(limit),
    types: 'address,street,place,locality,neighborhood,postcode',
  });
  if (nearMe) params.set('proximity', 'ip');
  const features = await getFeatures(`${GEOCODE}/forward?${params}`, signal);
  return features.map(placeFromFeature).filter((p): p is Place => !!p);
}

/** The town, county and state around a spot (null if it isn't in the US). */
export async function nearestTown(lat: number, lng: number, token: string, signal?: AbortSignal): Promise<Place | null> {
  const params = new URLSearchParams({
    longitude: String(lng),
    latitude: String(lat),
    access_token: token,
    country: 'us',
    language: 'en',
    types: 'place,locality,district,region',
  });
  const places = (await getFeatures(`${GEOCODE}/reverse?${params}`, signal))
    .map(placeFromFeature)
    .filter((p): p is Place => !!p);
  return places.find((p) => p.kind === 'place' || p.kind === 'locality') ?? places[0] ?? null;
}

/** A suggestion for coordinates the member typed, named after the nearest town. */
export function coordinatePlace(c: Coordinates, near: Place | null): Place {
  const label = `${c.lat.toFixed(5)}, ${c.lng.toFixed(5)}`;
  const town = near && (near.kind === 'place' || near.kind === 'locality') ? near.label : null;
  const where = [town, near?.county ? `${near.county} County` : null, near?.state].filter(Boolean).join(', ');
  return {
    id: `coords:${label}`,
    label,
    detail: where ? `GPS spot near ${where}` : 'GPS spot — we couldn’t find a US town nearby, double-check the numbers',
    address: where ? `${label} (near ${[town, near?.state].filter(Boolean).join(', ')})` : label,
    kind: 'coordinates',
    lat: c.lat,
    lng: c.lng,
    county: near?.county,
    state: near?.state,
  };
}

/**
 * Best single location for a saved address: coordinates at the start of the text
 * win (no guessing), otherwise Mapbox's top match. Never throws.
 */
export async function locateAddress(address: string, token: string | undefined): Promise<PlaceLocation | null> {
  const coords = parseCoordinates(address, { allowTrailing: true });
  if (!token) return coords ? { lat: coords.lat, lng: coords.lng } : null;
  try {
    if (coords) {
      const near = await nearestTown(coords.lat, coords.lng, token);
      return { lat: coords.lat, lng: coords.lng, county: near?.county, state: near?.state };
    }
    const [best] = await searchPlaces(address, token, { nearMe: false, limit: 1, autocomplete: false });
    return best ? { lat: best.lat, lng: best.lng, county: best.county, state: best.state } : null;
  } catch {
    return coords ? { lat: coords.lat, lng: coords.lng } : null;
  }
}

/** A location sent by the browser, checked. */
export function cleanLocation(v: unknown): PlaceLocation | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  const num = (x: unknown) => (typeof x === 'number' ? x : typeof x === 'string' && x.trim() ? Number(x) : NaN);
  const lat = num(o.lat), lng = num(o.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const text = (x: unknown) => (typeof x === 'string' && x.trim() ? x.trim().slice(0, 80) : undefined);
  return { lat, lng, county: text(o.county), state: text(o.state) };
}
