import { useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useRouteStore } from '../../store/useRouteStore';
import { analyzeRouteSafety, type RoadSafetyReport } from '../../lib/roadSafety';

export function RoadSafety() {
  const route = useRouteStore((s) => s.route);
  const [report, setReport] = useState<RoadSafetyReport | null>(null);
  const [loading, setLoading] = useState(false);

  const analyze = async () => {
    if (!route) return;
    setLoading(true);
    try {
      const allCoords = route.segments.flatMap((seg) => seg.coordinates);
      const result = await analyzeRouteSafety(allCoords);
      setReport(result);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  };

  if (!route) return null;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <ShieldCheck className="size-4 text-muted-foreground" />
        <p className="text-xs font-semibold text-foreground">Road Safety</p>
      </div>

      {!report ? (
        <Button
          variant="outline"
          size="sm"
          className="w-full"
          onClick={analyze}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="size-3.5 mr-1.5 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <ShieldCheck className="size-3.5 mr-1.5" />
              Analyze Road Safety
            </>
          )}
        </Button>
      ) : (
        <div className="space-y-3">
          {/* Overall score */}
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center size-12 rounded-full border-2 font-mono text-lg font-bold"
              style={{ borderColor: report.overallColor, color: report.overallColor }}
            >
              {report.overallScore}
            </div>
            <div>
              <p className="text-sm font-semibold" style={{ color: report.overallColor }}>
                {report.overallLabel}
              </p>
              <p className="text-[10px] text-muted-foreground">
                Based on {report.segments.length} road segments
              </p>
            </div>
          </div>

          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-2">
            <StatRow
              label="Has Shoulder"
              value={`${report.summary.hasShoulderPercent}%`}
              good={report.summary.hasShoulderPercent > 50}
            />
            <StatRow
              label="Bike Lane"
              value={`${report.summary.hasBikeLanePercent}%`}
              good={report.summary.hasBikeLanePercent > 30}
            />
            <StatRow
              label="Residential"
              value={`${report.summary.residentialPercent}%`}
              good={report.summary.residentialPercent > 50}
            />
            <StatRow
              label="Primary/Trunk"
              value={`${report.summary.primaryPercent}%`}
              good={report.summary.primaryPercent < 20}
            />
            {report.summary.avgMaxSpeed !== null && (
              <StatRow
                label="Avg Speed Limit"
                value={`${report.summary.avgMaxSpeed} km/h`}
                good={report.summary.avgMaxSpeed < 50}
              />
            )}
          </div>

          <button
            onClick={() => setReport(null)}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Re-analyze
          </button>
        </div>
      )}
    </div>
  );
}

function StatRow({ label, value, good }: { label: string; value: string; good: boolean }) {
  return (
    <div className="bg-secondary/50 rounded-md px-2.5 py-1.5">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`font-mono text-sm font-semibold ${good ? 'text-green-600' : 'text-amber-600'}`}>
        {value}
      </p>
    </div>
  );
}
