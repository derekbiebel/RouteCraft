import { useState } from 'react';
import { Shuffle, Play, Loader2, Coffee, Beer, Clock, Ruler, Mountain, Trees } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useRouteStore } from '../../store/useRouteStore';
import { usePreferences } from '../../store/usePreferences';
import { generateRoundTrip } from '../map/MapView';
import { getDirections, getORSProfile } from '../../lib/ors';
import { fromDisplayDistance, distanceLabel, formatDistance } from '../../lib/units';
import { CATEGORY_COLORS } from '../../lib/surfaces';
import { findPOIsNearPoint, type POI, type POIType } from '../../lib/poi';
import { distanceFromTime, estimateSpeedMs, formatSpeed } from '../../lib/speed';
import maplibregl from 'maplibre-gl';

type GenerateMode = 'distance' | 'time';

export function RouteGenerator() {
  const { waypoints, isLoading, roundTripSeed, newSeed, setRoute, setLoading, setStops, setElevationGoal: setStoreElevGoal } = useRouteStore();
  const prefs = usePreferences();
  const { activity, setActivity, surfacePreference, setSurfacePreference, units,
          avoidances, setAvoidances, ftp, weight, thresholdPace, preferBikeLanes, setPreferBikeLanes } = prefs;

  const [mode, setMode] = useState<GenerateMode>('distance');
  const [targetDistance, setTargetDistance] = useState(5);
  const [targetTime, setTargetTime] = useState(60); // minutes
  const [intensityFactor, setIntensityFactor] = useState(0.75);
  const [includeCoffee, setIncludeCoffee] = useState(false);
  const [includeBrewery, setIncludeBrewery] = useState(false);
  const [includeViewpoint, setIncludeViewpoint] = useState(false);
  const [includePark, setIncludePark] = useState(false);
  const [previewMarkers, setPreviewMarkers] = useState<maplibregl.Marker[]>([]);
  const [routeStopMarkers, setRouteStopMarkers] = useState<maplibregl.Marker[]>([]);
  const [availablePois, setAvailablePois] = useState<POI[]>([]);
  const [selectedStopIds, setSelectedStopIds] = useState<Set<number>>(new Set());
  const [searchingPois, setSearchingPois] = useState(false);
  const [elevationGoal, setElevationGoal] = useState(0); // in display units (ft or m), 0 = no goal
  const [elevationWarning, setElevationWarning] = useState('');

  const startPoint = waypoints[0] ?? null;

  const estimatedSpeed = estimateSpeedMs(activity, intensityFactor, ftp, weight, thresholdPace);
  const estimatedDistance = mode === 'time' ? distanceFromTime(targetTime, activity, intensityFactor, ftp, weight, thresholdPace) : 0;

  const markerConfig: Record<string, { bg: string; emoji: string; label: string }> = {
    brewery: { bg: '#f59e0b', emoji: '🍺', label: 'Brewery' },
    coffee: { bg: '#8b5cf6', emoji: '☕', label: 'Coffee & Cafe' },
    viewpoint: { bg: '#22c55e', emoji: '🏔️', label: 'Viewpoint' },
    park: { bg: '#10b981', emoji: '🌲', label: 'Park' },
  };

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

  const clearPreviewMarkers = () => {
    previewMarkers.forEach((m) => m.remove());
    setPreviewMarkers([]);
  };

  const clearRouteStopMarkers = () => {
    routeStopMarkers.forEach((m) => m.remove());
    setRouteStopMarkers([]);
  };

  // Show POI options on the map when stop types are toggled
  const searchAndShowPois = async (types: POIType[]) => {
    clearPreviewMarkers();
    setAvailablePois([]);
    setSelectedStopIds(new Set());

    if (!startPoint || types.length === 0) return;

    setSearchingPois(true);
    const meters = mode === 'distance' ? fromDisplayDistance(targetDistance, units) : estimatedDistance || 10000;
    // Search radius = full route distance (the route is a loop, so POIs anywhere
    // along the circle are reachable). Minimum 10km.
    const searchRadius = Math.max(10000, meters);

    try {
      const pois = await findPOIsNearPoint(startPoint, types, searchRadius);
      setAvailablePois(pois);

      const mapRef = (window as unknown as Record<string, unknown>).__routecraftMap as {
        current: maplibregl.Map | null;
      };
      if (!mapRef?.current) return;

      const markers = pois.map((poi) => {
        const config = markerConfig[poi.type] ?? markerConfig.coffee;
        const el = document.createElement('div');
        el.className = 'poi-marker';
        el.style.cursor = 'pointer';
        el.innerHTML = `<div class="poi-preview-${poi.id}" style="background:${config.bg};opacity:0.5;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;border:2px solid white;box-shadow:0 2px 4px rgba(0,0,0,0.2);font-size:14px;transition:all 0.2s">${config.emoji}</div>`;

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([poi.lng, poi.lat])
          .setPopup(new maplibregl.Popup({ offset: 16, closeOnClick: false }).setHTML(
            `<div style="font-family:DM Sans,sans-serif;padding:2px 0">
              <strong style="font-size:13px">${poi.name}</strong><br/>
              <span style="font-size:11px;color:#666">${config.label}</span><br/>
              <span style="font-size:10px;color:#999">Click marker to add to route</span>
            </div>`
          ))
          .addTo(mapRef.current!);

        // Click to select/deselect
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          setSelectedStopIds((prev) => {
            const next = new Set(prev);
            if (next.has(poi.id)) {
              next.delete(poi.id);
              el.querySelector('div')!.style.opacity = '0.5';
              el.querySelector('div')!.style.width = '28px';
              el.querySelector('div')!.style.height = '28px';
              el.querySelector('div')!.style.fontSize = '14px';
              el.querySelector('div')!.style.border = '2px solid white';
            } else {
              next.add(poi.id);
              el.querySelector('div')!.style.opacity = '1';
              el.querySelector('div')!.style.width = '36px';
              el.querySelector('div')!.style.height = '36px';
              el.querySelector('div')!.style.fontSize = '18px';
              el.querySelector('div')!.style.border = '3px solid #22c55e';
            }
            return next;
          });
        });

        return marker;
      });

      setPreviewMarkers(markers);
    } catch {
      // silently fail
    } finally {
      setSearchingPois(false);
    }
  };

  // Trigger search when stop types change
  const handleToggleStop = (type: POIType, current: boolean, setter: (v: boolean) => void) => {
    const next = !current;
    setter(next);

    // Build new types list
    const types: POIType[] = [];
    if (type === 'coffee' ? next : includeCoffee) types.push('coffee');
    if (type === 'brewery' ? next : includeBrewery) types.push('brewery');
    if (type === 'viewpoint' ? next : includeViewpoint) types.push('viewpoint');
    if (type === 'park' ? next : includePark) types.push('park');

    searchAndShowPois(types);
  };

  const handleGenerate = async (seed?: number) => {
    if (!startPoint) return;
    clearRouteStopMarkers();
    setStops([]);

    // Store elevation goal for display in RouteStats
    const goalMeters = elevationGoal > 0 ? (units === 'imperial' ? elevationGoal / 3.28084 : elevationGoal) : 0;
    setStoreElevGoal(goalMeters);

    const meters = mode === 'distance'
      ? fromDisplayDistance(targetDistance, units)
      : estimatedDistance;

    // Use user-selected stops if any
    const userSelectedStops = availablePois.filter((p) => selectedStopIds.has(p.id));

    if (userSelectedStops.length > 0) {
      // Clear preview markers since we'll show route stop markers
      clearPreviewMarkers();

      // Sort by angle from start for a logical loop
      const stopsWithAngle = userSelectedStops.map((s) => ({
        stop: s,
        angle: Math.atan2(s.lat - startPoint[1], s.lng - startPoint[0]),
      }));
      stopsWithAngle.sort((a, b) => a.angle - b.angle);
      const orderedStops = stopsWithAngle.map((s) => s.stop);

      const viaPoints: [number, number][] = orderedStops.map((s) => [s.lng, s.lat]);
      const profile = getORSProfile(activity, surfacePreference, preferBikeLanes);
      setLoading(true);

      try {
        const rerouted = await getDirections(
          [startPoint, ...viaPoints, startPoint],
          profile,
          avoidances
        );
        setRoute(rerouted);
        renderOnMap(rerouted);

        const mapRef = (window as unknown as Record<string, unknown>).__routecraftMap as {
          current: maplibregl.Map | null;
        };
        if (mapRef?.current) {
          const markers = orderedStops.map((p) => {
            const config = markerConfig[p.type] ?? markerConfig.coffee;
            const el = document.createElement('div');
            el.className = 'poi-marker';
            el.innerHTML = `<div style="background:${config.bg};border-radius:50%;width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:3px solid #22c55e;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:16px">${config.emoji}</div>`;
            return new maplibregl.Marker({ element: el })
              .setLngLat([p.lng, p.lat])
              .setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(
                `<div style="font-family:DM Sans,sans-serif;padding:2px 0"><strong style="font-size:13px">${p.name}</strong><br/><span style="font-size:11px;color:#666">${config.label}</span></div>`
              ))
              .addTo(mapRef.current!);
          });
          setRouteStopMarkers(markers);
          setStops(orderedStops);
        }
      } catch {
        const fallback = await generateRoundTrip(startPoint, meters, activity, surfacePreference, seed, avoidances);
        if (fallback) renderOnMap(fallback);
      } finally {
        setLoading(false);
      }
      return;
    }

    // No stops selected — generate a normal round trip
    clearPreviewMarkers();
    const result = await generateRoundTrip(startPoint, meters, activity, surfacePreference, seed, avoidances);
    if (result) renderOnMap(result);
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

      {/* Elevation goal */}
      <div>
        <div className="flex justify-between items-baseline mb-1.5">
          <p className="text-xs font-medium text-muted-foreground">Elevation Goal (optional)</p>
          <span className="text-[10px] text-muted-foreground">{units === 'imperial' ? 'ft' : 'm'}</span>
        </div>
        <Input
          type="number"
          value={elevationGoal || ''}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            const val = Math.max(0, Number(e.target.value) || 0);
            setElevationGoal(val);

            // Validate: check if elevation goal is reasonable for the distance
            const meters = mode === 'distance' ? fromDisplayDistance(targetDistance, units) : estimatedDistance;
            const distKm = meters / 1000;
            const goalMeters = units === 'imperial' ? val / 3.28084 : val;
            // Max reasonable grade averages ~8-10% for a full ride
            const maxReasonableElevation = distKm * 100; // 100m per km = 10% avg grade
            // Min reasonable: ~5m per km for flat areas
            const minAvailable = distKm * 5;

            if (val === 0) {
              setElevationWarning('');
            } else if (goalMeters > maxReasonableElevation) {
              const maxDisplay = units === 'imperial'
                ? `${Math.round(maxReasonableElevation * 3.28084).toLocaleString()} ft`
                : `${Math.round(maxReasonableElevation).toLocaleString()} m`;
              setElevationWarning(`That's very steep for this distance. Max reasonable: ~${maxDisplay}`);
            } else if (goalMeters < minAvailable) {
              setElevationWarning('');
            } else {
              setElevationWarning('');
            }
          }}
          placeholder="e.g. 1500"
          className="h-8 font-mono text-sm"
          min={0}
        />
        {elevationWarning && (
          <p className="text-[10px] text-amber-600 mt-1">{elevationWarning}</p>
        )}
      </div>

      {/* Bike lane preference */}
      {activity === 'cycling' && (
        <div>
          <button
            onClick={() => setPreferBikeLanes(!preferBikeLanes)}
            className={`flex items-center gap-2 w-full px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              preferBikeLanes
                ? 'bg-blue-100 text-blue-800 border border-blue-300'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            🚲 Prefer Bike Lanes & Paths
          </button>
        </div>
      )}

      {/* Avoidances */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Avoid</p>
        <div className="flex flex-wrap gap-1.5">
          {([
            { key: 'highways' as const, label: 'Busy Roads' },
            { key: 'steps' as const, label: 'Steps/Stairs' },
          ]).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setAvoidances({ ...avoidances, [key]: !avoidances[key] })}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                avoidances[key]
                  ? 'bg-red-100 text-red-700 border border-red-300'
                  : 'bg-secondary text-secondary-foreground hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <Separator />

      {/* Distance vs Time mode toggle */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Generate By</p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => setMode('distance')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'distance'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            <Ruler className="size-3.5" />
            Distance
          </button>
          <button
            onClick={() => setMode('time')}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              mode === 'time'
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            <Clock className="size-3.5" />
            Time
          </button>
        </div>
      </div>

      {mode === 'distance' ? (
        /* Distance slider */
        <div>
          <div className="flex justify-between items-baseline mb-2">
            <p className="text-xs font-medium text-muted-foreground">Target Distance</p>
            <div className="flex items-baseline gap-1">
              <Input
                type="number"
                value={targetDistance}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                  const max = activity === 'cycling' ? 100 : 30;
                  const val = Math.max(1, Math.min(max, Number(e.target.value) || 1));
                  setTargetDistance(val);
                }}
                className="h-7 w-20 font-mono text-sm text-right"
                min={1}
                max={activity === 'cycling' ? 100 : 30}
                step={0.5}
              />
              <span className="text-xs text-muted-foreground">{distanceLabel(units)}</span>
            </div>
          </div>
          <Slider
            value={[targetDistance]}
            onValueChange={(val) => setTargetDistance(Array.isArray(val) ? val[0] : val)}
            min={1}
            max={activity === 'cycling' ? 100 : 30}
            step={0.5}
          />
        </div>
      ) : (
        /* Time + IF controls */
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <p className="text-xs font-medium text-muted-foreground">Ride/Run Time</p>
              <div className="flex items-baseline gap-1">
                <Input
                  type="number"
                  value={targetTime}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const max = activity === 'cycling' ? 300 : 180;
                    const val = Math.max(15, Math.min(max, Number(e.target.value) || 15));
                    setTargetTime(val);
                  }}
                  className="h-7 w-20 font-mono text-sm text-right"
                  min={15}
                  max={activity === 'cycling' ? 300 : 180}
                  step={5}
                />
                <span className="text-xs text-muted-foreground">min</span>
              </div>
            </div>
            <Slider
              value={[targetTime]}
              onValueChange={(val) => setTargetTime(Array.isArray(val) ? val[0] : val)}
              min={15}
              max={activity === 'cycling' ? 300 : 180}
              step={5}
            />
          </div>

          <div>
            <div className="flex justify-between items-baseline mb-2">
              <p className="text-xs font-medium text-muted-foreground">Intensity Factor</p>
              <p className="font-mono text-sm font-semibold">{intensityFactor.toFixed(2)}</p>
            </div>
            <Slider
              value={[intensityFactor]}
              onValueChange={(val) => setIntensityFactor(Array.isArray(val) ? val[0] : val)}
              min={0.5}
              max={1.1}
              step={0.01}
            />
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>Recovery</span>
              <span>Endurance</span>
              <span>Tempo</span>
              <span>Threshold</span>
            </div>
          </div>

          {/* Estimated values */}
          <div className="bg-secondary/50 rounded-lg px-3 py-2 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Est. Speed</span>
              <span className="font-mono font-semibold">{formatSpeed(estimatedSpeed, activity, units)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Est. Distance</span>
              <span className="font-mono font-semibold">{formatDistance(estimatedDistance, units)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                {activity === 'cycling' ? 'Avg Power' : 'Avg Pace'}
              </span>
              <span className="font-mono font-semibold">
                {activity === 'cycling'
                  ? `${Math.round(ftp * intensityFactor)}W`
                  : formatSpeed(estimatedSpeed, 'running', units)
                }
              </span>
            </div>
          </div>

        </div>
      )}

      {/* Stops toggles */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Include Stops</p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => handleToggleStop('coffee', includeCoffee, setIncludeCoffee)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              includeCoffee
                ? 'bg-purple-100 text-purple-800 border border-purple-300'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            <Coffee className="size-4" />
            Coffee & Cafes
          </button>
          <button
            onClick={() => handleToggleStop('brewery', includeBrewery, setIncludeBrewery)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              includeBrewery
                ? 'bg-amber-100 text-amber-800 border border-amber-300'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            <Beer className="size-4" />
            Brewery
          </button>
          <button
            onClick={() => handleToggleStop('viewpoint', includeViewpoint, setIncludeViewpoint)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              includeViewpoint
                ? 'bg-green-100 text-green-700 border border-green-300'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            <Mountain className="size-4" />
            Viewpoints
          </button>
          <button
            onClick={() => handleToggleStop('park', includePark, setIncludePark)}
            className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
              includePark
                ? 'bg-emerald-100 text-emerald-700 border border-emerald-300'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            <Trees className="size-4" />
            Parks
          </button>
        </div>


        {/* POI search status and selections */}
        {searchingPois && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Loader2 className="size-3 animate-spin" />
            Finding options...
          </div>
        )}

        {availablePois.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] text-muted-foreground">
              {availablePois.length} found — click markers on map to select ({selectedStopIds.size} selected)
            </p>
            {selectedStopIds.size > 0 && (
              <div className="space-y-0.5">
                {availablePois.filter((p) => selectedStopIds.has(p.id)).map((p) => {
                  const config = markerConfig[p.type] ?? markerConfig.coffee;
                  return (
                    <div key={p.id} className="flex items-center gap-1.5 text-xs bg-green-50 rounded px-2 py-1 border border-green-200">
                      <span>{config.emoji}</span>
                      <span className="truncate font-medium">{p.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!searchingPois && (includeCoffee || includeBrewery || includeViewpoint || includePark) && availablePois.length === 0 && startPoint && (
          <p className="text-[10px] text-muted-foreground italic">No options found nearby</p>
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
