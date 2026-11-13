'use client';

import { Component, useEffect, useRef, useState, type ReactNode } from 'react';
import type { GeoJSONSource, Map as MapboxMap } from 'mapbox-gl';
import { Icon } from '@/components/brand';
import { ReportLink } from '@/components/ReportProblem';
import { clipToProperty, shapeCenter, shapePoints } from '@/lib/geo';

interface DashboardMapProps {
  boundary: number[][][] | null;
  address: string;
  propertyName: string;
  acreage?: number;
  county?: string;
  state?: string;
  height?: number;
  propertyId?: string;
  autoFlyover?: boolean;
  /** A spot to outline on the map (e.g. the selected insight's area). */
  highlight?: MapHighlight | null;
  /** Several spots to outline at once, each with a numbered pin (e.g. food plots). */
  features?: MapFeature[];
}

export interface MapFeature {
  /** Closed ring of [lng, lat]. */
  ring: number[][];
  color: string;
  /** Shown in the pin, e.g. 1, 2, 3. */
  number?: number;
}

export interface MapHighlight {
  /** Closed ring of [lng, lat]. */
  ring: number[][];
  color: string;
  label?: string;
}

const EMPTY: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

/**
 * Create a GeoJSON source, or swap the data of an existing one.
 * Never removes sources: removing one while 3D terrain is still loading crashes
 * Mapbox ("Cannot read properties of undefined (reading 'get')"), which took the
 * whole task page down.
 */
function setGeoJson(map: MapboxMap, id: string, data: GeoJSON.Feature | GeoJSON.FeatureCollection) {
  const source = map.getSource(id) as GeoJSONSource | undefined;
  if (source) source.setData(data);
  else map.addSource(id, { type: 'geojson', data });
}

/** True while the map is still on the page (not removed). */
function isLive(map: MapboxMap | null): map is MapboxMap {
  return !!map && !!(map as unknown as { style?: unknown }).style;
}

function DashboardMapInner({
  boundary,
  address,
  propertyName,
  acreage,
  county,
  state,
  height = 320,
  propertyId,
  autoFlyover = true,
  highlight = null,
  features,
}: DashboardMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<MapboxMap | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Keep boundary in a ref so it's always current inside async callbacks
  const boundaryRef      = useRef(boundary);
  useEffect(() => { boundaryRef.current      = boundary;      }, [boundary]);
  const highlightRef     = useRef(highlight);
  useEffect(() => { highlightRef.current     = highlight;     }, [highlight]);
  const featuresRef      = useRef(features);
  useEffect(() => { featuresRef.current      = features;      }, [features]);
  const markersRef       = useRef<{ remove: () => void }[]>([]);
  const mapboxRef        = useRef<typeof import('mapbox-gl').default | null>(null);

  const [is3D,     setIs3D]     = useState(false);
  const [animating,setAnimating]= useState(false);
  const [loaded,   setLoaded]   = useState(false);

  // ── Outline the highlighted spot and move the camera to it ──────────────
  function drawHighlight(map: MapboxMap | null) {
    if (!isLive(map)) return;
    try {
      const hl = highlightRef.current;
      // Only ever show the part of the spot that is inside the property line
      const shape = hl && hl.ring.length >= 4 ? clipToProperty(hl.ring, boundaryRef.current) : null;

      setGeoJson(map, 'highlight', shape ? { type: 'Feature', geometry: shape, properties: {} } : EMPTY);
      const color = hl?.color ?? '#ffffff';
      if (!map.getLayer('highlight-fill')) {
        map.addLayer({ id: 'highlight-fill', type: 'fill', source: 'highlight', paint: { 'fill-color': color, 'fill-opacity': 0.35 } });
      } else {
        map.setPaintProperty('highlight-fill', 'fill-color', color);
      }
      if (!map.getLayer('highlight-line')) {
        map.addLayer({ id: 'highlight-line', type: 'line', source: 'highlight', paint: { 'line-color': color, 'line-width': 3, 'line-dasharray': [2, 1.5] } });
      } else {
        map.setPaintProperty('highlight-line', 'line-color', color);
      }
      if (!shape) return;

      // Stop the flyover so the camera can settle on the spot
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      setAnimating(false);
      setIs3D(false);

      // Frame the spot together with the property so the owner sees where it sits
      const pts = [...shapePoints(shape), ...(boundaryRef.current?.[0] ?? [])];
      const lngs = pts.map((c) => c[0]);
      const lats = pts.map((c) => c[1]);
      map.fitBounds(
        [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
        { padding: 50, duration: 900, maxZoom: 18, pitch: 0, bearing: 0 }
      );
    } catch (err) {
      // A map hiccup must never take the page down
      console.warn('[map] could not outline the spot:', err);
    }
  }

  // ── Outline several spots at once, each with a numbered pin ─────────────
  function drawFeatures(map: MapboxMap | null) {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    if (!isLive(map)) return;
    try {
      // Trim each spot to the property line; drop spots that are really outside it
      const list = (featuresRef.current ?? []).flatMap((f) => {
        const shape = clipToProperty(f.ring, boundaryRef.current);
        return shape ? [{ ...f, shape }] : [];
      });

      setGeoJson(map, 'features', {
        type: 'FeatureCollection',
        features: list.map((f) => ({
          type: 'Feature' as const,
          geometry: f.shape,
          properties: { color: f.color },
        })),
      });
      const before = map.getLayer('highlight-fill') ? 'highlight-fill' : undefined;
      if (!map.getLayer('features-fill')) {
        map.addLayer({
          id: 'features-fill',
          type: 'fill',
          source: 'features',
          paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.25 },
        }, before);
      }
      if (!map.getLayer('features-line')) {
        map.addLayer({
          id: 'features-line',
          type: 'line',
          source: 'features',
          paint: { 'line-color': ['get', 'color'], 'line-width': 2 },
        }, before);
      }

      const mapboxgl = mapboxRef.current;
      if (!mapboxgl) return;
      for (const f of list) {
        if (f.number === undefined) continue;
        const [lng, lat] = shapeCenter(f.shape);
        const el = document.createElement('div');
        el.textContent = String(f.number);
        el.style.cssText = `width:22px;height:22px;border-radius:9999px;background:${f.color};color:#fff;font:700 12px/22px 'Public Sans',sans-serif;text-align:center;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)`;
        markersRef.current.push(new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map));
      }
    } catch (err) {
      console.warn('[map] could not outline the spots:', err);
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
  function startFlyAround(map: MapboxMap) {
    setAnimating(true);
    setIs3D(true);

    let startTime: number | null = null;
    const duration  = 14000;
    const startBear = map.getBearing();

    function animate(ts: number) {
      if (mapRef.current !== map || !isLive(map)) return; // map was closed
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

    let map: MapboxMap | undefined;
    let cancelled = false;
    let flyTimer: ReturnType<typeof setTimeout> | undefined;

    (async () => {
      const mapboxgl = (await import('mapbox-gl')).default;
      if (cancelled) return;
      mapboxgl.accessToken = token;
      mapboxRef.current = mapboxgl;

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
      if (cancelled || !mapContainer.current) return;

      const m = new mapboxgl.Map({
        container: mapContainer.current!,
        style:     'mapbox://styles/mapbox/satellite-streets-v12',
        center,
        zoom:      bounds ? 14 : 13,
        pitch:     0,
        bearing:   0,
        antialias: true,
      });
      map = m;

      m.on('load', () => {
        const map = m;
        if (cancelled) return;
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
        setLoaded(true); // the effects below then draw the outlined spots

        // Flyover logic
        const flyKey    = propertyId ? `landethic_flyover_${propertyId}` : null;
        const seen      = flyKey ? !!localStorage.getItem(flyKey) : false;
        const shouldFly = autoFlyover && !seen;

        if (shouldFly) {
          if (flyKey) localStorage.setItem(flyKey, '1');
          flyTimer = setTimeout(() => { if (!cancelled) startFlyAround(map); }, 1200);
        }
      });
    })();

    return () => {
      cancelled = true;
      if (flyTimer) clearTimeout(flyTimer);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      markersRef.current.forEach((mk) => mk.remove());
      markersRef.current = [];
      mapRef.current = null;
      map?.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Re-draw the outlined spots whenever they change ──────────────────────
  useEffect(() => {
    if (!loaded) return;
    drawFeatures(mapRef.current);
  }, [features, loaded]);

  // ── Re-draw the highlight whenever the selected spot changes ─────────────
  useEffect(() => {
    if (!loaded) return;
    drawHighlight(mapRef.current);
  }, [highlight, loaded]);

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
      startFlyAround(map);
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

      {/* Highlighted spot label */}
      {loaded && highlight?.label && (
        <div
          className="absolute bottom-4 left-4 z-10 flex max-w-[60%] items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
          style={{ background: 'rgba(0,0,0,0.6)', border: `1.5px solid ${highlight.color}` }}
        >
          <Icon.Pin size={13} />
          <span className="truncate">{highlight.label}</span>
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
            ) : is3D ? 'Flat view' : (
              <>
                <Icon.Compass size={14} /> 3D flyover
              </>
            )}
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

/** If the map ever fails, show a quiet placeholder instead of taking the whole page down. */
class MapErrorBoundary extends Component<{ height: number; children: ReactNode }, { failed: boolean; message: string }> {
  state = { failed: false, message: '' };
  static getDerivedStateFromError(err: unknown) {
    return { failed: true, message: `Map error: ${err instanceof Error ? err.message : String(err)}` };
  }
  componentDidCatch(err: unknown) {
    console.warn('[map] the map stopped working:', err);
  }
  render() {
    if (this.state.failed) {
      return (
        <div
          className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-forest-900 px-4 text-center text-sm text-forest-200"
          style={{ height: this.props.height }}
        >
          The map couldn&apos;t load. Refresh the page to try again.
          <ReportLink error={this.state.message || 'The map stopped working'} className="!text-forest-200" />
        </div>
      );
    }
    return this.props.children;
  }
}

export default function DashboardMap(props: DashboardMapProps) {
  return (
    <MapErrorBoundary height={props.height ?? 320}>
      <DashboardMapInner {...props} />
    </MapErrorBoundary>
  );
}
