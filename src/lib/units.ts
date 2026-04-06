export type UnitSystem = 'imperial' | 'metric';

export function formatDistance(meters: number, units: UnitSystem): string {
  if (units === 'imperial') {
    const miles = meters / 1609.344;
    return miles < 0.1 ? `${Math.round(meters * 3.28084)} ft` : `${miles.toFixed(2)} mi`;
  }
  return meters < 1000 ? `${Math.round(meters)} m` : `${(meters / 1000).toFixed(2)} km`;
}

export function formatElevation(meters: number, units: UnitSystem): string {
  if (units === 'imperial') {
    return `${Math.round(meters * 3.28084)} ft`;
  }
  return `${Math.round(meters)} m`;
}

export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export function distanceLabel(units: UnitSystem): string {
  return units === 'imperial' ? 'mi' : 'km';
}

export function toDisplayDistance(meters: number, units: UnitSystem): number {
  return units === 'imperial' ? meters / 1609.344 : meters / 1000;
}

export function fromDisplayDistance(value: number, units: UnitSystem): number {
  return units === 'imperial' ? value * 1609.344 : value * 1000;
}
