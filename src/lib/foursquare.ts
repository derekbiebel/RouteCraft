import type { POI, POIType } from './poi';

const API_KEY = import.meta.env.VITE_FOURSQUARE_API_KEY as string;
const BASE_URL = 'https://places-api.foursquare.com/places/search';

// Query terms for each POI type
const QUERY_TERMS: Record<POIType, string[]> = {
  brewery: ['brewery', 'taphouse', 'brewing'],
  coffee: ['coffee', 'cafe'],
  viewpoint: ['viewpoint', 'scenic lookout'],
  park: ['park', 'nature reserve', 'trail'],
};

export async function searchFoursquare(
  center: [number, number], // [lng, lat]
  types: POIType[],
  radiusMeters = 10000
): Promise<POI[]> {
  if (!API_KEY || types.length === 0) return [];

  const radius = Math.min(radiusMeters, 50000);
  console.log('[Foursquare] Searching:', { center, types, radiusMeters, hasApiKey: !!API_KEY });
  const allPois: POI[] = [];
  const seen = new Set<string>();

  // Run separate queries per type for accurate results
  const queries = types.flatMap((type) =>
    QUERY_TERMS[type].map((query) => ({ query, type }))
  );

  // Run queries in parallel (max 4 at a time)
  const results = await Promise.allSettled(
    queries.map(async ({ query, type }) => {
      const params = new URLSearchParams({
        ll: `${center[1]},${center[0]}`,
        radius: String(radius),
        query,
        limit: '20',
      });

      const res = await fetch(`${BASE_URL}?${params}`, {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Accept': 'application/json',
          'X-Places-Api-Version': '2025-06-17',
        },
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('[Foursquare] API error:', res.status, errText);
        return [];
      }

      const data = await res.json();
      return (data.results ?? []).map((r: Record<string, unknown>) => ({ ...r, _searchType: type }));
    })
  );

  for (const result of results) {
    if (result.status !== 'fulfilled') continue;

    for (const r of result.value) {
      const lat = r.latitude as number | undefined;
      const lng = r.longitude as number | undefined;
      const name = r.name as string | undefined;
      if (!lat || !lng || !name) continue;

      // Dedupe by name
      const key = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
      if (seen.has(key)) continue;
      seen.add(key);

      const type = r._searchType as POIType;
      const fsqId = (r.fsq_place_id ?? '') as string;
      const id = parseInt(fsqId.replace(/\D/g, '').slice(-8) || '0', 16) || Math.floor(Math.random() * 1e9);

      allPois.push({ id, name, type, lat, lng });
    }
  }

  return allPois;
}
