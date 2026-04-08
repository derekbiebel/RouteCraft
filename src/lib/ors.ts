import { getSurfaceInfo, type SurfaceInfo } from './surfaces';
import type { Avoidances } from '../store/usePreferences';

const API_KEY = import.meta.env.VITE_ORS_API_KEY as string;
const BASE_URL = 'https://api.openrouteservice.org/v2';

export interface RouteSegment {
  coordinates: [number, number, number][]; // [lng, lat, elevation]
  surface: SurfaceInfo;
  distanceMeters: number;
}

export interface RouteResult {
  segments: RouteSegment[];
  totalDistance: number; // meters
  totalDuration: number; // seconds
  elevationGain: number;
  elevationLoss: number;
  elevationProfile: { distance: number; elevation: number }[];
  bbox: [number, number, number, number];
  surfaceBreakdown: { category: string; distance: number; percent: number }[];
}

type ORSProfile = 'foot-walking' | 'foot-hiking' | 'cycling-regular' | 'cycling-mountain' | 'cycling-road';

export function getORSProfile(activity: 'running' | 'cycling', surfacePref: string, preferBikeLanes = false): ORSProfile {
  if (activity === 'cycling') {
    if (surfacePref === 'unpaved') return 'cycling-mountain';
    if (preferBikeLanes || surfacePref === 'paved') return 'cycling-road';
    return 'cycling-regular';
  }
  return surfacePref === 'unpaved' ? 'foot-hiking' : 'foot-walking';
}

function buildAvoidFeatures(avoidances: Avoidances): string[] {
  const features: string[] = [];
  if (avoidances.highways) features.push('highways');
  if (avoidances.steps) features.push('steps');
  if (avoidances.ferries) features.push('ferries');
  return features;
}

function buildOptions(avoidances?: Avoidances, roundTrip?: { length: number; points: number; seed: number }): Record<string, unknown> | undefined {
  const opts: Record<string, unknown> = {};
  if (roundTrip) opts.round_trip = roundTrip;

  if (avoidances) {
    const features = buildAvoidFeatures(avoidances);
    if (features.length > 0) {
      opts.avoid_features = features;
    }
  }

  return Object.keys(opts).length > 0 ? opts : undefined;
}

export async function getDirections(
  coordinates: [number, number][],
  profile: ORSProfile,
  avoidances?: Avoidances
): Promise<RouteResult> {
  const options = buildOptions(avoidances);
  const body: Record<string, unknown> = {
    coordinates,
    elevation: true,
    extra_info: ['surface'],
    instructions: false,
    continue_straight: true,
    preference: 'recommended',
  };
  if (options) body.options = options;

  const res = await fetch(`${BASE_URL}/directions/${profile}/geojson`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': API_KEY,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `ORS error: ${res.status}`);
  }

  const data = await res.json();
  return parseORSResponse(data);
}

export async function getRoundTrip(
  start: [number, number],
  lengthMeters: number,
  profile: ORSProfile,
  seed?: number,
  avoidances?: Avoidances
): Promise<RouteResult> {
  const options = buildOptions(avoidances, {
    length: lengthMeters,
    points: 3,
    seed: seed ?? Math.floor(Math.random() * 100),
  });

  const res = await fetch(`${BASE_URL}/directions/${profile}/geojson`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': API_KEY,
    },
    body: JSON.stringify({
      coordinates: [start],
      elevation: true,
      extra_info: ['surface'],
      instructions: false,
      continue_straight: true,
      preference: 'recommended',
      options,
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message ?? `ORS error: ${res.status}`);
  }

  const data = await res.json();
  return parseORSResponse(data);
}

function parseORSResponse(data: {
  features: Array<{
    geometry: { coordinates: [number, number, number][] };
    properties: {
      summary: { distance: number; duration: number };
      extras?: { surface?: { values: [number, number, number][] } };
      ascent?: number;
      descent?: number;
    };
    bbox?: number[];
  }>;
  bbox?: number[];
}): RouteResult {
  const feature = data.features[0];
  const coords = feature.geometry.coordinates;
  const { distance: totalDistance, duration: totalDuration } = feature.properties.summary;
  const elevationGain = feature.properties.ascent ?? 0;
  const elevationLoss = feature.properties.descent ?? 0;
  console.log('[ORS] Elevation:', { ascent: feature.properties.ascent, descent: feature.properties.descent, elevationGain, elevationLoss });
  const surfaceValues = feature.properties.extras?.surface?.values ?? [];

  // Build elevation profile
  let cumDist = 0;
  const elevationProfile: { distance: number; elevation: number }[] = [
    { distance: 0, elevation: coords[0]?.[2] ?? 0 },
  ];
  for (let i = 1; i < coords.length; i++) {
    const [lng1, lat1] = coords[i - 1];
    const [lng2, lat2] = coords[i];
    cumDist += haversine(lat1, lng1, lat2, lng2);
    elevationProfile.push({ distance: cumDist, elevation: coords[i][2] ?? 0 });
  }

  // Build surface segments
  const segments: RouteSegment[] = [];
  const categoryDistances: Record<string, number> = {};

  if (surfaceValues.length > 0) {
    for (const [startIdx, endIdx, surfaceCode] of surfaceValues) {
      const segCoords = coords.slice(startIdx, endIdx + 1);
      const surface = getSurfaceInfo(surfaceCode);
      let segDist = 0;
      for (let i = 1; i < segCoords.length; i++) {
        segDist += haversine(segCoords[i - 1][1], segCoords[i - 1][0], segCoords[i][1], segCoords[i][0]);
      }
      segments.push({ coordinates: segCoords, surface, distanceMeters: segDist });
      categoryDistances[surface.category] = (categoryDistances[surface.category] ?? 0) + segDist;
    }
  } else {
    segments.push({
      coordinates: coords,
      surface: getSurfaceInfo(0),
      distanceMeters: totalDistance,
    });
    categoryDistances['unknown'] = totalDistance;
  }

  const surfaceBreakdown = Object.entries(categoryDistances)
    .map(([category, distance]) => ({
      category,
      distance,
      percent: totalDistance > 0 ? (distance / totalDistance) * 100 : 0,
    }))
    .sort((a, b) => b.distance - a.distance);

  // ORS bbox with elevation is [minLng, minLat, minElev, maxLng, maxLat, maxElev]
  // Without elevation it's [minLng, minLat, maxLng, maxLat]
  const rawBbox = feature.bbox ?? data.bbox ?? [0, 0, 0, 0];
  const bbox: [number, number, number, number] = rawBbox.length === 6
    ? [rawBbox[0], rawBbox[1], rawBbox[3], rawBbox[4]]
    : [rawBbox[0], rawBbox[1], rawBbox[2], rawBbox[3]];

  return {
    segments,
    totalDistance,
    totalDuration,
    elevationGain,
    elevationLoss,
    elevationProfile,
    bbox,
    surfaceBreakdown,
  };
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
