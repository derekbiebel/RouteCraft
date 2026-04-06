export type POIType = 'brewery' | 'coffee' | 'viewpoint' | 'park';

export interface POI {
  id: number;
  name: string;
  type: POIType;
  lat: number;
  lng: number;
}

export async function findPOIsAlongRoute(
  coordinates: [number, number, number][],
  types: POIType[],
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
  if (types.includes('viewpoint')) {
    filters.push(`node["tourism"="viewpoint"](${bbox});`);
  }
  if (types.includes('park')) {
    filters.push(`node["leisure"="park"](${bbox});`);
    filters.push(`way["leisure"="park"](${bbox});`);
    filters.push(`relation["boundary"="national_park"](${bbox});`);
    filters.push(`node["leisure"="nature_reserve"](${bbox});`);
    filters.push(`way["leisure"="nature_reserve"](${bbox});`);
  }

  const query = `[out:json][timeout:10];(${filters.join('')});out body center;`;

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
    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (!lat || !lon) continue;
    const name = el.tags?.name;
    if (!name) continue;

    // Dedupe by name + rough location
    const key = `${name}-${lat.toFixed(3)}-${lon.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    // Determine type
    const isBrewer =
      el.tags?.craft === 'brewery' ||
      el.tags?.microbrewery === 'yes' ||
      el.tags?.brewery;
    const isViewpoint = el.tags?.tourism === 'viewpoint';
    const isPark =
      el.tags?.leisure === 'park' ||
      el.tags?.boundary === 'national_park' ||
      el.tags?.leisure === 'nature_reserve';

    let type: POI['type'];
    if (isBrewer) type = 'brewery';
    else if (isViewpoint) type = 'viewpoint';
    else if (isPark) type = 'park';
    else type = 'coffee';

    // Only include if within buffer distance of the route
    if (isNearRoute(lat, lon, coordinates, bufferMeters)) {
      pois.push({ id: el.id, name, type, lat, lng: lon });
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
