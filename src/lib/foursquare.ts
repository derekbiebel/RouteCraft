import type { POI, POIType } from './poi';

const API_KEY = import.meta.env.VITE_FOURSQUARE_API_KEY as string;
const BASE_URL = 'https://places-api.foursquare.com/places/search';

// Foursquare category IDs
const CATEGORY_MAP: Record<POIType, string> = {
  brewery: '50327c8591d4c4b30a586d5d', // Brewery
  coffee: '4bf58dd8d48988d1e0931735',   // Coffee Shop
  viewpoint: '4bf58dd8d48988d165941735', // Scenic Lookout
  park: '4bf58dd8d48988d163941735',      // Park
};

// Additional categories to search
const EXTRA_CATEGORIES: Record<POIType, string[]> = {
  brewery: [
    '50327c8591d4c4b30a586d5d', // Brewery
    '4bf58dd8d48988d117951735', // Beer Garden
  ],
  coffee: [
    '4bf58dd8d48988d1e0931735', // Coffee Shop
    '4bf58dd8d48988d16d941735', // Café
  ],
  viewpoint: [
    '4bf58dd8d48988d165941735', // Scenic Lookout
    '56aa371be4b08b9a8d573532', // Lookout/Viewpoint
  ],
  park: [
    '4bf58dd8d48988d163941735', // Park
    '52e81612bcbc57f1066b7a21', // National Park
    '4bf58dd8d48988d159941735', // Trail
  ],
};

interface FoursquareResult {
  fsq_place_id?: string;
  fsq_id?: string;
  name: string;
  geocodes?: { main?: { latitude: number; longitude: number } };
  latitude?: number;
  longitude?: number;
  categories: { fsq_category_id?: string; id?: string; name: string }[];
  location?: { formatted_address?: string };
  distance?: number;
}

function categorizeResult(result: FoursquareResult, searchTypes: POIType[]): POIType {
  const catIds = result.categories.map((c) => c.fsq_category_id ?? c.id ?? '');
  const catNames = result.categories.map((c) => c.name.toLowerCase());

  for (const type of searchTypes) {
    const ids = EXTRA_CATEGORIES[type] ?? [CATEGORY_MAP[type]];
    if (catIds.some((id) => ids.includes(id))) return type;
  }

  // Fallback: match by name
  if (catNames.some((n) => n.includes('brew') || n.includes('beer'))) return 'brewery';
  if (catNames.some((n) => n.includes('coffee') || n.includes('café') || n.includes('cafe'))) return 'coffee';
  if (catNames.some((n) => n.includes('park') || n.includes('trail'))) return 'park';
  if (catNames.some((n) => n.includes('viewpoint') || n.includes('lookout') || n.includes('scenic'))) return 'viewpoint';

  return searchTypes[0];
}

export async function searchFoursquare(
  center: [number, number], // [lng, lat]
  types: POIType[],
  radiusMeters = 10000
): Promise<POI[]> {
  if (!API_KEY || types.length === 0) return [];

  // Collect all category IDs for the requested types
  const allCatIds = types.flatMap((t) => EXTRA_CATEGORIES[t] ?? [CATEGORY_MAP[t]]);
  const categoriesParam = allCatIds.join(',');

  const params = new URLSearchParams({
    ll: `${center[1]},${center[0]}`,
    radius: String(Math.min(radiusMeters, 50000)), // Foursquare max 50km
    categories: categoriesParam,
    limit: '50',
  });

  try {
    const res = await fetch(`${BASE_URL}?${params}`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Accept': 'application/json',
        'X-Places-Api-Version': '2025-06-17',
      },
    });

    if (!res.ok) return [];

    const data = await res.json();
    const results: FoursquareResult[] = data.results ?? [];

    const seen = new Set<string>();
    const pois: POI[] = [];

    for (const r of results) {
      const lat = r.geocodes?.main?.latitude ?? r.latitude;
      const lng = r.geocodes?.main?.longitude ?? r.longitude;
      if (!lat || !lng || !r.name) continue;

      // Dedupe
      const key = `${r.name}-${lat.toFixed(3)}-${lng.toFixed(3)}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const type = categorizeResult(r, types);
      const id = parseInt((r.fsq_place_id ?? r.fsq_id ?? '0').replace(/\D/g, '').slice(-8) || '0', 16) || Math.random() * 1e9;

      pois.push({ id, name: r.name, type, lat, lng });
    }

    return pois;
  } catch {
    return [];
  }
}
