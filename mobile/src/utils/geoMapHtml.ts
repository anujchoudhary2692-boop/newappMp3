export interface GeoMapPoint {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  subtitle?: string;
  color?: string;
}

export function buildLeafletMapHtml(points: GeoMapPoint[], height = 320): string {
  const valid = points.filter(p => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  const center = valid.length
    ? {
        lat: valid.reduce((sum, p) => sum + p.latitude, 0) / valid.length,
        lng: valid.reduce((sum, p) => sum + p.longitude, 0) / valid.length,
      }
    : {lat: 20, lng: 0};
  const markers = valid.map(p => ({
    lat: p.latitude,
    lng: p.longitude,
    title: (p.title || 'Location').replace(/'/g, "\\'"),
    subtitle: (p.subtitle || '').replace(/'/g, "\\'"),
    color: p.color || '#FF9900',
  }));
  return `<!DOCTYPE html>
<html><head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  html, body, #map { margin:0; padding:0; height:${height}px; width:100%; background:#111; }
  .leaflet-popup-content { font-family: -apple-system, sans-serif; font-size: 13px; }
</style>
</head><body>
<div id="map"></div>
<script>
  const map = L.map('map', { zoomControl: true }).setView([${center.lat}, ${center.lng}], ${valid.length > 1 ? 11 : 14});
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap'
  }).addTo(map);
  const markers = ${JSON.stringify(markers)};
  const group = [];
  markers.forEach(m => {
    const icon = L.divIcon({
      className: '',
      html: '<div style="background:' + m.color + ';width:14px;height:14px;border-radius:50%;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.45)"></div>',
      iconSize: [14, 14],
      iconAnchor: [7, 7]
    });
    const marker = L.marker([m.lat, m.lng], { icon }).addTo(map);
    if (m.title) {
      marker.bindPopup('<strong>' + m.title + '</strong>' + (m.subtitle ? '<br/>' + m.subtitle : ''));
    }
    group.push(marker);
  });
  if (group.length > 1) {
    map.fitBounds(L.featureGroup(group).getBounds().pad(0.2));
  }
</script>
</body></html>`;
}
