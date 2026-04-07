import type { POI, POIType } from './poi';

// Query terms for each POI type
const QUERY_TERMS: Record<POIType, string[]> = {
  brewery: ['brewery', 'taphouse'],
  coffee: ['coffee', 'cafe'],
  viewpoint: ['scenic overlook', 'viewpoint', 'trailhead'],
  park: ['park', 'nature reserve', 'state park'],
};

export async function searchFoursquare(
  center: [number, number], // [lng, lat]
  types: POIType[],
  radiusMeters = 10000
): Promise<POI[]> {
  if (types.length === 0) return [];

  const radius = Math.min(radiusMeters, 50000);
  const allPois: POI[] = [];
  const seen = new Set<string>();

  // Build all queries
  const queries = types.flatMap((type) =>
    QUERY_TERMS[type].map((query) => ({ query, type }))
  );

  // Run queries in parallel via our serverless proxy
  const results = await Promise.allSettled(
    queries.map(async ({ query, type }) => {
      const params = new URLSearchParams({
        ll: `${center[1]},${center[0]}`,
        radius: String(radius),
        query,
        limit: '20',
      });

      const res = await fetch(`/api/foursquare?${params}`);

      if (!res.ok) {
        console.error('[Foursquare] Proxy error:', res.status);
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

      const key = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 20);
      if (seen.has(key)) continue;
      seen.add(key);

      const type = r._searchType as POIType;
      const fsqId = (r.fsq_place_id ?? '') as string;
      const id = parseInt(fsqId.replace(/\D/g, '').slice(-8) || '0', 16) || Math.floor(Math.random() * 1e9);

      allPois.push({ id, name, type, lat, lng });
    }
  }

  console.log('[Foursquare] Found:', allPois.length, 'POIs');
  return allPois;
}
