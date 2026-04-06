# RouteCraft — Route Planning for Runners & Cyclists

## What This Is
A route planning app with surface-type visualization. Built with React + Vite + TypeScript + Tailwind + shadcn/ui + Mapbox GL JS + OpenRouteService + D3.

## Quick Start
```bash
cd /Users/derekbiebel/routecraft
npm run dev        # starts on http://localhost:5173
npm run build      # production build
```

## Architecture
- Single-page app (no router)
- Mapbox GL JS for map rendering + geocoding
- OpenRouteService for routing (directions + round-trip generation)
- Zustand for state (useRouteStore + usePreferences)
- D3 for elevation profile chart
- localStorage for saved routes

## API Keys (.env)
```
VITE_MAPBOX_TOKEN=   # Mapbox GL JS + geocoding (https://account.mapbox.com/access-tokens/)
VITE_ORS_API_KEY=    # OpenRouteService directions (https://openrouteservice.org/dev/#/signup)
```

## Key Files
```
src/
├── components/
│   ├── map/
│   │   ├── MapView.tsx        # Mapbox GL map + route rendering + waypoint markers
│   │   └── MapControls.tsx    # Style toggle (streets/outdoors)
│   ├── sidebar/
│   │   ├── Sidebar.tsx        # Main sidebar with tabs (Build/Generate)
│   │   ├── SearchBar.tsx      # Mapbox geocoding address search
│   │   ├── RouteBuilder.tsx   # Manual waypoint routing controls
│   │   ├── RouteGenerator.tsx # Round-trip loop generator
│   │   ├── RouteStats.tsx     # Distance, elevation, time display
│   │   └── SavedRoutes.tsx    # Save/load routes (localStorage)
│   └── charts/
│       ├── ElevationProfile.tsx    # D3 elevation chart
│       └── SurfaceBreakdown.tsx    # Surface type stacked bar
├── store/
│   ├── useRouteStore.ts       # Zustand: waypoints, route, loading
│   └── usePreferences.ts     # Zustand (persisted): units, activity, map style
├── lib/
│   ├── ors.ts                 # OpenRouteService API client
│   ├── surfaces.ts            # Surface type codes, colors, labels
│   ├── units.ts               # Imperial/metric conversion
│   └── storage.ts             # localStorage save/load
└── App.tsx                    # Layout: sidebar + map (responsive)
```

## Conventions
- shadcn/ui components: lowercase filenames (button.tsx, card.tsx)
- Fonts: DM Sans (UI), JetBrains Mono (numbers/data)
- Strict TypeScript (noUnusedLocals, noUnusedParameters)
- All stored distances in meters, converted at render time
- Surface colors: trail=#4ade80, paved=#94a3b8, gravel=#f59e0b, road=#60a5fa
