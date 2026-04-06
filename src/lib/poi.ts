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

  // Build Overpass query for selected POI types (search nodes AND ways)
  const filters: string[] = [];
  if (types.includes('brewery')) {
    for (const el of ['node', 'way']) {
      filters.push(`${el}["craft"="brewery"](${bbox});`);
      filters.push(`${el}["amenity"="pub"]["microbrewery"="yes"](${bbox});`);
      filters.push(`${el}["amenity"="bar"]["craft"="brewery"](${bbox});`);
      filters.push(`${el}["amenity"="biergarten"](${bbox});`);
      filters.push(`${el}["microbrewery"="yes"](${bbox});`);
      filters.push(`${el}["brewery"](${bbox});`);
    }
  }
  if (types.includes('coffee')) {
    for (const el of ['node', 'way']) {
      filters.push(`${el}["amenity"="cafe"](${bbox});`);
      filters.push(`${el}["cuisine"="coffee"](${bbox});`);
      filters.push(`${el}["shop"="coffee"](${bbox});`);
    }
  }
  if (types.includes('viewpoint')) {
    filters.push(`node["tourism"="viewpoint"](${bbox});`);
    filters.push(`way["tourism"="viewpoint"](${bbox});`);
  }
  if (types.includes('park')) {
    for (const el of ['node', 'way', 'relation']) {
      filters.push(`${el}["leisure"="park"](${bbox});`);
      filters.push(`${el}["leisure"="nature_reserve"](${bbox});`);
    }
    filters.push(`relation["boundary"="national_park"](${bbox});`);
  }

  const query = `[out:json][timeout:15];(${filters.join('')});out body center;`;

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

/**
 * Search for POIs near a single point within a radius.
 * Used to find stops BEFORE generating a route.
 */
export async function findPOIsNearPoint(
  center: [number, number], // [lng, lat]
  types: POIType[],
  radiusMeters = 3000
): Promise<POI[]> {
  if (types.length === 0) return [];

  const bufferDeg = radiusMeters / 111000;
  const south = center[1] - bufferDeg;
  const north = center[1] + bufferDeg;
  const west = center[0] - bufferDeg;
  const east = center[0] + bufferDeg;
  const bbox = `${south},${west},${north},${east}`;

  const filters: string[] = [];
  if (types.includes('brewery')) {
    // Search both nodes and ways for all brewery-related tags
    for (const el of ['node', 'way']) {
      filters.push(`${el}["craft"="brewery"](${bbox});`);
      filters.push(`${el}["amenity"="pub"]["microbrewery"="yes"](${bbox});`);
      filters.push(`${el}["amenity"="bar"]["craft"="brewery"](${bbox});`);
      filters.push(`${el}["amenity"="biergarten"](${bbox});`);
      filters.push(`${el}["microbrewery"="yes"](${bbox});`);
      filters.push(`${el}["brewery"](${bbox});`);
    }
  }
  if (types.includes('coffee')) {
    // Search both nodes and ways — amenity=cafe covers most coffee shops
    for (const el of ['node', 'way']) {
      filters.push(`${el}["amenity"="cafe"](${bbox});`);
      filters.push(`${el}["cuisine"="coffee"](${bbox});`);
      filters.push(`${el}["shop"="coffee"](${bbox});`);
    }
  }
  if (types.includes('viewpoint')) {
    filters.push(`node["tourism"="viewpoint"](${bbox});`);
    filters.push(`way["tourism"="viewpoint"](${bbox});`);
  }
  if (types.includes('park')) {
    for (const el of ['node', 'way', 'relation']) {
      filters.push(`${el}["leisure"="park"](${bbox});`);
      filters.push(`${el}["leisure"="nature_reserve"](${bbox});`);
    }
    filters.push(`relation["boundary"="national_park"](${bbox});`);
  }

  const query = `[out:json][timeout:15];(${filters.join('')});out body center;`;

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

    const key = `${name}-${lat.toFixed(3)}-${lon.toFixed(3)}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const isBrewer = el.tags?.craft === 'brewery' || el.tags?.microbrewery === 'yes' || el.tags?.brewery;
    const isViewpoint = el.tags?.tourism === 'viewpoint';
    const isPark = el.tags?.leisure === 'park' || el.tags?.boundary === 'national_park' || el.tags?.leisure === 'nature_reserve';

    let type: POIType;
    if (isBrewer) type = 'brewery';
    else if (isViewpoint) type = 'viewpoint';
    else if (isPark) type = 'park';
    else type = 'coffee';

    const dist = haversine(lat, lon, center[1], center[0]);
    if (dist <= radiusMeters) {
      pois.push({ id: el.id, name, type, lat, lng: lon });
    }
  }

  // Sort by distance from center
  pois.sort((a, b) =>
    haversine(a.lat, a.lng, center[1], center[0]) -
    haversine(b.lat, b.lng, center[1], center[0])
  );

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
