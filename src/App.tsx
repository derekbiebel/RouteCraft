import { Sidebar } from './components/sidebar/Sidebar';
import { MapView } from './components/map/MapView';
import { MapControls } from './components/map/MapControls';
import { useIsMobile } from './hooks/use-mobile';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Menu } from 'lucide-react';

export default function App() {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <div className="h-dvh w-full relative">
        <div className="absolute inset-0">
          <MapView />
        </div>
        <MapControls />
        <Sheet>
          <SheetTrigger asChild>
            <button className="absolute top-4 left-4 z-10 bg-white shadow-lg rounded-lg p-2.5">
              <Menu className="size-5 text-gray-700" />
            </button>
          </SheetTrigger>
          <SheetContent side="left" className="p-0 w-80">
            <Sidebar />
          </SheetContent>
        </Sheet>
      </div>
    );
  }

  return (
    <div className="h-dvh w-full flex">
      <Sidebar />
      <div className="flex-1 relative">
        <MapView />
        <MapControls />
      </div>
    </div>
  );
}
