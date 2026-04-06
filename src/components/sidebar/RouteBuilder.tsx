import { useState } from 'react';
import { MapPin, Trash2, RotateCcw, CornerDownLeft, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useRouteStore } from '../../store/useRouteStore';
import { usePreferences } from '../../store/usePreferences';
import { Settings2 } from 'lucide-react';

export function RouteBuilder() {
  const { waypoints, removeWaypoint, clearRoute, addWaypoint } = useRouteStore();
  const { activity, setActivity, surfacePreference, setSurfacePreference, avoidances, setAvoidances,
          ftp, setFtp, weight, setWeight, thresholdPace, setThresholdPace, units } = usePreferences();
  const [returnToStart, setReturnToStart] = useState(false);
  const [showAthleteSettings, setShowAthleteSettings] = useState(false);

  // When toggling return-to-start, add/remove the start point as last waypoint
  const handleReturnToggle = () => {
    const next = !returnToStart;
    setReturnToStart(next);
    if (next && waypoints.length >= 2) {
      // Add start point as last waypoint
      const start = waypoints[0];
      const last = waypoints[waypoints.length - 1];
      if (start[0] !== last[0] || start[1] !== last[1]) {
        addWaypoint(start);
      }
    } else if (!next && waypoints.length >= 3) {
      // Remove last waypoint if it matches start
      const start = waypoints[0];
      const last = waypoints[waypoints.length - 1];
      if (start[0] === last[0] && start[1] === last[1]) {
        removeWaypoint(waypoints.length - 1);
      }
    }
  };

  return (
    <div className="space-y-4">
      {/* Route type */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-1.5">Route Type</p>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            onClick={() => { if (returnToStart) handleReturnToggle(); }}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              !returnToStart
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            <Navigation className="size-3.5" />
            A → B
          </button>
          <button
            onClick={() => { if (!returnToStart) handleReturnToggle(); }}
            className={`flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              returnToStart
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-accent'
            }`}
          >
            <CornerDownLeft className="size-3.5" />
            Round Trip
          </button>
        </div>
      </div>

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
            {waypoints.map((wp, i) => {
              const isStart = i === 0;
              const isEnd = i === waypoints.length - 1 && waypoints.length > 1;
              const isReturn = isEnd && returnToStart && wp[0] === waypoints[0][0] && wp[1] === waypoints[0][1];
              const color = isStart ? '#22c55e' : isReturn ? '#22c55e' : isEnd ? '#ef4444' : '#3b82f6';

              return (
                <div
                  key={i}
                  className="flex items-center gap-2 bg-secondary/50 rounded-md px-2.5 py-1.5 group"
                >
                  <MapPin className="size-3.5 shrink-0" style={{ color }} />
                  <span className="text-xs font-mono flex-1 truncate">
                    {isReturn ? 'Return to Start' : `${wp[1].toFixed(4)}, ${wp[0].toFixed(4)}`}
                  </span>
                  {!isReturn && (
                    <button
                      onClick={() => removeWaypoint(i)}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Actions */}
      {waypoints.length > 0 && (
        <Button variant="outline" size="sm" className="w-full" onClick={() => { clearRoute(); setReturnToStart(false); }}>
          <RotateCcw className="size-3.5 mr-1.5" />
          Clear Route
        </Button>
      )}

      <Separator />

      {/* Athlete settings */}
      <button
        onClick={() => setShowAthleteSettings(!showAthleteSettings)}
        className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        <Settings2 className="size-3.5" />
        {showAthleteSettings ? 'Hide Athlete Settings' : 'Athlete Settings'}
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
  );
}
