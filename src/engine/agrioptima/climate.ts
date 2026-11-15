// Growing-season climate features from the NASA POWER daily record — identical definitions to the Python
// trainer (ml/agrioptima_ml/climate.py), so the INRAE models see the same quantities in training and here.
import type { DailySeries } from '../../domain/types';
import { addDays, dayIndex } from '../../domain/dates';
import { completeYears } from '../../weather/indicators';

export const CLIMATE_FEATURES = ['gs_mean_temp_c', 'gs_precip_mm', 'gs_pet_mm', 'gs_water_balance_mm', 'gs_gdd', 'gs_heat_days', 'gs_radiation'] as const;
export type ClimateFeatures = Record<(typeof CLIMATE_FEATURES)[number], number>;

/** Hargreaves–Samani reference ET (mm/day). */
export function hargreaves(tmin: number, tmax: number, doyN: number, latDeg: number): number {
  const lat = (latDeg * Math.PI) / 180;
  const dr = 1 + 0.033 * Math.cos((2 * Math.PI * doyN) / 365);
  const decl = 0.409 * Math.sin((2 * Math.PI * doyN) / 365 - 1.39);
  const ws = Math.acos(Math.min(1, Math.max(-1, -Math.tan(lat) * Math.tan(decl))));
  const ra = ((24 * 60) / Math.PI) * 0.082 * dr * (ws * Math.sin(lat) * Math.sin(decl) + Math.cos(lat) * Math.cos(decl) * Math.sin(ws));
  const tmean = (tmax + tmin) / 2;
  return Math.max(0, 0.0023 * 0.408 * ra * (tmean + 17.8) * Math.sqrt(Math.max(0, tmax - tmin)));
}

const dayOfYear = (iso: string) => {
  const d = new Date(`${iso}T00:00:00Z`);
  return Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86_400_000) + 1;
};

/** One season's features, or null when more than 10 % of days are missing or outside the record. */
function oneSeason(s: DailySeries, sowing: string, days: number): ClimateFeatures | null {
  const i0 = dayIndex(s.meta.start, sowing);
  if (i0 < 0 || i0 + days > s.n) return null;
  let tSum = 0, nT = 0, p = 0, pet = 0, gdd = 0, heat = 0, rs = 0, nRs = 0, ok = 0;
  for (let k = 0; k < days; k++) {
    const i = i0 + k;
    const t = s.T[i], tx = s.TX[i], tn = s.TN[i], pr = s.P[i];
    if (t == null || tx == null || tn == null || pr == null) continue;
    ok++;
    tSum += t; nT++; p += pr; gdd += Math.max(0, t);
    if (tx > 30) heat++;
    pet += hargreaves(tn, tx, dayOfYear(addDays(sowing, k)), s.meta.lat);
    if (s.RS[i] != null) { rs += s.RS[i]!; nRs++; }
  }
  if (ok < 0.9 * days) return null;
  return {
    gs_mean_temp_c: tSum / nT, gs_precip_mm: p, gs_pet_mm: pet, gs_water_balance_mm: p - pet,
    gs_gdd: gdd, gs_heat_days: heat, gs_radiation: nRs ? rs / nRs : NaN,
  };
}

/** Mean of the season features over every complete NASA POWER year, for a typical sowing day (MM-DD). */
export function seasonClimate(s: DailySeries, sowMmdd: string, days: number): ClimateFeatures | null {
  const all: ClimateFeatures[] = [];
  for (const y of completeYears(s)) {
    const f = oneSeason(s, `${y}-${sowMmdd}`, days);
    if (f) all.push(f);
  }
  if (!all.length) return null;
  const out = {} as ClimateFeatures;
  for (const k of CLIMATE_FEATURES) {
    const v = all.map((f) => f[k]).filter(Number.isFinite);
    out[k] = v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
  }
  return out;
}
