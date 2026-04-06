import { useState, useRef } from 'react';
import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import mapboxgl from 'mapbox-gl';

interface SearchResult {
  place_name: string;
  center: [number, number];
}

export function SearchBar() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = (q: string) => {
    setQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (q.length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      try {
        const token = import.meta.env.VITE_MAPBOX_TOKEN;
        const res = await fetch(
          `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json?access_token=${token}&limit=5`
        );
        const data = await res.json();
        setResults(data.features ?? []);
        setIsOpen(true);
      } catch {
        setResults([]);
      }
    }, 300);
  };

  const select = (result: SearchResult) => {
    setQuery(result.place_name.split(',')[0]);
    setResults([]);
    setIsOpen(false);

    // Fly map to location
    const mapRef = (window as Record<string, unknown>).__routecraftMap as React.RefObject<mapboxgl.Map>;
    if (mapRef?.current) {
      mapRef.current.flyTo({ center: result.center, zoom: 14, duration: 1500 });
    }
  };

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => search(e.target.value)}
          placeholder="Search location..."
          className="pl-9 pr-8 h-9 text-sm"
        />
        {query && (
          <button
            onClick={() => { setQuery(''); setResults([]); setIsOpen(false); }}
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
          >
            <X className="size-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-card border rounded-lg shadow-lg z-50 overflow-hidden">
          {results.map((r, i) => (
            <button
              key={i}
              onClick={() => select(r)}
              className="w-full text-left px-3 py-2 text-sm hover:bg-accent transition-colors truncate"
            >
              {r.place_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
