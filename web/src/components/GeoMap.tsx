import {useEffect, useRef} from 'react';
import type {GeoMapPoint} from '../utils/geocode';

interface Props {
  points: GeoMapPoint[];
  height?: number;
}

declare global {
  interface Window {
    L?: typeof import('leaflet');
  }
}

export function GeoMap({points, height = 320}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const valid = points.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));

  useEffect(() => {
    if (!containerRef.current || valid.length === 0) return;

    let map: import('leaflet').Map | undefined;
    let cancelled = false;

    const load = async () => {
      if (!window.L) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('leaflet load failed'));
          document.body.appendChild(script);
        });
      }
      if (cancelled || !containerRef.current || !window.L) return;

      const L = window.L;
      map = L.map(containerRef.current).setView([valid[0].latitude, valid[0].longitude], 13);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      const group: import('leaflet').Layer[] = [];
      valid.forEach(p => {
        const marker = L.circleMarker([p.latitude, p.longitude], {
          radius: 8,
          color: '#fff',
          weight: 2,
          fillColor: p.color || '#FF9900',
          fillOpacity: 0.95,
        }).addTo(map!);
        if (p.title) {
          marker.bindPopup(`<strong>${p.title}</strong>${p.subtitle ? `<br/>${p.subtitle}` : ''}`);
        }
        group.push(marker);
      });
      if (group.length > 1) {
        map.fitBounds(L.featureGroup(group).getBounds().pad(0.15));
      }
    };

    void load();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [valid]);

  if (valid.length === 0) {
    return null;
  }

  return (
    <div
      ref={containerRef}
      style={{
        height,
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: '#111',
      }}
    />
  );
}
