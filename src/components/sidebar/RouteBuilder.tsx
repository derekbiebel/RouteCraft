import { MapPin, Trash2, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouteStore } from '../../store/useRouteStore';
import { usePreferences } from '../../store/usePreferences';

export function RouteBuilder() {
  const { waypoints, removeWaypoint, clearRoute } = useRouteStore();
  const { activity, setActivity, surfacePreference, setSurfacePreference } = usePreferences();

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

      {/* Waypoints list */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">
          Waypoints ({waypoints.length})
        </p>
        {waypoints.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 italic py-2">
            Click the map to add waypoints
          </p>
        ) : (
          <div className="space-y-1">
            {waypoints.map((wp, i) => (
              <div
                key={i}
                className="flex items-center gap-2 bg-secondary/50 rounded-md px-2.5 py-1.5 group"
              >
                <MapPin
                  className="size-3.5 shrink-0"
                  style={{
                    color:
                      i === 0
                        ? '#22c55e'
                        : i === waypoints.length - 1 && waypoints.length > 1
                        ? '#ef4444'
                        : '#3b82f6',
                  }}
                />
                <span className="text-xs font-mono flex-1 truncate">
                  {wp[1].toFixed(4)}, {wp[0].toFixed(4)}
                </span>
                <button
                  onClick={() => removeWaypoint(i)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      {waypoints.length > 0 && (
        <Button variant="outline" size="sm" className="w-full" onClick={clearRoute}>
          <RotateCcw className="size-3.5 mr-1.5" />
          Clear Route
        </Button>
      )}
    </div>
  );
}
