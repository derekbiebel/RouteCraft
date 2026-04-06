import { CATEGORY_COLORS, CATEGORY_LABELS } from '../../lib/surfaces';

const LEGEND_ITEMS = ['road', 'paved', 'gravel', 'trail'] as const;

export function SurfaceLegend() {
  return (
    <div className="absolute bottom-8 left-4 z-10 bg-white/95 backdrop-blur-sm shadow-lg rounded-lg px-3 py-2.5 border">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 mb-1.5">
        Surface Type
      </p>
      <div className="flex flex-col gap-1">
        {LEGEND_ITEMS.map((cat) => (
          <div key={cat} className="flex items-center gap-2">
            <div
              className="w-5 h-1 rounded-full"
              style={{ backgroundColor: CATEGORY_COLORS[cat] }}
            />
            <span className="text-xs font-medium text-gray-700">
              {CATEGORY_LABELS[cat]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
