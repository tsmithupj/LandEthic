'use client';

import { useEffect, useRef, useState } from 'react';
import type { InsightZone } from '@/lib/store';

interface DashboardMapProps {
  boundary: number[][][] | null;
  address: string;
  propertyName: string;
  acreage?: number;
  county?: string;
  state?: string;
  activeZone?: InsightZone | null;
  activeZoneLabel?: string | null;
  activeZoneType?: 'positive' | 'warning' | 'opportunity' | null;
  height?: number;
  propertyId?: string;
  autoFlyover?: boolean;
}

// ── Sutherland-Hodgman polygon clipping ─────────────────────────────────────
// Clips a subject polygon to a convex (or near-convex) clip polygon.
// Returns the clipped ring, or the original if clipping fails/reduces to nothing.

function isLeftOf(a: number[], b: number[], p: number[]): boolean {
  return (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0]) >= 0;
}

function segIntersect(p1: number[], p2: number[], p3: number[], p4: number[]): number[] | null {
  const d1x = p2[0] - p1[0], d1y = p2[1] - p1[1];
  const d2x = p4[0] - p3[0], d2y = p4[1] - p3[1];
  const cross = d1x * d2y - d1y * d2x;
  if (Math.abs(cross) < 1e-12) return null;
  const t = ((p3[0] - p1[0]) * d2y - (p3[1] - p1[1]) * d2x) / cross;
  return [p1[0] + t * d1x, p1[1] + t * d1y];
}

function clipPolygon(subject: number[][], clip: number[][]): number[][] {
  let output = subject.slice(0, subject.length - 1); // drop closing coord
  const n = clip.length - 1; // clip ring length (closing coord excluded)

  for (let i = 0; i < n; i++) {
    if (output.length === 0) return [];
    const input = output.slice();
    output = [];
    const a = clip[i];
    const b = clip[(i + 1) % n];

    for (let j = 0; j < input.length; j++) {
      const curr = input[j];
      const prev = input[(j + input.length - 1) % input.length];
      const currIn = isLeftOf(a, b, curr);
      const prevIn = isLeftOf(a, b, prev);

      if (currIn) {
        if (!prevIn) {
          const ix = segIntersect(prev, curr, a, b);
          if (ix) output.push(ix);
        }
        output.push(curr);
      } else if (prevIn) {
        const ix = segIntersect(prev, curr, a, b);
        if (ix) output.push(ix);
      }
    }
  }

  if (output.length < 3) return subject; // clipping failed, use original
  return [...output, output[0]]; // close ring
}

// ── Zone sub-polygon (bbox subdivision for insight highlights) ───────────────
function getZonePolygon(coords: number[][], zone: InsightZone): number[][] {
  const lngs = coords.map((c) => c[0]);
  const lats  = coords.map((c) => c[1]);
  const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
  const minLat = Math.min(...lats),  maxLat = Math.max(...lats);
  const midLng = (minLng + maxLng) / 2;
  const midLat = (minLat + maxLat) / 2;

  const p: Record<InsightZone, number[][]> = {
    full:     [[minLng,minLat],[maxLng,minLat],[maxLng,maxLat],[minLng,maxLat],[minLng,minLat]],
    north:    [[minLng,midLat],[maxLng,midLat],[maxLng,maxLat],[minLng,maxLat],[minLng,midLat]],
    south:    [[minLng,minLat],[maxLng,minLat],[maxLng,midLat],[minLng,midLat],[minLng,minLat]],
    east:     [[midLng,minLat],[maxLng,minLat],[maxLng,maxLat],[midLng,maxLat],[midLng,minLat]],
    west:     [[minLng,minLat],[midLng,minLat],[midLng,maxLat],[minLng,maxLat],[minLng,minLat]],
    center:   [
      [minLng+(maxLng-minLng)*0.25, minLat+(maxLat-minLat)*0.25],
      [minLng+(maxLng-minLng)*0.75, minLat+(maxLat-minLat)*0.25],
      [minLng+(maxLng-minLng)*0.75, minLat+(maxLat-minLat)*0.75],
      [minLng+(maxLng-minLng)*0.25, minLat+(maxLat-minLat)*0.75],
      [minLng+(maxLng-minLng)*0.25, minLat+(maxLat-minLat)*0.25],
    ],
    perimeter:[[minLng,minLat],[maxLng,minLat],[maxLng,maxLat],[minLng,maxLat],[minLng,minLat]],
  };
  return p[zone] ?? p.full;
}

export default function DashboardMap({
  boundary,
  address,
  propertyName,
  acreage,
  county,
  state,
  activeZone,
  activeZoneLabel,
  activeZoneType,
  height = 320,
  propertyId,
  autoFlyover = true,
}: DashboardMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<any>(null);
  const animFrameRef = useRef<number | null>(null);

  // Keep zone props in refs so they're always current inside async callbacks
  const activeZoneRef    = useRef(activeZone);
  const activeZoneTypeRef= useRef(activeZoneType);
  const boundaryRef      = useRef(boundary);

  useEffect(() => { activeZoneRef.current    = activeZone;    }, [activeZone]);
  useEffect(() => { activeZoneTypeRef.current= activeZoneType;}, [activeZoneType]);
  useEffect(() => { boundaryRef.current      = boundary;      }, [boundary]);

  const [is3D,     setIs3D]     = useState(false);
  const [animating,setAnimating]= useState(false);
  const [loaded,   setLoaded]   = useState(false);

  // ── Core highlight-drawing function ─────────────────────────────────────
  function drawZoneHighlight(map: any) {
    if (!map) return;

    // Clear stale layers
    if (map.getLayer('zone-highlight-fill')) map.removeLayer('zone-highlight-fill');
    if (map.getLayer('zone-highlight-line')) map.removeLayer('zone-highlight-line');
    if (map.getSource('zone-highlight'))     map.removeSource('zone-highlight');

    const bnd = boundaryRef.current;
    if (!bnd?.[0]) return;

    const propRing = bnd[0]; // outer ring of property polygon
    const lngs = propRing.map((c: number[]) => c[0]);
    const lats  = propRing.map((c: number[]) => c[1]);
    const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
    const minLat = Math.min(...lats),  maxLat = Math.max(...lats);
    const spanLng = maxLng - minLng;
    const spanLat = maxLat - minLat;

    const az  = activeZoneRef.current;
    const azt = activeZoneTypeRef.current;

    let rawPolygon: number[][] | null = null;
    let color: string;
    let fillOpacity = 0.28;
    let lineWidth = 2.5;
    let dashed = false;
    let geojsonCoords: number[][][];

    if (az) {
      // ── Insight zone (bbox subdivision, type-colored, dashed) ────────────
      const zoneRaw = getZonePolygon(propRing, az);
      const clipped = clipPolygon(zoneRaw, propRing);
      rawPolygon = clipped;

      color =
        azt === 'positive'    ? '#97C459' :
        azt === 'warning'     ? '#F59E0B' :
        azt === 'opportunity' ? '#38BDF8' :
                                '#97C459';
      dashed = true;

      // Perimeter: add a hole so it looks like a ring instead of full overlay
      if (az === 'perimeter') {
        const inset = 0.18;
        const innerRing = [
          [minLng+spanLng*inset, minLat+spanLat*inset],
          [maxLng-spanLng*inset, minLat+spanLat*inset],
          [maxLng-spanLng*inset, maxLat-spanLat*inset],
          [minLng+spanLng*inset, maxLat-spanLat*inset],
          [minLng+spanLng*inset, minLat+spanLat*inset],
        ];
        geojsonCoords = [rawPolygon, innerRing];
      } else {
        geojsonCoords = [rawPolygon];
      }
    } else {
      return; // nothing to draw
    }

    map.addSource('zone-highlight', {
      type: 'geojson',
      data: {
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: geojsonCoords },
        properties: {},
      },
    });

    map.addLayer({
      id: 'zone-highlight-fill',
      type: 'fill',
      source: 'zone-highlight',
      paint: { 'fill-color': color, 'fill-opacity': fillOpacity },
    });

    const linePaint: Record<string, unknown> = { 'line-color': color, 'line-width': lineWidth };
    if (dashed) linePaint['line-dasharray'] = [3, 2];

    map.addLayer({
      id: 'zone-highlight-line',
      type: 'line',
      source: 'zone-highlight',
      paint: linePaint,
    });

    // Gently pan map toward the highlighted area's center
    if (rawPolygon && rawPolygon.length > 1) {
      const pts = rawPolygon.slice(0, -1); // drop closing coord
      const cLng = pts.reduce((s, c) => s + c[0], 0) / pts.length;
      const cLat = pts.reduce((s, c) => s + c[1], 0) / pts.length;
      map.easeTo({ center: [cLng, cLat], duration: 700, zoom: map.getZoom() });
    }
  }

  // ── Geocode fallback if no boundary ─────────────────────────────────────
  async function geocodeAddress(token: string): Promise<[number, number]> {
    try {
      const res = await fetch(
        `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address)}.json?access_token=${token}&types=address,place&limit=1`
      );
      const data = await res.json();
      return data.features?.[0]?.center ?? [-87.08, 35.61];
    } catch {
      return [-87.08, 35.61];
    }
  }

  // ── Fly-around animation ────────────────────────────────────────────────
  function startFlyAround(map: any, centerLng: number, centerLat: number) {
    setAnimating(true);
    setIs3D(true);

    let startTime: number | null = null;
    const duration  = 14000;
    const startBear = map.getBearing();

    function animate(ts: number) {
      if (!startTime) startTime = ts;
      const prog = Math.min((ts - startTime) / duration, 1);

      let pitch: number, bearing: number;
      if (prog < 0.15) {
        pitch   = (prog / 0.15) * 62;
        bearing = startBear;
      } else if (prog < 0.85) {
        pitch   = 62;
        bearing = startBear + ((prog - 0.15) / 0.70) * 360;
      } else {
        pitch   = 62 * (1 - (prog - 0.85) / 0.15);
        bearing = startBear + 360;
      }

      map.setPitch(pitch);
      map.setBearing(bearing);

      if (prog < 1) {
        animFrameRef.current = requestAnimationFrame(animate);
      } else {
        map.easeTo({ pitch: 0, bearing: 0, duration: 600 });
        setAnimating(false);
        setIs3D(false);
      }
    }

    animFrameRef.current = requestAnimationFrame(animate);
  }

  // ── Map init ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) return;

    let map: any;

    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      mapboxgl.accessToken = token;

      let center: [number, number];
      let bounds: [[number, number], [number, number]] | null = null;

      const bnd = boundaryRef.current;
      if (bnd?.[0]) {
        const lngs = bnd[0].map((c: number[]) => c[0]);
        const lats  = bnd[0].map((c: number[]) => c[1]);
        const minLng = Math.min(...lngs), maxLng = Math.max(...lngs);
        const minLat = Math.min(...lats),  maxLat = Math.max(...lats);
        bounds = [[minLng, minLat], [maxLng, maxLat]];
        center = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
      } else {
        center = await geocodeAddress(token);
      }

      map = new mapboxgl.Map({
        container: mapContainer.current!,
        style:     'mapbox://styles/mapbox/satellite-streets-v12',
        center,
        zoom:      bounds ? 14 : 13,
        pitch:     0,
        bearing:   0,
        antialias: true,
      });

      map.on('load', () => {
        // Terrain
        map.addSource('mapbox-dem', {
          type: 'raster-dem',
          url: 'mapbox://mapbox.mapbox-terrain-dem-v1',
          tileSize: 512,
          maxzoom: 14,
        });
        map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.8 });

        // Atmosphere
        map.setFog({
          color: 'rgba(186,210,235,0.5)',
          'high-color': '#245bde',
          'horizon-blend': 0.02,
          'space-color': '#1d2b4f',
          'star-intensity': 0.3,
        });

        // Property boundary
        const bnd = boundaryRef.current;
        if (bnd?.[0]) {
          map.addSource('property', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: bnd },
              properties: {},
            },
          });
          map.addLayer({
            id: 'property-fill',
            type: 'fill',
            source: 'property',
            paint: { 'fill-color': '#3B6D11', 'fill-opacity': 0.2 },
          });
          map.addLayer({
            id: 'property-outline',
            type: 'line',
            source: 'property',
            paint: { 'line-color': '#97C459', 'line-width': 2.5 },
          });
          if (bounds) {
            map.fitBounds(bounds, { padding: 60, duration: 800, maxZoom: 16 });
          }
        }

        mapRef.current = map;
        setLoaded(true);

        // Draw zone highlight immediately — using refs so we always have
        // the latest prop values regardless of React render timing
        drawZoneHighlight(map);

        // Flyover logic
        const [lng, lat] = bounds
          ? [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]
          : center;

        const flyKey    = propertyId ? `landethic_flyover_${propertyId}` : null;
        const seen      = flyKey ? !!localStorage.getItem(flyKey) : false;
        const shouldFly = autoFlyover && !seen;

        if (shouldFly) {
          if (flyKey) localStorage.setItem(flyKey, '1');
          setTimeout(() => startFlyAround(map, lng, lat), 1200);
        }
      });
    })();

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-draw zone highlight when props change after map is loaded ─────────
  useEffect(() => {
    if (!loaded) return;
    drawZoneHighlight(mapRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeZone, activeZoneType, loaded]);

  // ── Toggle 3D ────────────────────────────────────────────────────────────
  const toggle3D = () => {
    const map = mapRef.current;
    if (!map) return;
    if (is3D) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setAnimating(false);
      setIs3D(false);
      map.easeTo({ pitch: 0, bearing: 0, duration: 800 });
    } else {
      const c = map.getCenter();
      startFlyAround(map, c.lng, c.lat);
    }
  };

  if (!process.env.NEXT_PUBLIC_MAPBOX_TOKEN) return null;

  return (
    <div className="relative rounded-2xl overflow-hidden" style={{ height }}>
      <div ref={mapContainer} className="w-full h-full" />

      {/* Property name overlay */}
      {loaded && (
        <div
          className="absolute top-4 left-4 z-10 backdrop-blur-sm rounded-xl px-4 py-2.5"
          style={{ background: 'rgba(0,0,0,0.52)' }}
        >
          <p className="text-white text-sm font-semibold leading-tight">{propertyName}</p>
          <p className="text-xs leading-tight mt-0.5" style={{ color: '#97C459' }}>
            {county && state ? `${county}, ${state}` : address}
            {acreage ? ` · ${acreage.toFixed(1)} ac` : ''}
          </p>
        </div>
      )}

      {/* 3D flyover button */}
      {loaded && (
        <div className="absolute bottom-4 right-4 z-10">
          <button
            onClick={toggle3D}
            disabled={animating}
            className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all disabled:opacity-50"
            style={{
              background:    is3D ? 'rgba(59,109,17,0.85)' : 'rgba(0,0,0,0.55)',
              color:         is3D ? '#C0DD97' : 'white',
              border:        '1px solid rgba(151,196,89,0.4)',
              backdropFilter:'blur(4px)',
            }}
          >
            {animating ? (
              <>
                <span
                  className="inline-block w-3 h-3 rounded-full border-2 border-t-transparent animate-spin"
                  style={{ borderColor: '#97C459', borderTopColor: 'transparent' }}
                />
                Flying…
              </>
            ) : is3D ? '⬆ Flat view' : '🌐 3D flyover'}
          </button>
        </div>
      )}

      {/* Loading shimmer */}
      {!loaded && (
        <div
          className="absolute inset-0 flex items-center justify-center"
          style={{ background: '#1a3a0a' }}
        >
          <div className="text-center">
            <div
              className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-3"
              style={{ borderColor: '#639922', borderTopColor: 'transparent' }}
            />
            <p className="text-xs font-medium" style={{ color: '#97C459' }}>
              Loading satellite view…
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
