import { Ruler, TrendingUp, TrendingDown, Clock, Download, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouteStore } from '../../store/useRouteStore';
import { usePreferences } from '../../store/usePreferences';
import { formatDistance, formatElevation, formatDuration } from '../../lib/units';
import { downloadGPX } from '../../lib/gpx';
import { estimateSpeedMs, formatSpeed } from '../../lib/speed';

export function RouteStats() {
  const route = useRouteStore((s) => s.route);
  const { units, activity, ftp, weight, thresholdPace } = usePreferences();

  if (!route) return null;

  // Use athlete profile for time estimation (assume endurance IF ~0.70-0.75)
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
      <Button variant="outline" size="sm" className="w-full" onClick={handleExport}>
        <Download className="size-3.5 mr-1.5" />
        Export GPX for Garmin
      </Button>
    </div>
  );
}
