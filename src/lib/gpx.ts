import type { RouteResult } from './ors';

export function generateGPX(route: RouteResult, name: string): string {
  const allCoords = route.segments.flatMap((seg) => seg.coordinates);

  const trackpoints = allCoords
    .map(
      ([lng, lat, ele]) =>
        `      <trkpt lat="${lat}" lon="${lng}">${ele != null ? `\n        <ele>${ele.toFixed(1)}</ele>` : ''}\n      </trkpt>`
    )
    .join('\n');

  const routepoints = allCoords
    .map(
      ([lng, lat, ele]) =>
        `    <rtept lat="${lat}" lon="${lng}">${ele != null ? `\n      <ele>${ele.toFixed(1)}</ele>` : ''}\n    </rtept>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="RouteCraft"
  xmlns="http://www.topografix.com/GPX/1/1"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">
  <metadata>
    <name>${escapeXml(name)}</name>
    <time>${new Date().toISOString()}</time>
  </metadata>
  <rte>
    <name>${escapeXml(name)}</name>
${routepoints}
  </rte>
  <trk>
    <name>${escapeXml(name)}</name>
    <trkseg>
${trackpoints}
    </trkseg>
  </trk>
</gpx>`;
}

export function downloadGPX(route: RouteResult, name: string): void {
  const gpx = generateGPX(route, name);
  const blob = new Blob([gpx], { type: 'application/gpx+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${name.replace(/[^a-zA-Z0-9-_ ]/g, '')}.gpx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
