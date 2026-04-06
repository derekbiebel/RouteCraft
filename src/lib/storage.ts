export interface SavedRoute {
  id: string;
  name: string;
  createdAt: string;
  activity: 'running' | 'cycling';
  waypoints: [number, number][];
  totalDistance: number;
  elevationGain: number;
}

const STORAGE_KEY = 'routecraft-saved-routes';

export function getSavedRoutes(): SavedRoute[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveRoute(route: SavedRoute): void {
  const routes = getSavedRoutes();
  routes.unshift(route);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
}

export function deleteRoute(id: string): void {
  const routes = getSavedRoutes().filter((r) => r.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(routes));
}
