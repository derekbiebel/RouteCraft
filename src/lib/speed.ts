/**
 * Estimate average speed given athlete profile and intensity factor.
 *
 * Cycling: Uses a simplified power-speed model.
 *   Power = FTP × IF
 *   Speed derived from: P = CdA × 0.5 × ρ × v³ + Crr × m × g × v
 *   Solved iteratively for v.
 *
 * Running: Uses threshold pace scaled by intensity factor.
 *   Pace at IF = thresholdPace / IF
 *   Speed = 1000 / pace (m/s)
 */

export function estimateSpeedMs(
  activity: 'running' | 'cycling',
  intensityFactor: number,
  ftp: number,
  weightKg: number,
  thresholdPaceSecPerKm: number
): number {
  if (activity === 'running') {
    // Higher IF = faster pace
    const paceAtIF = thresholdPaceSecPerKm / intensityFactor;
    return 1000 / paceAtIF; // m/s
  }

  // Cycling power-speed model
  const power = ftp * intensityFactor;
  const CdA = 0.35; // drag area (m²) — typical road position
  const rho = 1.225; // air density (kg/m³)
  const Crr = 0.005; // rolling resistance
  const g = 9.81;
  const m = weightKg + 9; // rider + bike

  // Iteratively solve: P = 0.5 * rho * CdA * v³ + Crr * m * g * v
  let v = 5; // initial guess m/s
  for (let i = 0; i < 20; i++) {
    const pDrag = 0.5 * rho * CdA * v * v * v;
    const pRoll = Crr * m * g * v;
    const pTotal = pDrag + pRoll;
    const error = pTotal - power;
    // Newton's method derivative: dP/dv = 1.5 * rho * CdA * v² + Crr * m * g
    const dPdv = 1.5 * rho * CdA * v * v + Crr * m * g;
    v = v - error / dPdv;
    if (v < 0.5) v = 0.5;
  }

  return v;
}

/**
 * Calculate target distance from time and speed.
 */
export function distanceFromTime(
  timeMinutes: number,
  activity: 'running' | 'cycling',
  intensityFactor: number,
  ftp: number,
  weightKg: number,
  thresholdPaceSecPerKm: number
): number {
  const speedMs = estimateSpeedMs(activity, intensityFactor, ftp, weightKg, thresholdPaceSecPerKm);
  return speedMs * timeMinutes * 60; // meters
}

/**
 * Format speed for display.
 */
export function formatSpeed(
  speedMs: number,
  activity: 'running' | 'cycling',
  units: 'imperial' | 'metric'
): string {
  if (activity === 'running') {
    // Show as pace (min/mi or min/km)
    const distPerSec = units === 'imperial' ? speedMs / 1609.344 : speedMs / 1000;
    const secPerUnit = 1 / distPerSec;
    const min = Math.floor(secPerUnit / 60);
    const sec = Math.round(secPerUnit % 60);
    const label = units === 'imperial' ? '/mi' : '/km';
    return `${min}:${sec.toString().padStart(2, '0')}${label}`;
  }
  // Cycling: show as mph or km/h
  if (units === 'imperial') {
    return `${(speedMs * 2.23694).toFixed(1)} mph`;
  }
  return `${(speedMs * 3.6).toFixed(1)} km/h`;
}
