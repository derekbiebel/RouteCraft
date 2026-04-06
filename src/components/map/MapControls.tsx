import { Map, Mountain } from 'lucide-react';
import { usePreferences } from '../../store/usePreferences';

export function MapControls() {
  const { mapStyle, setMapStyle } = usePreferences();

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
      <button
        onClick={() => setMapStyle(mapStyle === 'streets' ? 'outdoors' : 'streets')}
        className="bg-white shadow-lg rounded-lg p-2.5 hover:bg-gray-50 transition-colors"
        title={mapStyle === 'streets' ? 'Switch to Outdoors' : 'Switch to Streets'}
      >
        {mapStyle === 'streets' ? (
          <Mountain className="size-5 text-gray-700" />
        ) : (
          <Map className="size-5 text-gray-700" />
        )}
      </button>
    </div>
  );
}
