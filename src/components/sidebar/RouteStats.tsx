import { Ruler, TrendingUp, TrendingDown, Clock } from 'lucide-react';
import { useRouteStore } from '../../store/useRouteStore';
import { usePreferences } from '../../store/usePreferences';
import { formatDistance, formatElevation, formatDuration } from '../../lib/units';

export function RouteStats() {
  const route = useRouteStore((s) => s.route);
  const { units, activity } = usePreferences();

  if (!route) return null;

  // Estimate time based on activity
  const estimatedSeconds =
    activity === 'cycling'
      ? route.totalDistance / 5.5 // ~20 km/h
      : route.totalDistance / 2.7; // ~6:10/km pace

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
  ];

  return (
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
  );
}
