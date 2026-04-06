import { useEffect, useRef, useCallback } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useRouteStore } from '../../store/useRouteStore';
import { usePreferences } from '../../store/usePreferences';
import { getDirections, getRoundTrip, getORSProfile } from '../../lib/ors';
import { CATEGORY_COLORS } from '../../lib/surfaces';

const STYLE_URLS: Record<string, string> = {
  streets: 'https://tiles.openfreemap.org/styles/liberty',
  outdoors: 'https://tiles.openfreemap.org/styles/positron',
  satellite: 'https://raw.githubusercontent.com/go2garret/maps/main/src/assets/json/openStreetMap_satellite.json',
};

export function MapView() {
  const mapContainer = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<maplibregl.Marker[]>([]);
  const mapStyle = usePreferences((s) => s.mapStyle);
  const activity = usePreferences((s) => s.activity);
  const surfacePref = usePreferences((s) => s.surfacePreference);
  const avoidances = usePreferences((s) => s.avoidances);
  const { waypoints, addWaypoint, setRoute, setLoading, setError, route } = useRouteStore();

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: STYLE_URLS[mapStyle],
      center: usePreferences.getState().defaultLocation?.lngLat ?? [-104.99, 39.74],
      zoom: usePreferences.getState().defaultLocation ? 14 : 12,
    });

    map.addControl(new maplibregl.NavigationControl(), 'bottom-right');
    map.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: { enableHighAccuracy: true },
        trackUserLocation: false,
      }),
      'bottom-right'
    );

    map.on('load', () => {
      map.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addLayer({
        id: 'route-outline',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#1e293b',
          'line-width': 9,
          'line-opacity': 0.3,
        },
      });

      map.addLayer({
        id: 'route-surface',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 6,
        },
      });
    });

    map.on('click', (e) => {
      // Ignore clicks on markers or popups
      const target = e.originalEvent.target as HTMLElement;
      if (target.closest('.maplibregl-marker, .maplibregl-popup, .poi-marker')) return;
      addWaypoint([e.lngLat.lng, e.lngLat.lat]);
    });

    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update map style
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.setStyle(STYLE_URLS[mapStyle]);

    map.once('styledata', () => {
      // Small delay to let style fully load
      setTimeout(() => {
        if (!map.getSource('route')) {
          map.addSource('route', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          });
          map.addLayer({
            id: 'route-outline',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': '#1e293b', 'line-width': 9, 'line-opacity': 0.3 },
          });
          map.addLayer({
            id: 'route-surface',
            type: 'line',
            source: 'route',
            layout: { 'line-join': 'round', 'line-cap': 'round' },
            paint: { 'line-color': ['get', 'color'], 'line-width': 5 },
          });
        }
        if (route) renderRoute(route);
      }, 100);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapStyle]);

  // Render route on map
  const renderRoute = useCallback(
    (routeResult: typeof route) => {
      const map = mapRef.current;
      if (!map || !routeResult) return;

      const source = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
      if (!source) return;

      const features = routeResult.segments.map((seg) => ({
        type: 'Feature' as const,
        properties: {
          color: CATEGORY_COLORS[seg.surface.category] ?? '#a1a1aa',
        },
        geometry: {
          type: 'LineString' as const,
          coordinates: seg.coordinates.map(([lng, lat, elev]) => [lng, lat, elev]),
        },
      }));

      source.setData({ type: 'FeatureCollection', features });

      if (routeResult.bbox) {
        const [minLng, minLat, maxLng, maxLat] = routeResult.bbox;
        map.fitBounds(
          [
            [minLng, minLat],
            [maxLng, maxLat],
          ],
          { padding: 80, duration: 500 }
        );
      }
    },
    []
  );

  // Update markers when waypoints change
  useEffect(() => {
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const map = mapRef.current;
    if (!map) return;

    waypoints.forEach((wp, i) => {
      const isStart = i === 0;
      const isEnd = i === waypoints.length - 1 && waypoints.length > 1;
      const color = isStart ? '#22c55e' : isEnd ? '#ef4444' : '#3b82f6';

      const marker = new maplibregl.Marker({ color, draggable: true })
        .setLngLat(wp)
        .addTo(map);

      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        useRouteStore.getState().updateWaypoint(i, [lngLat.lng, lngLat.lat]);
      });

      markersRef.current.push(marker);
    });
  }, [waypoints]);

  // Fetch route when waypoints change (2+ waypoints)
  useEffect(() => {
    if (waypoints.length < 2) {
      if (route) {
        const source = mapRef.current?.getSource('route') as maplibregl.GeoJSONSource | undefined;
        source?.setData({ type: 'FeatureCollection', features: [] });
        useRouteStore.getState().setRoute(null as unknown as Parameters<typeof setRoute>[0]);
      }
      return;
    }

    const profile = getORSProfile(activity, surfacePref);
    setLoading(true);
    setError(null);

    getDirections(waypoints, profile, avoidances)
      .then((result) => {
        setRoute(result);
        renderRoute(result);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints, activity, surfacePref, avoidances]);

  // Expose map ref for search
  useEffect(() => {
    (window as unknown as Record<string, unknown>).__routecraftMap = mapRef;
  }, []);

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
}

// Expose function for generating round trips from sidebar
export async function generateRoundTrip(
  start: [number, number],
  lengthMeters: number,
  activity: 'running' | 'cycling',
  surfacePref: string,
  seed?: number,
  avoidances?: Parameters<typeof getRoundTrip>[4]
) {
  const store = useRouteStore.getState();
  const profile = getORSProfile(activity, surfacePref);
  store.setLoading(true);
  store.setError(null);

  try {
    const result = await getRoundTrip(start, lengthMeters, profile, seed, avoidances);
    store.setRoute(result);
    store.setWaypoints([start]);
    return result;
  } catch (err) {
    store.setError(err instanceof Error ? err.message : 'Route generation failed');
    return null;
  } finally {
    store.setLoading(false);
  }
}
