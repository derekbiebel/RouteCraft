export interface SurfaceInfo {
  name: string;
  category: 'paved' | 'gravel' | 'trail' | 'road' | 'unknown';
  color: string;
}

// ORS surface type codes → display info
// See: https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/extra-info/surface
const SURFACE_MAP: Record<number, SurfaceInfo> = {
  0: { name: 'Unknown', category: 'unknown', color: '#a1a1aa' },
  1: { name: 'Paved', category: 'paved', color: '#94a3b8' },
  2: { name: 'Unpaved', category: 'trail', color: '#4ade80' },
  3: { name: 'Asphalt', category: 'road', color: '#60a5fa' },
  4: { name: 'Concrete', category: 'paved', color: '#94a3b8' },
  5: { name: 'Cobblestone', category: 'paved', color: '#94a3b8' },
  6: { name: 'Metal', category: 'paved', color: '#94a3b8' },
  7: { name: 'Wood', category: 'trail', color: '#4ade80' },
  8: { name: 'Compacted Gravel', category: 'gravel', color: '#f59e0b' },
  9: { name: 'Fine Gravel', category: 'gravel', color: '#f59e0b' },
  10: { name: 'Gravel', category: 'gravel', color: '#f59e0b' },
  11: { name: 'Dirt', category: 'trail', color: '#4ade80' },
  12: { name: 'Ground', category: 'trail', color: '#4ade80' },
  13: { name: 'Ice', category: 'unknown', color: '#bfdbfe' },
  14: { name: 'Paving Stones', category: 'paved', color: '#94a3b8' },
  15: { name: 'Sand', category: 'trail', color: '#fde68a' },
  16: { name: 'Woodchips', category: 'trail', color: '#4ade80' },
  17: { name: 'Grass', category: 'trail', color: '#4ade80' },
  18: { name: 'Grass Paver', category: 'trail', color: '#4ade80' },
};

export function getSurfaceInfo(code: number): SurfaceInfo {
  return SURFACE_MAP[code] ?? SURFACE_MAP[0];
}

export const CATEGORY_COLORS: Record<string, string> = {
  paved: '#94a3b8',
  gravel: '#f59e0b',
  trail: '#4ade80',
  road: '#60a5fa',
  unknown: '#a1a1aa',
};

export const CATEGORY_LABELS: Record<string, string> = {
  paved: 'Paved Path',
  gravel: 'Gravel',
  trail: 'Trail / Dirt',
  road: 'Road',
  unknown: 'Unknown',
};
