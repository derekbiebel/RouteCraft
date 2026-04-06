import { useState, useEffect } from 'react';
import { Save, Trash2, FolderOpen } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { useRouteStore } from '../../store/useRouteStore';
import { usePreferences } from '../../store/usePreferences';
import { getSavedRoutes, saveRoute, deleteRoute, type SavedRoute } from '../../lib/storage';
import { formatDistance } from '../../lib/units';

export function SavedRoutes() {
  const route = useRouteStore((s) => s.route);
  const waypoints = useRouteStore((s) => s.waypoints);
  const { units, activity } = usePreferences();
  const [routes, setRoutes] = useState<SavedRoute[]>([]);
  const [name, setName] = useState('');
  const [showSave, setShowSave] = useState(false);

  useEffect(() => {
    setRoutes(getSavedRoutes());
  }, []);

  const handleSave = () => {
    if (!route || !name.trim()) return;
    const saved: SavedRoute = {
      id: Date.now().toString(),
      name: name.trim(),
      createdAt: new Date().toISOString(),
      activity,
      waypoints,
      totalDistance: route.totalDistance,
      elevationGain: route.elevationGain,
    };
    saveRoute(saved);
    setRoutes(getSavedRoutes());
    setName('');
    setShowSave(false);
  };

  const handleDelete = (id: string) => {
    deleteRoute(id);
    setRoutes(getSavedRoutes());
  };

  const handleLoad = (saved: SavedRoute) => {
    useRouteStore.getState().setWaypoints(saved.waypoints);
  };

  return (
    <div className="space-y-3">
      {/* Save current */}
      {route && (
        <>
          {showSave ? (
            <div className="flex gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Route name..."
                className="h-8 text-sm"
                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
              />
              <Button size="sm" onClick={handleSave} disabled={!name.trim()}>
                <Save className="size-3.5" />
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => setShowSave(true)}
            >
              <Save className="size-3.5 mr-1.5" />
              Save Route
            </Button>
          )}
          <Separator />
        </>
      )}

      {/* Saved routes list */}
      {routes.length === 0 ? (
        <p className="text-xs text-muted-foreground/60 italic py-2 text-center">
          No saved routes yet
        </p>
      ) : (
        <div className="space-y-1.5">
          {routes.map((r) => (
            <div
              key={r.id}
              className="flex items-center gap-2 bg-secondary/50 rounded-md px-3 py-2 group"
            >
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{r.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatDistance(r.totalDistance, units)} · {r.activity} ·{' '}
                  {new Date(r.createdAt).toLocaleDateString()}
                </p>
              </div>
              <button onClick={() => handleLoad(r)} className="shrink-0" title="Load route">
                <FolderOpen className="size-3.5 text-muted-foreground hover:text-foreground" />
              </button>
              <button
                onClick={() => handleDelete(r.id)}
                className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete route"
              >
                <Trash2 className="size-3.5 text-muted-foreground hover:text-destructive" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
