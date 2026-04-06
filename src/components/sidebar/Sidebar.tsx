import { useState } from 'react';
import { Compass, Coffee, Beer, Settings2, Mountain, Trees, MapPin, Star, Trash2, Plus } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { Input } from '@/components/ui/input';
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
  const { units, setUnits, activity, ftp, setFtp, weight, setWeight, thresholdPace, setThresholdPace,
          savedLocations, addSavedLocation, removeSavedLocation, defaultLocation, setDefaultLocation } = usePreferences();
  const [showAthleteSettings, setShowAthleteSettings] = useState(false);
  const [newLocName, setNewLocName] = useState('');

  return (
    <div className="w-80 h-full bg-card border-r flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-4 py-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Compass className="size-5 text-primary" />
            <h1 className="text-lg font-bold tracking-tight">RouteCraft</h1>
            <button
              onClick={() => setShowAthleteSettings(!showAthleteSettings)}
              className={`p-1 rounded transition-colors ${
                showAthleteSettings
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
              title="Athlete Settings"
            >
              <Settings2 className="size-4" />
            </button>
          </div>
          <button
            onClick={() => setUnits(units === 'imperial' ? 'metric' : 'imperial')}
            className="text-[10px] font-mono font-medium uppercase bg-secondary px-2 py-1 rounded hover:bg-accent transition-colors"
          >
            {distanceLabel(units)}
          </button>
        </div>

        {/* Athlete Settings Panel */}
        {showAthleteSettings && (
          <div className="bg-secondary/30 rounded-lg p-3 space-y-3 mb-3">
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

            <Separator />

            {/* Saved Starting Locations */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <MapPin className="size-3.5" />
                Starting Locations
              </p>

              {savedLocations.map((loc) => (
                <div key={loc.name} className="flex items-center gap-1.5 group">
                  <button
                    onClick={() => {
                      setDefaultLocation(defaultLocation?.name === loc.name ? null : loc);
                    }}
                    title={defaultLocation?.name === loc.name ? 'Remove as default' : 'Set as default'}
                  >
                    <Star className={`size-3.5 ${defaultLocation?.name === loc.name ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground'}`} />
                  </button>
                  <button
                    className="flex-1 text-left text-xs font-medium truncate hover:text-primary transition-colors"
                    onClick={() => {
                      const mapRef = (window as unknown as Record<string, unknown>).__routecraftMap as { current: { flyTo: (o: unknown) => void } | null };
                      mapRef?.current?.flyTo({ center: loc.lngLat, zoom: 14, duration: 1000 });
                      useRouteStore.getState().clearRoute();
                      useRouteStore.getState().addWaypoint(loc.lngLat);
                    }}
                  >
                    {loc.name}
                    {defaultLocation?.name === loc.name && (
                      <span className="ml-1 text-[9px] text-amber-500 font-mono">DEFAULT</span>
                    )}
                  </button>
                  <button
                    onClick={() => removeSavedLocation(loc.name)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Trash2 className="size-3 text-muted-foreground hover:text-destructive" />
                  </button>
                </div>
              ))}

              {/* Save current start point */}
              {useRouteStore.getState().waypoints.length > 0 && (
                <div className="flex gap-1.5">
                  <Input
                    value={newLocName}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewLocName(e.target.value)}
                    placeholder="Name this location..."
                    className="h-7 text-xs flex-1"
                    onKeyDown={(e: React.KeyboardEvent) => {
                      if (e.key === 'Enter' && newLocName.trim()) {
                        const wp = useRouteStore.getState().waypoints[0];
                        addSavedLocation(newLocName.trim(), wp);
                        setNewLocName('');
                      }
                    }}
                  />
                  <button
                    onClick={() => {
                      if (!newLocName.trim()) return;
                      const wp = useRouteStore.getState().waypoints[0];
                      if (wp) {
                        addSavedLocation(newLocName.trim(), wp);
                        setNewLocName('');
                      }
                    }}
                    className="text-muted-foreground hover:text-primary"
                    disabled={!newLocName.trim()}
                  >
                    <Plus className="size-4" />
                  </button>
                </div>
              )}

              {savedLocations.length === 0 && useRouteStore.getState().waypoints.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">
                  Click the map to set a start point, then save it here
                </p>
              )}
            </div>
          </div>
        )}

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
                {stops.map((stop) => {
                  const stopStyles: Record<string, { bg: string; icon: React.ReactNode; label: string }> = {
                    brewery: { bg: 'bg-amber-100 border border-amber-300', icon: <Beer className="size-3.5 text-amber-700" />, label: 'Brewery' },
                    coffee: { bg: 'bg-purple-100 border border-purple-300', icon: <Coffee className="size-3.5 text-purple-700" />, label: 'Coffee Shop' },
                    viewpoint: { bg: 'bg-green-100 border border-green-300', icon: <Mountain className="size-3.5 text-green-700" />, label: 'Viewpoint' },
                    park: { bg: 'bg-emerald-100 border border-emerald-300', icon: <Trees className="size-3.5 text-emerald-700" />, label: 'Park' },
                  };
                  const style = stopStyles[stop.type] ?? stopStyles.coffee;
                  return (
                    <div
                      key={stop.id}
                      className="flex items-center gap-2.5"
                    >
                      <div className={`flex items-center justify-center size-7 rounded-full text-sm ${style.bg}`}>
                        {style.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{stop.name}</p>
                        <p className="text-[10px] text-muted-foreground">{style.label}</p>
                      </div>
                    </div>
                  );
                })}
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
