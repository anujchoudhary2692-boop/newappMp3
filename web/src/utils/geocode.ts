export interface GeoMapPoint {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  subtitle?: string;
  color?: string;
}

export interface GeoMapPoint {
  id: string;
  latitude: number;
  longitude: number;
  title?: string;
  subtitle?: string;
  color?: string;
}

export async function reverseGeocode(lat: number, lng: number): Promise<{
  address?: string;
  city?: string;
  country?: string;
  shortLabel: string;
}> {
  const fallback = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&addressdetails=1`;
    const res = await fetch(url, {headers: {Accept: 'application/json', 'User-Agent': 'MediaFaceWeb/1.0'}});
    if (!res.ok) throw new Error('geocode failed');
    const data = await res.json();
    const address = data.address || {};
    const city = address.city || address.town || address.village || address.suburb || address.county;
    const country = address.country;
    const shortLabel = [city, country].filter(Boolean).join(', ') || fallback;
    return {
      address: data.display_name,
      city,
      country,
      shortLabel,
    };
  } catch {
    return {shortLabel: fallback};
  }
}
