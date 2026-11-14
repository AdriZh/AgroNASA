// FAO-56 (ch. 8) daily root-zone soil-water balance with single crop coefficient,
// and FAO-33 seasonal yield response:  1 − Ya/Ym = Ky · (1 − ETa/ETc).
import type { CropDef, DailySeries } from '../domain/types';
import { addDays, dayIndex } from '../domain/dates';
import { et0Series } from './et0';

export interface SeasonSim {
  sowing: string; maturity: string; days: number;
  rainMm: number; effRainMm: number; et0Mm: number; etcMm: number; etaMm: number;
  irrigationMm: number; stressDays: number; relYield: number;
  heatDaysFlowering: number; frostDays: number; longestDry: number;
  complete: boolean;
}

export function kcOnDay(crop: CropDef, d: number): number {
  const [li, ld, lm, ll] = crop.stages;
  const [ki, km, ke] = crop.kc;
  if (d < li) return ki;
  if (d < li + ld) return ki + ((d - li) / ld) * (km - ki);
  if (d < li + ld + lm) return km;
  const x = Math.min(1, (d - li - ld - lm) / ll);
  return km + x * (ke - km);
}

export const seasonLength = (c: CropDef) => c.stages.reduce((a, b) => a + b, 0);

/** Simple daily surface-runoff assumption (documented in Methods): 20% of rain above 25 mm/day. */
const runoff = (p: number) => (p > 25 ? 0.2 * (p - 25) : 0);

export interface SimOptions { irrigate?: boolean; irrigationCapMm?: number; spinUpDays?: number; afterFallow?: boolean }

/**
 * Simulate one season from a given sowing date. Soil water is spun up from 120 days before sowing
 * with a bare-soil coefficient so the initial state reflects that year's antecedent rain.
 */
export function simulateSeason(s: DailySeries, crop: CropDef, sowing: string, awcMmPerM: number, opts: SimOptions = {}): SeasonSim {
  const L = seasonLength(crop);
  const et0 = et0Series(s);
  const i0 = dayIndex(s.meta.start, sowing);
  // After a crop the profile starts depleted 120 days before sowing; after a fallow season the
  // bare soil has been storing water for a full year (moisture-conservation effect, R28).
  const spin = opts.spinUpDays ?? (opts.afterFallow ? 365 : 120);
  const zMax = crop.rootDepthM;
  const zIni = Math.min(0.15, zMax);
  let complete = i0 - spin >= 0 && i0 + L <= s.n;

  // spin-up: bare/stubble soil, Kc 0.3, fixed 0.3 m layer then expand to the root zone
  let taw = awcMmPerM * zMax;
  let dr = taw * (opts.afterFallow ? 0.6 : 0.8);
  for (let i = Math.max(0, i0 - spin); i < i0 && i < s.n; i++) {
    const p = s.P[i] ?? 0;
    const e = Number.isFinite(et0[i]) ? et0[i] : 0;
    const ks = Math.max(0, Math.min(1, (taw - dr) / (taw * 0.5)));
    dr = dr - (p - runoff(p)) + 0.3 * e * ks;
    if (dr < 0) dr = 0;
    if (dr > taw) dr = taw;
  }
  const initialFrac = dr / taw;

  let rain = 0, eff = 0, et0Sum = 0, etc = 0, eta = 0, irr = 0, stress = 0, heat = 0, frost = 0, run = 0, longest = 0;
  const capLeft = { v: opts.irrigate ? (opts.irrigationCapMm ?? Infinity) : 0 };
  const flowerStart = crop.stages[0] + crop.stages[1] - 7;
  const flowerEnd = crop.stages[0] + crop.stages[1] + 14;
  dr = initialFrac * awcMmPerM * zIni;

  for (let d = 0; d < L; d++) {
    const i = i0 + d;
    if (i < 0 || i >= s.n) { complete = false; break; }
    const z = zIni + (zMax - zIni) * Math.min(1, d / (crop.stages[0] + crop.stages[1]));
    const tawPrev = taw;
    taw = awcMmPerM * z;
    // newly explored soil enters at the antecedent wetness fraction
    if (taw > tawPrev && d > 0) dr += (taw - tawPrev) * initialFrac;
    const raw = crop.p * taw;
    const p = s.P[i];
    if (p == null) complete = false;
    const pp = p ?? 0;
    const pe = pp - runoff(pp);
    const e = Number.isFinite(et0[i]) ? et0[i] : 0;
    const kc = kcOnDay(crop, d);
    const etcD = kc * e;

    let irrD = 0;
    if (capLeft.v > 0 && dr > raw) {
      irrD = Math.min(dr, capLeft.v);
      capLeft.v -= irrD;
    }
    const drStart = Math.max(0, dr - pe - irrD);
    const ks = drStart > raw ? Math.max(0, (taw - drStart) / ((1 - crop.p) * taw)) : 1;
    const etaD = ks * etcD;
    dr = drStart + etaD;
    if (dr > taw) dr = taw;
    if (ks < 1) stress++;

    rain += pp; eff += pe; et0Sum += e; etc += etcD; eta += etaD; irr += irrD;
    const tx = s.TX[i], tn = s.TN[i];
    if (tx != null && d >= flowerStart && d <= flowerEnd && tx >= crop.heatThresholdC) heat++;
    if (tn != null && tn <= 0) frost++;
    if (pp < 1) { run++; longest = Math.max(longest, run); } else run = 0;
  }
  const relYield = etc > 0 ? Math.max(0, Math.min(1, 1 - crop.ky * (1 - eta / etc))) : 0;
  return {
    sowing, maturity: addDays(sowing, L - 1), days: L,
    rainMm: rain, effRainMm: eff, et0Mm: et0Sum, etcMm: etc, etaMm: eta, irrigationMm: irr,
    stressDays: stress, relYield, heatDaysFlowering: heat, frostDays: frost, longestDry: longest, complete,
  };
}
