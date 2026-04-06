// Road safety analysis for cycling/running routes using OpenStreetMap Overpass API

export interface SafetySegment {
  roadType: string;
  hasShoulder: boolean;
  shoulderWidth: string | null;
  hasBikeLane: boolean;
  bikeInfraType: string | null; // 'lane' | 'track' | 'shared_lane' | 'path'
  maxSpeed: number | null;
  lanes: number | null;
  score: number; // 0-100
}

export interface RoadSafetyReport {
  overallScore: number; // 0-100
  overallLabel: string; // 'Excellent' | 'Good' | 'Fair' | 'Poor'
  overallColor: string;
  segments: SafetySegment[];
  summary: {
    hasShoulderPercent: number;
    hasBikeLanePercent: number;
    residentialPercent: number;
    primaryPercent: number;
    avgMaxSpeed: number | null;
  };
}

const OVERPASS_API = 'https://overpass-api.de/api/interpreter';
const SAMPLE_INTERVAL_METERS = 200;
const BUFFER_METERS = 50;

/**
 * Haversine distance between two [lng, lat] points in meters.
 */
function haversineDistance(
  a: [number, number],
  b: [number, number]
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b[1] - a[1]);
  const dLng = toRad(b[0] - a[0]);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a[1])) * Math.cos(toRad(b[1])) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Sample coordinates along the route at roughly every SAMPLE_INTERVAL_METERS.
 * Always includes the first and last point.
 */
function sampleCoordinates(
  coordinates: [number, number, number][]
): [number, number][] {
  if (coordinates.length === 0) return [];
  if (coordinates.length === 1) return [[coordinates[0][0], coordinates[0][1]]];

  const sampled: [number, number][] = [[coordinates[0][0], coordinates[0][1]]];
  let accumulatedDist = 0;

  for (let i = 1; i < coordinates.length; i++) {
    const prev: [number, number] = [coordinates[i - 1][0], coordinates[i - 1][1]];
    const curr: [number, number] = [coordinates[i][0], coordinates[i][1]];
    accumulatedDist += haversineDistance(prev, curr);

    if (accumulatedDist >= SAMPLE_INTERVAL_METERS) {
      sampled.push(curr);
      accumulatedDist = 0;
    }
  }

  // Always include the last point
  const last: [number, number] = [
    coordinates[coordinates.length - 1][0],
    coordinates[coordinates.length - 1][1],
  ];
  const lastSampled = sampled[sampled.length - 1];
  if (last[0] !== lastSampled[0] || last[1] !== lastSampled[1]) {
    sampled.push(last);
  }

  return sampled;
}

/**
 * Compute the bounding box of the sampled points with a buffer in degrees.
 * Returns [south, west, north, east] for Overpass bbox format.
 */
function computeBBox(
  points: [number, number][],
  bufferMeters: number
): [number, number, number, number] {
  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;

  for (const [lng, lat] of points) {
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
  }

  // Approximate degrees for the buffer
  const latBuffer = bufferMeters / 111_320;
  const lngBuffer =
    bufferMeters / (111_320 * Math.cos(((minLat + maxLat) / 2) * (Math.PI / 180)));

  return [
    minLat - latBuffer,
    minLng - lngBuffer,
    maxLat + latBuffer,
    maxLng + lngBuffer,
  ];
}

/**
 * Build an Overpass QL query for highway ways within the bounding box.
 */
function buildOverpassQuery(bbox: [number, number, number, number]): string {
  const [south, west, north, east] = bbox;
  const bboxStr = `${south},${west},${north},${east}`;

  return `
[out:json][timeout:30][bbox:${bboxStr}];
way["highway"~"^(residential|living_street|service|cycleway|path|track|tertiary|tertiary_link|unclassified|secondary|secondary_link|primary|primary_link|trunk|trunk_link)$"];
out tags;
`.trim();
}

interface OverpassElement {
  type: string;
  id: number;
  tags: Record<string, string>;
}

interface OverpassResponse {
  elements: OverpassElement[];
}

/**
 * Query the Overpass API.
 */
async function queryOverpass(query: string): Promise<OverpassResponse> {
  const response = await fetch(OVERPASS_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API error: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<OverpassResponse>;
}

/**
 * Determine the bike infrastructure type from OSM tags.
 */
function detectBikeInfra(
  tags: Record<string, string>
): { hasBikeLane: boolean; bikeInfraType: string | null } {
  const highway = tags.highway || '';
  const cycleway = tags.cycleway || '';
  const cyclewayLeft = tags['cycleway:left'] || '';
  const cyclewayRight = tags['cycleway:right'] || '';
  const cyclewayBoth = tags['cycleway:both'] || '';

  // Check for dedicated cycling infrastructure
  if (highway === 'cycleway' || highway === 'path') {
    return { hasBikeLane: true, bikeInfraType: 'path' };
  }

  const allCycleway = [cycleway, cyclewayLeft, cyclewayRight, cyclewayBoth];

  if (allCycleway.some((v) => v === 'track' || v === 'separate')) {
    return { hasBikeLane: true, bikeInfraType: 'track' };
  }
  if (allCycleway.some((v) => v === 'lane' || v === 'exclusive')) {
    return { hasBikeLane: true, bikeInfraType: 'lane' };
  }
  if (allCycleway.some((v) => v === 'shared_lane' || v === 'shared')) {
    return { hasBikeLane: true, bikeInfraType: 'shared_lane' };
  }

  return { hasBikeLane: false, bikeInfraType: null };
}

/**
 * Score a single road segment based on its OSM tags.
 */
function scoreSegment(tags: Record<string, string>): SafetySegment {
  const highway = tags.highway || 'unknown';
  let score = 50;

  // Highway type scoring
  const safeTypes = ['residential', 'living_street', 'service', 'cycleway', 'path', 'track'];
  const moderateTypes = ['tertiary', 'tertiary_link', 'unclassified'];
  const primaryTypes = ['primary', 'primary_link', 'trunk', 'trunk_link'];

  if (safeTypes.includes(highway)) {
    score += 30;
  } else if (moderateTypes.includes(highway)) {
    score += 15;
  } else if (primaryTypes.includes(highway)) {
    score -= 20;
  }
  // secondary/secondary_link: +0

  // Shoulder
  const shoulder = tags.shoulder || '';
  const shoulderWidth = tags['shoulder:width'] || null;
  const hasShoulder =
    shoulder === 'yes' ||
    shoulder === 'both' ||
    shoulder === 'right' ||
    shoulder === 'left' ||
    !!shoulderWidth;

  if (hasShoulder) {
    score += 10;
    if (shoulderWidth) {
      const widthValue = parseFloat(shoulderWidth);
      if (!isNaN(widthValue) && widthValue >= 1.5) {
        score += 5;
      }
    }
  }

  // Bike infrastructure
  const { hasBikeLane, bikeInfraType } = detectBikeInfra(tags);
  if (hasBikeLane) {
    score += 20;
  }

  // bicycle=designated
  if (tags.bicycle === 'designated') {
    score += 10;
  }

  // Lanes
  const lanesStr = tags.lanes || '';
  const lanes = lanesStr ? parseInt(lanesStr, 10) : null;
  if (lanes !== null && !isNaN(lanes) && lanes >= 4) {
    score -= 15;
  }

  // Max speed
  const maxspeedStr = tags.maxspeed || '';
  let maxSpeed: number | null = null;
  if (maxspeedStr) {
    // Handle formats like "50", "30 mph", "50 km/h"
    const match = maxspeedStr.match(/^(\d+)/);
    if (match) {
      maxSpeed = parseInt(match[1], 10);
      // Convert mph to km/h if tagged as mph
      if (maxspeedStr.toLowerCase().includes('mph')) {
        maxSpeed = Math.round(maxSpeed * 1.60934);
      }
    }
  }

  if (maxSpeed !== null) {
    if (maxSpeed > 80) {
      score -= 20;
    } else if (maxSpeed > 50) {
      score -= 10;
    }
  }

  // Clamp score to 0-100
  score = Math.max(0, Math.min(100, score));

  return {
    roadType: highway,
    hasShoulder,
    shoulderWidth,
    hasBikeLane,
    bikeInfraType,
    maxSpeed,
    lanes: lanes !== null && !isNaN(lanes) ? lanes : null,
    score,
  };
}

/**
 * Derive the overall label and color from the overall score.
 */
function labelFromScore(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'Excellent', color: '#22c55e' };
  if (score >= 60) return { label: 'Good', color: '#84cc16' };
  if (score >= 40) return { label: 'Fair', color: '#f59e0b' };
  return { label: 'Poor', color: '#ef4444' };
}

/**
 * Analyze route safety by querying OSM road data via the Overpass API.
 *
 * @param coordinates - Array of [lng, lat, elevation] from the route.
 * @returns A RoadSafetyReport with per-segment scores and an overall summary.
 */
export async function analyzeRouteSafety(
  coordinates: [number, number, number][]
): Promise<RoadSafetyReport> {
  if (coordinates.length === 0) {
    return {
      overallScore: 0,
      overallLabel: 'Poor',
      overallColor: '#ef4444',
      segments: [],
      summary: {
        hasShoulderPercent: 0,
        hasBikeLanePercent: 0,
        residentialPercent: 0,
        primaryPercent: 0,
        avgMaxSpeed: null,
      },
    };
  }

  // 1. Sample coordinates along the route
  const sampled = sampleCoordinates(coordinates);

  // 2. Compute bounding box with buffer
  const bbox = computeBBox(sampled, BUFFER_METERS);

  // 3. Build and execute the Overpass query
  const query = buildOverpassQuery(bbox);
  const data = await queryOverpass(query);

  // 4. Score each road segment
  const segments: SafetySegment[] = data.elements
    .filter((el) => el.type === 'way' && el.tags?.highway)
    .map((el) => scoreSegment(el.tags));

  if (segments.length === 0) {
    return {
      overallScore: 50,
      overallLabel: 'Fair',
      overallColor: '#f59e0b',
      segments: [],
      summary: {
        hasShoulderPercent: 0,
        hasBikeLanePercent: 0,
        residentialPercent: 0,
        primaryPercent: 0,
        avgMaxSpeed: null,
      },
    };
  }

  // 5. Compute summary statistics
  const total = segments.length;
  const hasShoulderCount = segments.filter((s) => s.hasShoulder).length;
  const hasBikeLaneCount = segments.filter((s) => s.hasBikeLane).length;

  const residentialTypes = ['residential', 'living_street', 'service'];
  const primaryTypes = ['primary', 'primary_link', 'trunk', 'trunk_link'];
  const residentialCount = segments.filter((s) => residentialTypes.includes(s.roadType)).length;
  const primaryCount = segments.filter((s) => primaryTypes.includes(s.roadType)).length;

  const speedValues = segments
    .map((s) => s.maxSpeed)
    .filter((v): v is number => v !== null);
  const avgMaxSpeed =
    speedValues.length > 0
      ? Math.round(speedValues.reduce((a, b) => a + b, 0) / speedValues.length)
      : null;

  const overallScore = Math.round(
    segments.reduce((sum, s) => sum + s.score, 0) / total
  );

  const { label, color } = labelFromScore(overallScore);

  return {
    overallScore,
    overallLabel: label,
    overallColor: color,
    segments,
    summary: {
      hasShoulderPercent: Math.round((hasShoulderCount / total) * 100),
      hasBikeLanePercent: Math.round((hasBikeLaneCount / total) * 100),
      residentialPercent: Math.round((residentialCount / total) * 100),
      primaryPercent: Math.round((primaryCount / total) * 100),
      avgMaxSpeed,
    },
  };
}
