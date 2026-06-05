'use client';

import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? '';

interface Props {
  /** GeoJSON polygon coordinates — same format as boundary in the store */
  coordinates: number[][][];
  className?: string;
}

/**
 * Read-only satellite map that shows a parcel polygon for the user to confirm.
 * No drawing, no terrain flyover — just the boundary and the satellite image.
 */
export default function ParcelConfirmMap({ coordinates, className = '' }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef       = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: 'mapbox://styles/mapbox/satellite-streets-v12',
      zoom: 15,
      center: [0, 0],
      interactive: false, // read-only — no pan/zoom controls
    });

    mapRef.current = map;

    map.on('load', () => {
      // Compute bounding box so we can fit the map to the parcel
      let minLng =  Infinity, maxLng = -Infinity;
      let minLat =  Infinity, maxLat = -Infinity;

      const ring = coordinates[0] ?? [];
      for (const [lng, lat] of ring) {
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
      }

      map.fitBounds(
        [[minLng, minLat], [maxLng, maxLat]],
        { padding: 40, animate: false }
      );

      // Draw the parcel fill
      map.addSource('parcel', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'Polygon', coordinates },
          properties: {},
        },
      });

      map.addLayer({
        id: 'parcel-fill',
        type: 'fill',
        source: 'parcel',
        paint: {
          'fill-color': '#639922',
          'fill-opacity': 0.25,
        },
      });

      map.addLayer({
        id: 'parcel-line',
        type: 'line',
        source: 'parcel',
        paint: {
          'line-color': '#97C459',
          'line-width': 2.5,
          'line-dasharray': [3, 2],
        },
      });
    });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // If coordinates change after initial mount, update the source
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const src = map.getSource('parcel') as mapboxgl.GeoJSONSource | undefined;
    if (!src) return;

    src.setData({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates },
      properties: {},
    });

    // Re-fit bounds
    let minLng =  Infinity, maxLng = -Infinity;
    let minLat =  Infinity, maxLat = -Infinity;
    const ring = coordinates[0] ?? [];
    for (const [lng, lat] of ring) {
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 40, animate: true });
  }, [coordinates]);

  return (
    <div
      ref={containerRef}
      className={`w-full rounded-xl overflow-hidden ${className}`}
      style={{ height: 280 }}
    />
  );
}
