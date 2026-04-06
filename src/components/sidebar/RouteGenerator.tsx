import { useState } from 'react';
import { Shuffle, Play, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { useRouteStore } from '../../store/useRouteStore';
import { usePreferences } from '../../store/usePreferences';
import { generateRoundTrip } from '../map/MapView';
import { fromDisplayDistance, distanceLabel } from '../../lib/units';

export function RouteGenerator() {
  const { waypoints, isLoading, roundTripSeed, newSeed } = useRouteStore();
  const { activity, setActivity, surfacePreference, setSurfacePreference, units } = usePreferences();
  const [targetDistance, setTargetDistance] = useState(5); // in display units

  const startPoint = waypoints[0] ?? null;

  const handleGenerate = async (seed?: number) => {
    if (!startPoint) return;
    const meters = fromDisplayDistance(targetDistance, units);
    const result = await generateRoundTrip(startPoint, meters, activity, surfacePreference, seed);
    if (result) {
      // Render on map
      const mapRef = (window as Record<string, unknown>).__routecraftMap as React.RefObject<{ getSource: (id: string) => { setData: (data: unknown) => void } | undefined; fitBounds: (bounds: [[number, number], [number, number]], opts: unknown) => void }>;
      if (mapRef?.current) {
        const source = mapRef.current.getSource('route') as { setData: (data: unknown) => void } | undefined;
        if (source) {
          const { CATEGORY_COLORS } = await import('../../lib/surfaces');
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
      }
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
          onValueChange={([v]) => setTargetDistance(v)}
          min={1}
          max={activity === 'cycling' ? 100 : 30}
          step={0.5}
        />
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
