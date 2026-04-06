import { useState } from 'react';
import { Shuffle, Play, Loader2, Coffee, Beer, Clock, Ruler, Settings2 } from 'lucide-react';
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
import { findPOIsAlongRoute, type POI } from '../../lib/poi';
import { distanceFromTime, estimateSpeedMs, formatSpeed } from '../../lib/speed';
import maplibregl from 'maplibre-gl';

type GenerateMode = 'distance' | 'time';

export function RouteGenerator() {
  const { waypoints, isLoading, roundTripSeed, newSeed, setRoute, setLoading, setStops } = useRouteStore();
  const prefs = usePreferences();
  const { activity, setActivity, surfacePreference, setSurfacePreference, units,
          avoidances, setAvoidances, ftp, setFtp, weight, setWeight, thresholdPace, setThresholdPace } = prefs;

  const [mode, setMode] = useState<GenerateMode>('distance');
  const [targetDistance, setTargetDistance] = useState(5);
  const [targetTime, setTargetTime] = useState(60); // minutes
  const [intensityFactor, setIntensityFactor] = useState(0.75);
  const [includeCoffee, setIncludeCoffee] = useState(false);
  const [includeBrewery, setIncludeBrewery] = useState(false);
  const [stopRadius, setStopRadius] = useState(800);
  const [stopMarkers, setStopMarkers] = useState<maplibregl.Marker[]>([]);
  const [showAthleteSettings, setShowAthleteSettings] = useState(false);

  const startPoint = waypoints[0] ?? null;

  // Calculate estimated values for time mode
  const estimatedSpeed = estimateSpeedMs(activity, intensityFactor, ftp, weight, thresholdPace);
  const estimatedDistance = mode === 'time' ? distanceFromTime(targetTime, activity, intensityFactor, ftp, weight, thresholdPace) : 0;

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
    setStops([]);

    // Calculate distance
    const meters = mode === 'distance'
      ? fromDisplayDistance(targetDistance, units)
      : estimatedDistance;

    const result = await generateRoundTrip(startPoint, meters, activity, surfacePreference, seed, avoidances);
    if (!result) return;

    const wantStops = includeCoffee || includeBrewery;

    if (wantStops) {
      const allCoords = result.segments.flatMap((seg) => seg.coordinates);
      const searchTypes: ('coffee' | 'brewery')[] = [];
      if (includeCoffee) searchTypes.push('coffee');
      if (includeBrewery) searchTypes.push('brewery');

      const pois = await findPOIsAlongRoute(allCoords, searchTypes, stopRadius);

      if (pois.length > 0) {
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

        let secondPoi: POI | null = null;
        if (includeCoffee && includeBrewery) {
          const otherType = bestPoi.type === 'coffee' ? 'brewery' : 'coffee';
          const others = pois.filter((p) => p.type === otherType);
          if (others.length > 0) {
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

        const viaPoints: [number, number][] = [];
        if (secondPoi) {
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
            profile,
            avoidances
          );
          setRoute(rerouted);
          renderOnMap(rerouted);

          const mapRef = (window as unknown as Record<string, unknown>).__routecraftMap as {
            current: maplibregl.Map | null;
          };
          if (mapRef?.current) {
            const allStops = [bestPoi, ...(secondPoi ? [secondPoi] : [])];
            const markers = allStops.map((p) => addStopMarker(p, mapRef.current!));
            setStopMarkers(markers);
            setStops(allStops);
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

      {/* Avoidances */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Avoid</p>
        <div className="flex flex-wrap gap-1.5">
          {([
            { key: 'highways' as const, label: 'Busy Roads' },
            { key: 'steps' as const, label: 'Steps/Stairs' },
            { key: 'ferries' as const, label: 'Ferries' },
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
      ) : (
        /* Time + IF controls */
        <div className="space-y-3">
          <div>
            <div className="flex justify-between items-baseline mb-2">
              <p className="text-xs font-medium text-muted-foreground">Ride/Run Time</p>
              <p className="font-mono text-sm font-semibold">
                {targetTime >= 60 ? `${Math.floor(targetTime / 60)}h ${targetTime % 60}m` : `${targetTime}m`}
              </p>
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

          {/* Athlete settings */}
          <button
            onClick={() => setShowAthleteSettings(!showAthleteSettings)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Settings2 className="size-3.5" />
            {showAthleteSettings ? 'Hide' : 'Athlete Settings'}
          </button>

          {showAthleteSettings && (
            <div className="bg-secondary/30 rounded-lg p-3 space-y-3">
              {activity === 'cycling' ? (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">FTP (watts)</label>
                  <Input
                    type="number"
                    value={ftp}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setFtp(Number(e.target.value) || 100)}
                    className="h-8 mt-1 font-mono text-sm"
                    min={50}
                    max={500}
                  />
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Threshold Pace ({units === 'imperial' ? 'min/mi' : 'min/km'})
                  </label>
                  <div className="flex gap-1 mt-1">
                    <Input
                      type="number"
                      value={Math.floor((units === 'imperial' ? thresholdPace * 1.60934 : thresholdPace) / 60)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const min = Number(e.target.value) || 0;
                        const sec = (units === 'imperial' ? thresholdPace * 1.60934 : thresholdPace) % 60;
                        const totalSec = min * 60 + sec;
                        setThresholdPace(units === 'imperial' ? totalSec / 1.60934 : totalSec);
                      }}
                      className="h-8 font-mono text-sm w-16"
                      min={3}
                      max={15}
                      placeholder="min"
                    />
                    <span className="text-sm self-center">:</span>
                    <Input
                      type="number"
                      value={Math.round((units === 'imperial' ? thresholdPace * 1.60934 : thresholdPace) % 60)}
                      onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                        const sec = Math.min(59, Number(e.target.value) || 0);
                        const min = Math.floor((units === 'imperial' ? thresholdPace * 1.60934 : thresholdPace) / 60);
                        const totalSec = min * 60 + sec;
                        setThresholdPace(units === 'imperial' ? totalSec / 1.60934 : totalSec);
                      }}
                      className="h-8 font-mono text-sm w-16"
                      min={0}
                      max={59}
                      placeholder="sec"
                    />
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs font-medium text-muted-foreground">
                  Weight ({units === 'imperial' ? 'lbs' : 'kg'})
                </label>
                <Input
                  type="number"
                  value={units === 'imperial' ? Math.round(weight * 2.20462) : weight}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                    const val = Number(e.target.value) || 50;
                    setWeight(units === 'imperial' ? val / 2.20462 : val);
                  }}
                  className="h-8 mt-1 font-mono text-sm"
                />
              </div>
            </div>
          )}
        </div>
      )}

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
