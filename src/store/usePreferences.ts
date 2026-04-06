import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UnitSystem } from '../lib/units';

export interface Avoidances {
  highways: boolean;
  steps: boolean;
  ferries: boolean;
}

interface Preferences {
  units: UnitSystem;
  activity: 'running' | 'cycling';
  mapStyle: 'streets' | 'outdoors' | 'satellite';
  surfacePreference: 'any' | 'paved' | 'unpaved';
  avoidances: Avoidances;

  // Athlete profile
  ftp: number; // watts (cycling)
  weight: number; // kg
  thresholdPace: number; // sec/km (running)

  // Saved starting locations
  savedLocations: { name: string; lngLat: [number, number] }[];
  defaultLocation: { name: string; lngLat: [number, number] } | null;

  setUnits: (units: UnitSystem) => void;
  setActivity: (activity: 'running' | 'cycling') => void;
  setMapStyle: (style: 'streets' | 'outdoors' | 'satellite') => void;
  setSurfacePreference: (pref: 'any' | 'paved' | 'unpaved') => void;
  setAvoidances: (avoidances: Avoidances) => void;
  setFtp: (ftp: number) => void;
  setWeight: (weight: number) => void;
  setThresholdPace: (pace: number) => void;
  addSavedLocation: (name: string, lngLat: [number, number]) => void;
  removeSavedLocation: (name: string) => void;
  setDefaultLocation: (loc: { name: string; lngLat: [number, number] } | null) => void;
}

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      units: 'imperial',
      activity: 'running',
      mapStyle: 'outdoors',
      surfacePreference: 'any',
      avoidances: { highways: false, steps: false, ferries: false },
      ftp: 200,
      weight: 75,
      thresholdPace: 300, // 5:00/km
      savedLocations: [],
      defaultLocation: null,

      setUnits: (units) => set({ units }),
      setActivity: (activity) => set({ activity }),
      setMapStyle: (style) => set({ mapStyle: style }),
      setSurfacePreference: (pref) => set({ surfacePreference: pref }),
      setAvoidances: (avoidances) => set({ avoidances }),
      setFtp: (ftp) => set({ ftp }),
      setWeight: (weight) => set({ weight }),
      setThresholdPace: (pace) => set({ thresholdPace: pace }),
      addSavedLocation: (name, lngLat) =>
        set((s) => ({
          savedLocations: s.savedLocations.some((l) => l.name === name)
            ? s.savedLocations
            : [...s.savedLocations, { name, lngLat }],
        })),
      removeSavedLocation: (name) =>
        set((s) => ({
          savedLocations: s.savedLocations.filter((l) => l.name !== name),
          defaultLocation: s.defaultLocation?.name === name ? null : s.defaultLocation,
        })),
      setDefaultLocation: (loc) => set({ defaultLocation: loc }),
    }),
    { name: 'routecraft-preferences' }
  )
);
