import { Map, Mountain, Satellite } from 'lucide-react';
import { usePreferences } from '../../store/usePreferences';

const STYLES = ['streets', 'outdoors', 'satellite'] as const;
const STYLE_INFO: Record<string, { icon: typeof Map; label: string }> = {
  streets: { icon: Map, label: 'Streets' },
  outdoors: { icon: Mountain, label: 'Outdoors' },
  satellite: { icon: Satellite, label: 'Satellite' },
};

export function MapControls() {
  const { mapStyle, setMapStyle } = usePreferences();

  const nextStyle = () => {
    const idx = STYLES.indexOf(mapStyle);
    setMapStyle(STYLES[(idx + 1) % STYLES.length]);
  };

  // Show the icon for the NEXT style (what you'll switch to)
  const nextIdx = (STYLES.indexOf(mapStyle) + 1) % STYLES.length;
  const NextIcon = STYLE_INFO[STYLES[nextIdx]].icon;
  const nextLabel = STYLE_INFO[STYLES[nextIdx]].label;

  return (
    <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
      <button
        onClick={nextStyle}
        className="bg-white shadow-lg rounded-lg p-2.5 hover:bg-gray-50 transition-colors"
        title={`Switch to ${nextLabel}`}
      >
        <NextIcon className="size-5 text-gray-700" />
      </button>
    </div>
  );
}
