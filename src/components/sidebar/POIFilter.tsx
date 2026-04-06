import { useState } from 'react';
import { Beer, Coffee, Loader2 } from 'lucide-react';
import { useRouteStore } from '../../store/useRouteStore';
import { findPOIsAlongRoute, type POI } from '../../lib/poi';
import maplibregl from 'maplibre-gl';

export function POIFilter() {
  const route = useRouteStore((s) => s.route);
  const [breweries, setBreweries] = useState(false);
  const [coffeeShops, setCoffeeShops] = useState(false);
  const [pois, setPois] = useState<POI[]>([]);
  const [loading, setLoading] = useState(false);
  const [poiMarkers, setPoiMarkers] = useState<maplibregl.Marker[]>([]);

  const clearMarkers = () => {
    poiMarkers.forEach((m) => m.remove());
    setPoiMarkers([]);
    setPois([]);
  };

  const searchPOIs = async (showBreweries: boolean, showCoffee: boolean) => {
    clearMarkers();

    if (!route || (!showBreweries && !showCoffee)) return;

    const types: ('brewery' | 'coffee')[] = [];
    if (showBreweries) types.push('brewery');
    if (showCoffee) types.push('coffee');

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
          const el = document.createElement('div');
          el.className = 'poi-marker';
          el.innerHTML = poi.type === 'brewery'
            ? `<div style="background:#f59e0b;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);cursor:pointer" title="${poi.name}">🍺</div>`
            : `<div style="background:#8b5cf6;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.3);cursor:pointer" title="${poi.name}">☕</div>`;

          const marker = new maplibregl.Marker({ element: el })
            .setLngLat([poi.lng, poi.lat])
            .setPopup(new maplibregl.Popup({ offset: 16 }).setHTML(
              `<div style="font-family:DM Sans,sans-serif;padding:2px 0"><strong style="font-size:13px">${poi.name}</strong><br/><span style="font-size:11px;color:#666">${poi.type === 'brewery' ? 'Brewery' : 'Coffee Shop'}</span></div>`
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

  const toggleBreweries = () => {
    const next = !breweries;
    setBreweries(next);
    searchPOIs(next, coffeeShops);
  };

  const toggleCoffee = () => {
    const next = !coffeeShops;
    setCoffeeShops(next);
    searchPOIs(breweries, next);
  };

  if (!route) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-foreground">Stops Along Route</p>
      <div className="flex gap-2">
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
          Coffee
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
          {pois.map((poi) => (
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
              <span>{poi.type === 'brewery' ? '🍺' : '☕'}</span>
              <span className="truncate font-medium">{poi.name}</span>
            </div>
          ))}
        </div>
      )}

      {!loading && (breweries || coffeeShops) && pois.length === 0 && (
        <p className="text-xs text-muted-foreground italic">No stops found along this route</p>
      )}
    </div>
  );
}
