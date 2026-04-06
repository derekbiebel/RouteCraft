import { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import { usePreferences } from '../../store/usePreferences';
import { formatDistance, formatElevation } from '../../lib/units';

interface Props {
  data: { distance: number; elevation: number }[];
}

export function ElevationProfile({ data }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);
  const units = usePreferences((s) => s.units);

  useEffect(() => {
    if (!svgRef.current || data.length < 2) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = svgRef.current.clientWidth;
    const height = 120;
    const margin = { top: 8, right: 8, bottom: 24, left: 40 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    svg.attr('viewBox', `0 0 ${width} ${height}`);

    const g = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain([0, d3.max(data, (d) => d.distance)!]).range([0, w]);
    const y = d3
      .scaleLinear()
      .domain([d3.min(data, (d) => d.elevation)! * 0.95, d3.max(data, (d) => d.elevation)! * 1.05])
      .range([h, 0]);

    // Area fill
    const area = d3
      .area<(typeof data)[0]>()
      .x((d) => x(d.distance))
      .y0(h)
      .y1((d) => y(d.elevation))
      .curve(d3.curveBasis);

    const gradient = svg.append('defs').append('linearGradient')
      .attr('id', 'elev-gradient')
      .attr('x1', '0').attr('y1', '0')
      .attr('x2', '0').attr('y2', '1');
    gradient.append('stop').attr('offset', '0%').attr('stop-color', '#4ade80').attr('stop-opacity', 0.4);
    gradient.append('stop').attr('offset', '100%').attr('stop-color', '#4ade80').attr('stop-opacity', 0.05);

    g.append('path')
      .datum(data)
      .attr('d', area)
      .attr('fill', 'url(#elev-gradient)');

    // Line
    const line = d3
      .line<(typeof data)[0]>()
      .x((d) => x(d.distance))
      .y((d) => y(d.elevation))
      .curve(d3.curveBasis);

    g.append('path')
      .datum(data)
      .attr('d', line)
      .attr('fill', 'none')
      .attr('stroke', '#4ade80')
      .attr('stroke-width', 2);

    // Axes
    g.append('g')
      .attr('transform', `translate(0,${h})`)
      .call(
        d3.axisBottom(x).ticks(4).tickFormat((d) => formatDistance(d as number, units))
      )
      .selectAll('text')
      .style('font-size', '9px')
      .style('font-family', 'JetBrains Mono');

    g.append('g')
      .call(
        d3.axisLeft(y).ticks(3).tickFormat((d) => formatElevation(d as number, units))
      )
      .selectAll('text')
      .style('font-size', '9px')
      .style('font-family', 'JetBrains Mono');

    // Remove domain lines for cleaner look
    g.selectAll('.domain').remove();
    g.selectAll('.tick line').attr('stroke', '#e5e7eb').attr('stroke-dasharray', '2,2');
  }, [data, units]);

  if (data.length < 2) return null;

  return (
    <div className="w-full">
      <p className="text-xs font-medium text-muted-foreground mb-1">Elevation Profile</p>
      <svg ref={svgRef} className="w-full" style={{ height: 120 }} />
    </div>
  );
}
