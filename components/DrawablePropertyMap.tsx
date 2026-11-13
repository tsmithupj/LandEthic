'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { Map as MapboxMap, MapMouseEvent } from 'mapbox-gl';
import type { Feature } from 'geojson';
import { Icon } from '@/components/brand';
import { locateAddress } from '@/lib/places';

interface DrawablePropertyMapProps {
  address: string;
  /** Exact spot [lng, lat] when known (picked suggestion or GPS coordinates) — skips the address lookup. */
  center?: [number, number];
  onBoundaryChange?: (boundary: number[][][] | null, acreage: number) => void;
  className?: string;
}

export default function DrawablePropertyMap({
  address,
  center: knownCenter,
  onBoundaryChange,
  className = '',
}: DrawablePropertyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const [points, setPoints] = useState<[number, number][]>([]);
  const [acreage, setAcreage] = useState(0);
  const [geocoding, setGeocoding] = useState(true);
  const [ready, setReady] = useState(false);

  // Keep a ref to points so click handler always has the latest value
  const pointsRef = useRef<[number, number][]>([]);
  useEffect(() => { pointsRef.current = points; }, [points]);

  // ── Acreage via Shoelace formula ──────────────────────────────────────────
  const calculateAcreage = useCallback((pts: [number, number][]): number => {
    if (pts.length < 3) return 0;
    let area = 0;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const xi = pts[i][0] * 111320 * Math.cos((pts[i][1] * Math.PI) / 180);
      const yi = pts[i][1] * 110540;
      const xj = pts[j][0] * 111320 * Math.cos((pts[j][1] * Math.PI) / 180);
      const yj = pts[j][1] * 110540;
      area += xi * yj - xj * yi;
    }
    return Math.abs(area / 2) / 4046.86; // sq meters → acres
  }, []);

  // ── Sync drawing to map sources ───────────────────────────────────────────
  const syncToMap = useCallback((map: MapboxMap, pts: [number, number][]) => {
    const src = map.getSource('drawing');
    if (!src || src.type !== 'geojson') return;

    const features: Feature[] = [];

    // Filled polygon (3+ points)
    if (pts.length >= 3) {
      features.push({
        type: 'Feature',
        geometry: { type: 'Polygon', coordinates: [[...pts, pts[0]]] },
        properties: {},
      });
    }

    // Dashed line connecting points
    if (pts.length >= 2) {
      features.push({
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: pts },
        properties: {},
      });
    }

    // Vertex dots
    pts.forEach((pt, i) => {
      features.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: pt },
        properties: { isFirst: i === 0 },
      });
    });

    src.setData({ type: 'FeatureCollection', features });
  }, []);

  // ── Map init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current) return;
    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) { setGeocoding(false); return; }

    let map: MapboxMap;

    (async () => {
      // 1. Where to start: the exact spot if we have it, otherwise look up the address
      let center: [number, number] = knownCenter ?? [-87.08, 35.61];
      if (!knownCenter) {
        const spot = await locateAddress(address, token);
        if (spot) center = [spot.lng, spot.lat];
      }
      setGeocoding(false);

      // 2. Init map
      const mapboxgl = (await import('mapbox-gl')).default;
      mapboxgl.accessToken = token;

      map = new mapboxgl.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center,
        zoom: 16,
      });

      map.on('load', () => {
        // Drawing data source
        map.addSource('drawing', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
        });

        // Green fill
        map.addLayer({
          id: 'draw-fill',
          type: 'fill',
          source: 'drawing',
          filter: ['==', '$type', 'Polygon'],
          paint: { 'fill-color': '#3B6D11', 'fill-opacity': 0.25 },
        });

        // Dashed outline
        map.addLayer({
          id: 'draw-line',
          type: 'line',
          source: 'drawing',
          filter: ['any', ['==', '$type', 'LineString'], ['==', '$type', 'Polygon']],
          paint: {
            'line-color': '#3B6D11',
            'line-width': 2.5,
            'line-dasharray': [2, 1],
          },
        });

        // Vertex dots — first point is green, others white
        map.addLayer({
          id: 'draw-points',
          type: 'circle',
          source: 'drawing',
          filter: ['==', '$type', 'Point'],
          paint: {
            'circle-radius': 7,
            'circle-color': ['case', ['get', 'isFirst'], '#3B6D11', '#ffffff'],
            'circle-stroke-width': 2,
            'circle-stroke-color': '#3B6D11',
          },
        });

        // Click to add boundary point
        map.on('click', (e: MapMouseEvent) => {
          const newPt: [number, number] = [e.lngLat.lng, e.lngLat.lat];
          const next = [...pointsRef.current, newPt];
          pointsRef.current = next;
          setPoints(next);
          syncToMap(map, next);

          const acres = calculateAcreage(next);
          setAcreage(acres);
          if (onBoundaryChange) {
            onBoundaryChange(
              next.length >= 3 ? [[...next, next[0]]] : null,
              acres
            );
          }
        });

        map.getCanvas().style.cursor = 'crosshair';
        setReady(true);
        mapRef.current = map;
      });
    })();

    return () => { map?.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, knownCenter?.[0], knownCenter?.[1]]);

  // ── Undo / Clear ──────────────────────────────────────────────────────────
  const handleUndo = () => {
    const next = points.slice(0, -1);
    setPoints(next);
    if (mapRef.current) syncToMap(mapRef.current, next);
    const acres = calculateAcreage(next);
    setAcreage(acres);
    if (onBoundaryChange) onBoundaryChange(next.length >= 3 ? [[...next, next[0]]] : null, acres);
  };

  const handleClear = () => {
    setPoints([]);
    setAcreage(0);
    if (mapRef.current) syncToMap(mapRef.current, []);
    if (onBoundaryChange) onBoundaryChange(null, 0);
  };

  const hasToken = !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  // ── Render ────────────────────────────────────────────────────────────────
  if (!hasToken) {
    return (
      <div
        className={`rounded-2xl flex items-center justify-center border border-paper-line bg-forest-50 ${className}`}
        style={{ minHeight: 360 }}
      >
        <p className="px-4 text-center text-sm text-forest-800">
          The map is not available right now. Please try again later.
        </p>
      </div>
    );
  }

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`} style={{ minHeight: 360 }}>
      {/* Loading overlay while geocoding */}
      {geocoding && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-2xl">
          <div className="flex items-center gap-2 rounded-xl bg-cream px-5 py-3 text-sm font-medium text-ink shadow-lg">
            <Icon.Pin size={16} className="text-forest-700" /> Finding your property…
          </div>
        </div>
      )}

      {/* The map */}
      <div ref={mapContainer} className="w-full h-full" style={{ minHeight: 360 }} />

      {/* Instruction banner */}
      {ready && (
        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex justify-center">
          <div className="rounded-lg bg-ink/80 px-3 py-2 text-center text-xs font-medium text-cream">
            {points.length === 0 && 'Tap your property corners to draw a boundary'}
            {points.length === 1 && 'Keep tapping to add boundary points'}
            {points.length === 2 && 'Add at least one more point'}
            {points.length >= 3 && `${points.length} points — add more or tap Confirm below`}
          </div>
        </div>
      )}

      {/* Acreage badge */}
      {acreage > 0 && (
        <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-cream/90 px-3 py-1.5 text-xs font-semibold text-forest-700">
          ~{acreage.toFixed(1)} acres
        </div>
      )}

      {/* Undo / Clear */}
      {points.length > 0 && (
        <div className="absolute bottom-3 right-3 z-10 flex gap-2">
          <button
            onClick={handleUndo}
            className="bg-cream/90 text-xs font-medium px-3 py-1.5 rounded-lg text-ink-soft hover:bg-cream transition-colors shadow-none"
          >
            Undo
          </button>
          <button
            onClick={handleClear}
            className="bg-cream/90 text-xs font-medium px-3 py-1.5 rounded-lg text-rust-700 hover:bg-cream transition-colors shadow-none"
          >
            Clear
          </button>
        </div>
      )}
    </div>
  );
}
