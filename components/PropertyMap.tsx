'use client';

import { useEffect, useRef } from 'react';
import type { Map as MapboxMap } from 'mapbox-gl';
import { Icon } from '@/components/brand';

interface PropertyMapProps {
  boundary?: number[][][];
  center?: [number, number];
  acreage: number;
  className?: string;
}

export default function PropertyMap({ boundary, center, acreage, className = '' }: PropertyMapProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      // No token — placeholder is rendered in JSX below
      return;
    }

    let map: MapboxMap;

    // Dynamically import mapbox-gl to avoid SSR errors
    import('mapbox-gl').then((mapboxgl) => {
      mapboxgl.default.accessToken = token;

      const defaultCenter = center || (boundary ? getBoundsCenter(boundary[0]) : [-87.08, 35.61]);

      map = new mapboxgl.default.Map({
        container: mapContainer.current!,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: defaultCenter,
        zoom: 13,
      });

      map.on('load', () => {
        if (boundary) {
          map.addSource('property', {
            type: 'geojson',
            data: {
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: boundary },
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
            paint: { 'line-color': '#3B6D11', 'line-width': 2.5 },
          });

          // Fit map to boundary
          const bounds = getBounds(boundary[0]);
          map.fitBounds(bounds, { padding: 40, duration: 0 });
        }
      });

      mapRef.current = map;
    }).catch(console.error);

    return () => {
      map?.remove();
    };
  }, [boundary, center]);

  const hasToken = typeof process !== 'undefined' && !!process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

  return (
    <div className={`relative overflow-hidden rounded-2xl ${className}`} style={{ height: 220 }}>
      {!hasToken ? (
        // Placeholder when no Mapbox token is configured
        <div className="flex h-full w-full items-center justify-center bg-forest-50">
          <div className="text-center">
            <p className="text-sm font-medium text-forest-700">Map preview</p>
            <p className="mt-1 text-xs text-forest-600">The map is not available right now.</p>
          </div>
        </div>
      ) : (
        <div ref={mapContainer} className="w-full h-full" />
      )}

      {/* Acreage badge — bottom left */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-1 rounded-lg bg-cream/90 px-2.5 py-1 text-xs font-medium text-forest-700">
        <Icon.Pin size={12} /> {acreage.toFixed(1)} acres
      </div>

      {/* Attribution badge — bottom right */}
      <div className="absolute bottom-3 right-3 text-xs text-ink-faint bg-cream/70 px-2 py-0.5 rounded z-10">
        Satellite · Regrid parcels
      </div>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getBoundsCenter(coords: number[][]): [number, number] {
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [
    (Math.min(...lngs) + Math.max(...lngs)) / 2,
    (Math.min(...lats) + Math.max(...lats)) / 2,
  ];
}

function getBounds(coords: number[][]): [[number, number], [number, number]] {
  const lngs = coords.map((c) => c[0]);
  const lats = coords.map((c) => c[1]);
  return [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];
}
