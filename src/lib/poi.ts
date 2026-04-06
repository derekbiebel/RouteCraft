export interface POI {
  id: number;
  name: string;
  type: 'brewery' | 'coffee';
  lat: number;
  lng: number;
}

export async function findPOIsAlongRoute(
  coordinates: [number, number, number][],
  types: ('brewery' | 'coffee')[],
  bufferMeters = 500
): Promise<POI[]> {
  if (coordinates.length === 0 || types.length === 0) return [];

  // Build a bounding box around the route with buffer
  const lngs = coordinates.map((c) => c[0]);
  const lats = coordinates.map((c) => c[1]);
  const bufferDeg = bufferMeters / 111000; // rough meter-to-degree
  const south = Math.min(...lats) - bufferDeg;
  const north = Math.max(...lats) + bufferDeg;
  const west = Math.min(...lngs) - bufferDeg;
  const east = Math.max(...lngs) + bufferDeg;
  const bbox = `${south},${west},${north},${east}`;

  // Build Overpass query for selected POI types
  const filters: string[] = [];
  if (types.includes('brewery')) {
    filters.push(`node["craft"="brewery"](${bbox});`);
    filters.push(`node["amenity"="pub"]["microbrewery"="yes"](${bbox});`);
    filters.push(`node["brewery"](${bbox});`);
  }
  if (types.includes('coffee')) {
    filters.push(`node["amenity"="cafe"](${bbox});`);
    filters.push(`node["cuisine"="coffee"](${bbox});`);
  }

  const query = `[out:json][timeout:10];(${filters.join('')});out body;`;

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    body: `data=${encodeURIComponent(query)}`,
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  });

  if (!res.ok) return [];
  const data = await res.json();

  const seen = new Set<string>();
  const pois: POI[] = [];

  for (const el of data.elements ?? []) {
    if (!el.lat || !el.lon) continue;
    const name = el.tags?.name;
    if (!name) continue;

    // Dedupe by name + rough location
    const key = `${name}-${el.lat.toFixed(3)}-${el.lon.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Determine type
    const isBrewer =
      el.tags?.craft === 'brewery' ||
      el.tags?.microbrewery === 'yes' ||
      el.tags?.brewery;
    const type: POI['type'] = isBrewer ? 'brewery' : 'coffee';

    // Only include if within buffer distance of the route
    if (isNearRoute(el.lat, el.lon, coordinates, bufferMeters)) {
      pois.push({ id: el.id, name, type, lat: el.lat, lng: el.lon });
    }
  }

  return pois;
}

function isNearRoute(
  lat: number,
  lng: number,
  coords: [number, number, number][],
  maxDist: number
): boolean {
  // Sample every 10th coordinate for performance
  for (let i = 0; i < coords.length; i += 10) {
    const dist = haversine(lat, lng, coords[i][1], coords[i][0]);
    if (dist <= maxDist) return true;
  }
  return false;
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
