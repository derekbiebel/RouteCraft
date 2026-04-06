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
    <div className="space-y-3">
      <p className="text-xs font-semibold text-foreground">Surface Breakdown</p>

      {/* Stacked bar */}
      <div className="flex h-4 rounded-full overflow-hidden shadow-inner border">
        {breakdown.map((b) => (
          <div
            key={b.category}
            className="relative group"
            style={{
              width: `${Math.max(b.percent, 2)}%`,
              backgroundColor: CATEGORY_COLORS[b.category] ?? '#a1a1aa',
            }}
          >
            {b.percent > 15 && (
              <span className="absolute inset-0 flex items-center justify-center text-[9px] font-mono font-bold text-white drop-shadow-sm">
                {Math.round(b.percent)}%
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Legend rows */}
      <div className="space-y-1.5">
        {breakdown.map((b) => (
          <div key={b.category} className="flex items-center gap-2">
            <div
              className="w-3 h-3 rounded shrink-0 border border-black/10"
              style={{ backgroundColor: CATEGORY_COLORS[b.category] ?? '#a1a1aa' }}
            />
            <span className="text-sm font-medium flex-1">
              {CATEGORY_LABELS[b.category] ?? b.category}
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              {formatDistance(b.distance, units)}
            </span>
            <span className="text-xs font-mono font-semibold w-10 text-right">
              {Math.round(b.percent)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
