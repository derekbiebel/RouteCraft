import { Compass, Coffee, Beer } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { SearchBar } from './SearchBar';
import { RouteBuilder } from './RouteBuilder';
import { RouteGenerator } from './RouteGenerator';
import { RouteStats } from './RouteStats';
import { SavedRoutes } from './SavedRoutes';
import { ElevationProfile } from '../charts/ElevationProfile';
import { SurfaceBreakdown } from '../charts/SurfaceBreakdown';
import { POIFilter } from './POIFilter';
import { RoadSafety } from './RoadSafety';
import { useRouteStore } from '../../store/useRouteStore';
import { usePreferences } from '../../store/usePreferences';
import { distanceLabel } from '../../lib/units';

export function Sidebar() {
  const { route, stops, isLoading, error } = useRouteStore();
  const units = usePreferences((s) => s.units);
  const setUnits = usePreferences((s) => s.setUnits);

  return (
    <div className="w-80 h-full bg-card border-r flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Compass className="size-5 text-primary" />
            <h1 className="text-lg font-bold tracking-tight">RouteCraft</h1>
          </div>
          <button
            onClick={() => setUnits(units === 'imperial' ? 'metric' : 'imperial')}
            className="text-[10px] font-mono font-medium uppercase bg-secondary px-2 py-1 rounded hover:bg-accent transition-colors"
          >
            {distanceLabel(units)}
          </button>
        </div>
        <SearchBar />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        <Tabs defaultValue="build">
          <TabsList className="w-full">
            <TabsTrigger value="build" className="flex-1">Build</TabsTrigger>
            <TabsTrigger value="generate" className="flex-1">Generate</TabsTrigger>
          </TabsList>
          <TabsContent value="build" className="mt-3">
            <RouteBuilder />
          </TabsContent>
          <TabsContent value="generate" className="mt-3">
            <RouteGenerator />
          </TabsContent>
        </Tabs>

        {/* Loading / Error */}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="size-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            Calculating route...
          </div>
        )}

        {error && (
          <div className="bg-destructive/10 text-destructive text-xs rounded-md px-3 py-2">
            {error}
          </div>
        )}

        {/* Route results */}
        {route && (
          <>
            <Separator />
            <RouteStats />

            {/* Stops along route */}
            {stops.length > 0 && (
              <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-foreground">Stops on This Route</p>
                {stops.map((stop) => (
                  <div
                    key={stop.id}
                    className="flex items-center gap-2.5"
                  >
                    <div
                      className={`flex items-center justify-center size-7 rounded-full text-sm ${
                        stop.type === 'brewery'
                          ? 'bg-amber-100 border border-amber-300'
                          : 'bg-purple-100 border border-purple-300'
                      }`}
                    >
                      {stop.type === 'brewery' ? (
                        <Beer className="size-3.5 text-amber-700" />
                      ) : (
                        <Coffee className="size-3.5 text-purple-700" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{stop.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {stop.type === 'brewery' ? 'Brewery' : 'Coffee Shop'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <SavedRoutes />
            <Separator />
            <SurfaceBreakdown breakdown={route.surfaceBreakdown} />
            <ElevationProfile data={route.elevationProfile} />
            <Separator />
            <RoadSafety />
            <Separator />
            <POIFilter />
          </>
        )}

        {!route && (
          <>
            <Separator />
            <SavedRoutes />
          </>
        )}
      </div>
    </div>
  );
}
