import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { UnitSystem } from '../lib/units';

interface Preferences {
  units: UnitSystem;
  activity: 'running' | 'cycling';
  mapStyle: 'streets' | 'outdoors';
  surfacePreference: 'any' | 'paved' | 'unpaved';

  setUnits: (units: UnitSystem) => void;
  setActivity: (activity: 'running' | 'cycling') => void;
  setMapStyle: (style: 'streets' | 'outdoors') => void;
  setSurfacePreference: (pref: 'any' | 'paved' | 'unpaved') => void;
}

export const usePreferences = create<Preferences>()(
  persist(
    (set) => ({
      units: 'imperial',
      activity: 'running',
      mapStyle: 'outdoors',
      surfacePreference: 'any',

      setUnits: (units) => set({ units }),
      setActivity: (activity) => set({ activity }),
      setMapStyle: (style) => set({ mapStyle: style }),
      setSurfacePreference: (pref) => set({ surfacePreference: pref }),
    }),
    { name: 'routecraft-preferences' }
  )
);
