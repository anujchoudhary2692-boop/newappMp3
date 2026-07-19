import {useEffect, useRef} from 'react';
import type {GeoMapPoint} from '../utils/geocode';

interface Props {
  points: GeoMapPoint[];
  height?: number;
  className?: string;
}

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    L?: any;
  }
}

/** Simple grid clustering for dense maps. */
function clusterPoints(points: GeoMapPoint[], cell = 0.02): GeoMapPoint[][] {
  const buckets = new Map<string, GeoMapPoint[]>();
  for (const p of points) {
    const key = `${Math.round(p.latitude / cell)}:${Math.round(p.longitude / cell)}`;
    const list = buckets.get(key) || [];
    list.push(p);
    buckets.set(key, list);
  }
  return [...buckets.values()];
}

export function GeoMap({points, height = 320, className}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const valid = points.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));

  useEffect(() => {
    if (!containerRef.current || valid.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let map: any;
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

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const group: any[] = [];
      const clusters = clusterPoints(valid);
      clusters.forEach(cluster => {
        const p = cluster[0];
        const lat = cluster.reduce((s, c) => s + c.latitude, 0) / cluster.length;
        const lng = cluster.reduce((s, c) => s + c.longitude, 0) / cluster.length;
        const count = cluster.length;
        const marker = L.circleMarker([lat, lng], {
          radius: count > 1 ? Math.min(18, 8 + count) : 8,
          color: '#fff',
          weight: 2,
          fillColor: p.color || '#FF9900',
          fillOpacity: 0.95,
        }).addTo(map!);

        const thumbs = cluster
          .filter(c => c.thumbnailUrl)
          .slice(0, 3)
          .map(c => `<img src="${c.thumbnailUrl}" style="width:56px;height:56px;object-fit:cover;border-radius:6px;margin:2px" />`)
          .join('');
        const links = cluster
          .slice(0, 5)
          .map(c => {
            const label = c.title || c.id;
            return c.href
              ? `<div><a href="${c.href}">${label}</a>${c.subtitle ? ` · ${c.subtitle}` : ''}</div>`
              : `<div><strong>${label}</strong>${c.subtitle ? `<br/>${c.subtitle}` : ''}</div>`;
          })
          .join('');
        marker.bindPopup(
          `<div style="min-width:140px">${count > 1 ? `<div style="font-weight:700;margin-bottom:6px">${count} captures</div>` : ''}${thumbs}<div style="margin-top:6px">${links}</div></div>`,
        );
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
      className={className}
      style={{
        height: className ? undefined : height,
        width: '100%',
        borderRadius: 12,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        background: '#111',
      }}
    />
  );
}
