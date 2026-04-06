import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../lib/surfaces';
import { formatDistance } from '../../lib/units';
import { usePreferences } from '../../store/usePreferences';

interface Props {
  breakdown: { category: string; distance: number; percent: number }[];
}

export function SurfaceBreakdown({ breakdown }: Props) {
  const units = usePreferences((s) => s.units);

  if (breakdown.length === 0) return null;

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-muted-foreground">Surface Breakdown</p>

      {/* Stacked bar */}
      <div className="flex h-3 rounded-full overflow-hidden">
        {breakdown.map((b) => (
          <div
            key={b.category}
            style={{
              width: `${b.percent}%`,
              backgroundColor: CATEGORY_COLORS[b.category] ?? '#a1a1aa',
            }}
          />
        ))}
      </div>

      {/* Legend */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        {breakdown.map((b) => (
          <div key={b.category} className="flex items-center gap-1.5">
            <div
              className="size-2.5 rounded-full shrink-0"
              style={{ backgroundColor: CATEGORY_COLORS[b.category] ?? '#a1a1aa' }}
            />
            <span className="text-[11px] text-muted-foreground truncate">
              {CATEGORY_LABELS[b.category] ?? b.category}
            </span>
            <span className="text-[11px] font-mono font-medium ml-auto">
              {formatDistance(b.distance, units)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
