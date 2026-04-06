import { useState } from 'react';
import { Beer, Coffee, Loader2, Mountain, Trees } from 'lucide-react';
import { useRouteStore } from '../../store/useRouteStore';
import { findPOIsAlongRoute, type POI, type POIType } from '../../lib/poi';
import maplibregl from 'maplibre-gl';

const markerConfig: Record<string, { bg: string; emoji: string; label: string }> = {
  brewery: { bg: '#f59e0b', emoji: '🍺', label: 'Brewery' },
  coffee: { bg: '#8b5cf6', emoji: '☕', label: 'Coffee & Cafe' },
  viewpoint: { bg: '#22c55e', emoji: '🏔️', label: 'Viewpoint' },
  park: { bg: '#10b981', emoji: '🌲', label: 'Park' },
};

export function POIFilter() {
  const route = useRouteStore((s) => s.route);
  const [breweries, setBreweries] = useState(false);
  const [coffeeShops, setCoffeeShops] = useState(false);
  const [viewpoints, setViewpoints] = useState(false);
  const [parks, setParks] = useState(false);
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const [poiMarkers, setPoiMarkers] = useState<maplibregl.Marker[]>([]);

  const clearMarkers = () => {
    poiMarkers.forEach((m) => m.remove());
    setPoiMarkers([]);
    setPois([]);
  };

  const searchPOIs = async (flags: { breweries: boolean; coffee: boolean; viewpoints: boolean; parks: boolean }) => {
    clearMarkers();

    if (!route || (!flags.breweries && !flags.coffee && !flags.viewpoints && !flags.parks)) return;

    const types: POIType[] = [];
    if (flags.breweries) types.push('brewery');
    if (flags.coffee) types.push('coffee');
    if (flags.viewpoints) types.push('viewpoint');
    if (flags.parks) types.push('park');

    const allCoords = route.segments.flatMap((seg) => seg.coordinates);

    setLoading(true);
    try {
      const results = await findPOIsAlongRoute(allCoords, types);
      setPois(results);

      // Add markers to map
      const mapRef = (window as unknown as Record<string, unknown>).__routecraftMap as {
        current: maplibregl.Map | null;
      };
      if (mapRef?.current) {
        const markers = results.map((poi) => {
          const config = markerConfig[poi.type] ?? markerConfig.coffee;
          const el = document.createElement('div');
          el.className = 'poi-marker';
          el.innerHTML = `<div style="background:${config.bg};border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);cursor:pointer" title="${poi.name}">${config.emoji}</div>`;

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([poi.lng, poi.lat])
            .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(
              `<div style="font-family:DM Sans,sans-serif;padding:2px 0"><strong style="font-size:13px">${poi.name}</strong><br/><span style="font-size:11px;color:#666">${config.label}</span></div>`
            ))
            .addTo(mapRef.current!);

          return marker;
        });
        setPoiMarkers(markers);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  const flagsFrom = (overrides: Partial<{ breweries: boolean; coffee: boolean; viewpoints: boolean; parks: boolean }>) => ({
    breweries, coffee: coffeeShops, viewpoints, parks, ...overrides,
  });

  const toggleBreweries = () => { const next = !breweries; setBreweries(next); searchPOIs(flagsFrom({ breweries: next })); };
  const toggleCoffee = () => { const next = !coffeeShops; setCoffeeShops(next); searchPOIs(flagsFrom({ coffee: next })); };
  const toggleViewpoints = () => { const next = !viewpoints; setViewpoints(next); searchPOIs(flagsFrom({ viewpoints: next })); };
  const toggleParks = () => { const next = !parks; setParks(next); searchPOIs(flagsFrom({ parks: next })); };

  if (!route) return null;

  const anyActive = breweries || coffeeShops || viewpoints || parks;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-foreground">Stops Along Route</p>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          onClick={toggleBreweries}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            breweries
              ? 'bg-amber-100 text-amber-800 border border-amber-300'
              : 'bg-secondary text-secondary-foreground hover:bg-accent'
          }`}
        >
          <Beer className="size-4" />
          Breweries
        </button>
        <button
          onClick={toggleCoffee}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            coffeeShops
              ? 'bg-purple-100 text-purple-800 border border-purple-300'
              : 'bg-secondary text-secondary-foreground hover:bg-accent'
          }`}
        >
          <Coffee className="size-4" />
          Coffee & Cafes
        </button>
        <button
          onClick={toggleViewpoints}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            viewpoints
              ? 'bg-green-100 text-green-700 border border-green-300'
              : 'bg-secondary text-secondary-foreground hover:bg-accent'
          }`}
        >
          <Mountain className="size-4" />
          Viewpoints
        </button>
        <button
          onClick={toggleParks}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            parks
              ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
              : 'bg-secondary text-secondary-foreground hover:bg-accent'
          }`}
        >
          <Trees className="size-4" />
          Parks
        </button>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3 animate-spin" />
          Searching nearby...
        </div>
      )}

      {!loading && pois.length > 0 && (
        <div className="space-y-1 max-h-32 overflow-y-auto">
          {pois.map((poi) => {
            const config = markerConfig[poi.type] ?? markerConfig.coffee;
            return (
              <div
                key={poi.id}
                className="flex items-center gap-2 text-xs py-1 px-1 rounded hover:bg-secondary/50 cursor-pointer"
                onClick={() => {
                  const mapRef = (window as unknown as Record<string, unknown>).__routecraftMap as {
                    current: maplibregl.Map | null;
                  };
                  mapRef?.current?.flyTo({ center: [poi.lng, poi.lat], zoom: 16, duration: 800 });
                }}
              >
                <span>{config.emoji}</span>
                <span className="truncate font-medium">{poi.name}</span>
              </div>
            );
          })}
        </div>
      )}

      {!loading && anyActive && pois.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No stops found along this route</p>
      )}
    </div>
  );
}
