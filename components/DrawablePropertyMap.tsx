'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface DrawablePropertyMapProps {
  address: string;
  onBoundaryChange?: (boundary: number[][][] | null, acreage: number) => void;
  className?: string;
}

export default function DrawablePropertyMap({
  address,
  onBoundaryChange,
  className = '',
}: DrawablePropertyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
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
  const syncToMap = useCallback((map: any, pts: [number, number][]) => {
    const src = map.getSource('drawing');
    if (!src) return;

    const features: any[] = [];

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

    let map: any;

    (async () => {
      // 1. Geocode address → center
      let center: [number, number] = [-87.08, 35.61];
      try {
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
            address
          )}.json?access_token=${token}&types=address,place&limit=1`
        );
        const data = await res.json();
        if (data.features?.[0]?.center) {
          center = data.features[0].center as [number, number];
        }
      } catch { /* use fallback */ }
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
        map.on('click', (e: any) => {
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
  }, [address]);

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
        className={`rounded-2xl flex items-center justify-center bg-green-50 ${className}`}
        style={{ minHeight: 360 }}
      >
        <p className="text-sm text-green-700 text-center px-4">
          Add <code>NEXT_PUBLIC_MAPBOX_TOKEN</code> to <code>.env.local</code> to enable the map
        </p>
      </div>
    );
  }

  return (
    <div className={`relative rounded-2xl overflow-hidden ${className}`} style={{ minHeight: 360 }}>
      {/* Loading overlay while geocoding */}
      {geocoding && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/40 rounded-2xl">
          <div className="bg-white rounded-xl px-5 py-3 text-sm font-medium text-gray-800 shadow-lg">
            📍 Finding your property…
          </div>
        </div>
      )}

      {/* The map */}
      <div ref={mapContainer} className="w-full h-full" style={{ minHeight: 360 }} />

      {/* Instruction banner */}
      {ready && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
          <div className="bg-black/70 text-white text-xs font-medium px-3 py-2 rounded-lg whitespace-nowrap">
            {points.length === 0 && '📌 Click your property corners to draw a boundary'}
            {points.length === 1 && 'Keep clicking to add boundary points'}
            {points.length === 2 && 'Add at least one more point'}
            {points.length >= 3 && `✓ ${points.length} points — add more or click Confirm below`}
          </div>
        </div>
      )}

      {/* Acreage badge */}
      {acreage > 0 && (
        <div
          className="absolute bottom-3 left-3 z-10 bg-white/90 text-xs font-semibold px-3 py-1.5 rounded-lg"
          style={{ color: '#3B6D11' }}
        >
          📐 ~{acreage.toFixed(1)} acres
        </div>
      )}

      {/* Undo / Clear */}
      {points.length > 0 && (
        <div className="absolute bottom-3 right-3 z-10 flex gap-2">
          <button
            onClick={handleUndo}
            className="bg-white/90 text-xs font-medium px-3 py-1.5 rounded-lg text-gray-600 hover:bg-white transition-colors shadow-sm"
          >
            ↩ Undo
          </button>
          <button
            onClick={handleClear}
            className="bg-white/90 text-xs font-medium px-3 py-1.5 rounded-lg text-red-500 hover:bg-white transition-colors shadow-sm"
          >
            ✕ Clear
          </button>
        </div>
      )}
    </div>
  );
}
