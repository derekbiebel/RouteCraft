import { create } from 'zustand';
import type { RouteResult } from '../lib/ors';

interface RouteState {
  waypoints: [number, number][];
  route: RouteResult | null;
  isLoading: boolean;
  error: string | null;
  roundTripSeed: number;

  addWaypoint: (lngLat: [number, number]) => void;
  removeWaypoint: (index: number) => void;
  updateWaypoint: (index: number, lngLat: [number, number]) => void;
  setWaypoints: (waypoints: [number, number][]) => void;
  clearRoute: () => void;
  setRoute: (route: RouteResult) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  newSeed: () => void;
}

export const useRouteStore = create<RouteState>((set) => ({
  waypoints: [],
  route: null,
  isLoading: false,
  error: null,
  roundTripSeed: Math.floor(Math.random() * 100),

  addWaypoint: (lngLat) =>
    set((s) => ({ waypoints: [...s.waypoints, lngLat] })),
  removeWaypoint: (index) =>
    set((s) => ({ waypoints: s.waypoints.filter((_, i) => i !== index) })),
  updateWaypoint: (index, lngLat) =>
    set((s) => ({
      waypoints: s.waypoints.map((w, i) => (i === index ? lngLat : w)),
    })),
  setWaypoints: (waypoints) => set({ waypoints }),
  clearRoute: () => set({ waypoints: [], route: null, error: null }),
  setRoute: (route) => set({ route, error: null }),
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error, isLoading: false }),
  newSeed: () => set({ roundTripSeed: Math.floor(Math.random() * 100) }),
}));
