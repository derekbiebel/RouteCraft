import { useState } from 'react';
import { Shuffle, Play, Loader2, Coffee, Beer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useRouteStore } from '../../store/useRouteStore';
import { usePreferences } from '../../store/usePreferences';
import { generateRoundTrip } from '../map/MapView';
import { getDirections, getORSProfile } from '../../lib/ors';
import { fromDisplayDistance, distanceLabel } from '../../lib/units';
import { CATEGORY_COLORS } from '../../lib/surfaces';
import { findPOIsAlongRoute, type POI } from '../../lib/poi';
import maplibregl from 'maplibre-gl';

export function RouteGenerator() {
  const { waypoints, isLoading, roundTripSeed, newSeed, setRoute, setLoading } = useRouteStore();
  const { activity, setActivity, surfacePreference, setSurfacePreference, units } = usePreferences();
  const [targetDistance, setTargetDistance] = useState(5);
  const [includeCoffee, setIncludeCoffee] = useState(false);
  const [includeBrewery, setIncludeBrewery] = useState(false);
  const [stopRadius, setStopRadius] = useState(800);
  const [stopMarkers, setStopMarkers] = useState<maplibregl.Marker[]>([]);

  const startPoint = waypoints[0] ?? null;

  const renderOnMap = (result: { segments: { coordinates: [number, number, number][]; surface: { category: string } }[]; bbox: [number, number, number, number] }) => {
    const mapRef = (window as unknown as Record<string, unknown>).__routecraftMap as {
      current: maplibregl.Map | null;
    };
    if (!mapRef?.current) return;

    const source = mapRef.current.getSource('route') as maplibregl.GeoJSONSource | undefined;
    if (source) {
      const features = result.segments.map((seg) => ({
        type: 'Feature' as const,
        properties: { color: CATEGORY_COLORS[seg.surface.category] ?? '#a1a1aa' },
        geometry: {
          type: 'LineString' as const,
          coordinates: seg.coordinates,
        },
      }));
      source.setData({ type: 'FeatureCollection', features });
    }
    if (result.bbox) {
      const [minLng, minLat, maxLng, maxLat] = result.bbox;
      mapRef.current.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 80, duration: 500 });
    }
  };

  const clearStopMarkers = () => {
    stopMarkers.forEach((m) => m.remove());
    setStopMarkers([]);
  };

  const addStopMarker = (poi: POI, map: maplibregl.Map): maplibregl.Marker => {
    const isBrew = poi.type === 'brewery';
    const el = document.createElement('div');
    el.innerHTML = `<div style="background:${isBrew ? '#f59e0b' : '#8b5cf6'};border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:16px">${isBrew ? '🍺' : '☕'}</div>`;
    return new maplibregl.Marker({ element: el })
      .setLngLat([poi.lng, poi.lat])
      .setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(
        `<div style="font-family:DM Sans,sans-serif;padding:2px 0"><strong style="font-size:13px">${poi.name}</strong><br/><span style="font-size:11px;color:#666">${isBrew ? 'Brewery' : 'Coffee Shop'}</span></div>`
      ))
      .addTo(map);
  };

  const handleGenerate = async (seed?: number) => {
    if (!startPoint) return;
    clearStopMarkers();

    const meters = fromDisplayDistance(targetDistance, units);
    const result = await generateRoundTrip(startPoint, meters, activity, surfacePreference, seed);
    if (!result) return;

    const wantStops = includeCoffee || includeBrewery;

    if (wantStops) {
      const allCoords = result.segments.flatMap((seg) => seg.coordinates);
      const searchTypes: ('coffee' | 'brewery')[] = [];
      if (includeCoffee) searchTypes.push('coffee');
      if (includeBrewery) searchTypes.push('brewery');

      const pois = await findPOIsAlongRoute(allCoords, searchTypes, stopRadius);

      if (pois.length > 0) {
        // Pick the best stop closest to the midpoint
        const midIdx = Math.floor(allCoords.length / 2);
        const midPoint = allCoords[midIdx];

        let bestPoi = pois[0];
        let bestDist = Infinity;
        for (const poi of pois) {
          const d = Math.hypot(poi.lat - midPoint[1], poi.lng - midPoint[0]);
          if (d < bestDist) {
            bestDist = d;
            bestPoi = poi;
          }
        }

        // If both types enabled, also try to find a second stop of the other type
        let secondPoi: POI | null = null;
        if (includeCoffee && includeBrewery) {
          const otherType = bestPoi.type === 'coffee' ? 'brewery' : 'coffee';
          const others = pois.filter((p) => p.type === otherType);
          if (others.length > 0) {
            // Pick one in the other half of the route
            const quarterIdx = Math.floor(allCoords.length / 4);
            const quarterPoint = allCoords[quarterIdx];
            let best2 = others[0];
            let best2Dist = Infinity;
            for (const p of others) {
              const d = Math.hypot(p.lat - quarterPoint[1], p.lng - quarterPoint[0]);
              if (d < best2Dist) {
                best2Dist = d;
                best2 = p;
              }
            }
            secondPoi = best2;
          }
        }

        // Build waypoints: start → stop(s) → start
        const viaPoints: [number, number][] = [];
        if (secondPoi) {
          // Order by which comes first along the route
          const dist1 = Math.hypot(bestPoi.lat - allCoords[0][1], bestPoi.lng - allCoords[0][0]);
          const dist2 = Math.hypot(secondPoi.lat - allCoords[0][1], secondPoi.lng - allCoords[0][0]);
          if (dist1 < dist2) {
            viaPoints.push([bestPoi.lng, bestPoi.lat], [secondPoi.lng, secondPoi.lat]);
          } else {
            viaPoints.push([secondPoi.lng, secondPoi.lat], [bestPoi.lng, bestPoi.lat]);
          }
        } else {
          viaPoints.push([bestPoi.lng, bestPoi.lat]);
        }

        const profile = getORSProfile(activity, surfacePreference);
        setLoading(true);
        try {
          const rerouted = await getDirections(
            [startPoint, ...viaPoints, startPoint],
            profile
          );
          setRoute(rerouted);
          renderOnMap(rerouted);

          // Add markers
          const mapRef = (window as unknown as Record<string, unknown>).__routecraftMap as {
            current: maplibregl.Map | null;
          };
          if (mapRef?.current) {
            const markers = [bestPoi, ...(secondPoi ? [secondPoi] : [])].map((p) =>
              addStopMarker(p, mapRef.current!)
            );
            setStopMarkers(markers);
          }
        } catch {
          renderOnMap(result);
        } finally {
          setLoading(false);
        }
      } else {
        renderOnMap(result);
      }
    } else {
      renderOnMap(result);
    }
  };

  return (
    <div className="space-y-4">
      {/* Activity toggle */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Activity</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(['running', 'cycling'] as const).map((a) => (
            <button
              key={a}
              onClick={() => setActivity(a)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activity === a
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-accent'
              }`}
            >
              {a === 'running' ? 'Running' : 'Cycling'}
            </button>
          ))}
        </div>
      </div>

      {/* Surface preference */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Surface Preference</p>
        <div className="grid grid-cols-3 gap-1.5">
          {(['any', 'paved', 'unpaved'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSurfacePreference(s)}
              className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors capitalize ${
                surfacePreference === s
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-accent'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Target distance */}
      <div>
        <div className="flex justify-between items-baseline mb-2">
          <p className="text-xs font-medium text-muted-foreground">Target Distance</p>
          <p className="font-mono text-sm font-semibold">
            {targetDistance} {distanceLabel(units)}
          </p>
        </div>
        <Slider
          value={[targetDistance]}
          onValueChange={(val) => setTargetDistance(Array.isArray(val) ? val[0] : val)}
          min={1}
          max={activity === 'cycling' ? 100 : 30}
          step={0.5}
        />
      </div>

      {/* Stops toggles */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Include Stops</p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setIncludeCoffee(!includeCoffee)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              includeCoffee
                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            <Coffee className="size-4" />
            Coffee
          </button>
          <button
            onClick={() => setIncludeBrewery(!includeBrewery)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              includeBrewery
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            <Beer className="size-4" />
            Brewery
          </button>
        </div>

        {(includeCoffee || includeBrewery) && (
          <div>
            <div className="flex justify-between items-baseline mb-1.5">
              <p className="text-xs font-medium text-muted-foreground">Search Radius</p>
              <p className="font-mono text-xs font-semibold">
                {units === 'imperial'
                  ? `${(stopRadius * 3.28084 / 5280).toFixed(1)} mi`
                  : `${stopRadius >= 1000 ? (stopRadius / 1000).toFixed(1) + ' km' : stopRadius + ' m'}`
                }
              </p>
            </div>
            <Slider
              value={[stopRadius]}
              onValueChange={(val) => setStopRadius(Array.isArray(val) ? val[0] : val)}
              min={200}
              max={3000}
              step={100}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              Route will detour through the nearest {includeCoffee && includeBrewery ? 'coffee shop & brewery' : includeCoffee ? 'coffee shop' : 'brewery'}
            </p>
          </div>
        )}
      </div>

      {/* Start point status */}
      <div className="bg-secondary/50 rounded-md px-3 py-2">
        {startPoint ? (
          <p className="text-xs text-foreground">
            Start: <span className="font-mono">{startPoint[1].toFixed(4)}, {startPoint[0].toFixed(4)}</span>
          </p>
        ) : (
          <p className="text-xs text-muted-foreground italic">Click the map to set a start point</p>
        )}
      </div>

      {/* Generate buttons */}
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={!startPoint || isLoading}
          onClick={() => handleGenerate(roundTripSeed)}
        >
          {isLoading ? (
            <Loader2 className="size-4 mr-1.5 animate-spin" />
          ) : (
            <Play className="size-4 mr-1.5" />
          )}
          Generate Route
        </Button>
        <Button
          variant="outline"
          size="icon"
          disabled={!startPoint || isLoading}
          onClick={() => {
            newSeed();
            handleGenerate();
          }}
          title="Generate a different route"
        >
          <Shuffle className="size-4" />
        </Button>
      </div>
    </div>
  );
}
