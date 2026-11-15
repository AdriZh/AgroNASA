// Shared by Overview, Evidence and Pitch; kept out of Evidence.tsx so the landing page does not pull the
// whole Evidence route (and Leaflet) into the main bundle.
import { addDays } from '../../domain/dates';
import type { EngineOutput } from '../../engine/plan';

export function seasonEndOf(e: EngineOutput): string {
  if (!e.window.auto) return e.window.method === 'rain-onset' ? '10-31' : '09-15';
  return addDays(`2001-${e.window.earliest}`, 150).slice(5);
}
