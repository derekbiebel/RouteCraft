import { Ruler, TrendingUp, TrendingDown, Clock, Download, Zap, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouteStore } from '../../store/useRouteStore';
import { usePreferences } from '../../store/usePreferences';
import { formatDistance, formatElevation, formatDuration } from '../../lib/units';
import { downloadGPX } from '../../lib/gpx';
import { estimateSpeedMs, formatSpeed } from '../../lib/speed';

export function RouteStats() {
  const route = useRouteStore((s) => s.route);
  const elevationGoalMeters = useRouteStore((s) => s.elevationGoalMeters);
  const { units, activity, ftp, weight, thresholdPace } = usePreferences();

  if (!route) return null;

  const enduranceIF = activity === 'cycling' ? 0.72 : 0.75;
  const speedMs = estimateSpeedMs(activity, enduranceIF, ftp, weight, thresholdPace);
  const estimatedSeconds = route.totalDistance / speedMs;

  const stats = [
    {
      icon: Ruler,
      label: 'Distance',
      value: formatDistance(route.totalDistance, units),
    },
    {
      icon: TrendingUp,
      label: 'Elevation Gain',
      value: formatElevation(route.elevationGain, units),
    },
    {
      icon: TrendingDown,
      label: 'Elevation Loss',
      value: formatElevation(route.elevationLoss, units),
    },
    {
      icon: Clock,
      label: 'Est. Time',
      value: formatDuration(estimatedSeconds),
    },
    {
      icon: Zap,
      label: 'Est. Speed',
      value: formatSpeed(speedMs, activity, units),
    },
  ];

  // Elevation goal comparison
  const hasElevGoal = elevationGoalMeters > 0;
  const elevDiff = hasElevGoal ? route.elevationGain - elevationGoalMeters : 0;
  const elevPercent = hasElevGoal ? Math.round((route.elevationGain / elevationGoalMeters) * 100) : 0;

  const handleExport = () => {
    const name = `RouteCraft ${activity === 'cycling' ? 'Ride' : 'Run'} — ${formatDistance(route.totalDistance, units)}`;
    downloadGPX(route, name);
  };

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="bg-secondary/50 rounded-lg px-3 py-2">
            <div className="flex items-center gap-1.5 mb-0.5">
              <s.icon className="size-3 text-muted-foreground" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{s.label}</p>
            </div>
            <p className="font-mono text-sm font-semibold">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Elevation goal comparison */}
      {hasElevGoal && (
        <div className={`flex items-center gap-2.5 rounded-lg px-3 py-2 border ${
          elevPercent >= 80 && elevPercent <= 120
            ? 'bg-green-50 border-green-200'
            : elevPercent < 50
            ? 'bg-red-50 border-red-200'
            : 'bg-amber-50 border-amber-200'
        }`}>
          <Target className={`size-4 shrink-0 ${
            elevPercent >= 80 && elevPercent <= 120 ? 'text-green-600' : elevPercent < 50 ? 'text-red-500' : 'text-amber-500'
          }`} />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium">
              {elevPercent >= 80 && elevPercent <= 120
                ? 'Elevation goal met!'
                : elevPercent > 120
                ? 'Exceeds elevation goal'
                : elevPercent >= 50
                ? 'Below elevation goal — try shuffling'
                : 'Terrain too flat for this goal'}
            </p>
            <p className="text-[10px] text-muted-foreground">
              Goal: {formatElevation(elevationGoalMeters, units)} · Actual: {formatElevation(route.elevationGain, units)} ({elevPercent}%)
              {elevDiff > 0 ? ` · +${formatElevation(elevDiff, units)} over` : ` · ${formatElevation(Math.abs(elevDiff), units)} short`}
            </p>
          </div>
        </div>
      )}

      <Button variant="outline" size="sm" className="w-full" onClick={handleExport}>
        <Download className="size-3.5 mr-1.5" />
        Export GPX for Garmin
      </Button>
    </div>
  );
}
