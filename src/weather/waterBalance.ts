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
  /** Plant-available water in the full root zone at sowing (mm) and the full-root-zone TAW (mm), for diagnostics. */
  swSowingMm: number; tawMm: number;
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

/**
 * Relative yield Ya/Ym. With growth-period factors (FAO-33, Doorenbos & Kassam 1979, Table 24 — R37) the
 * deficit of each period is weighted by its own Ky and the period responses are combined multiplicatively
 * (as in CROPWAT): a dry spell at flowering or grain filling costs far more than the same deficit spread over
 * the season. The seasonal Ky (1 − Ya/Ym = Ky·(1 − ETa/ETc), R18) "applies to deficits spread over the whole
 * season" and hid exactly the Sahel failure mode (late onset, early cessation, flowering dry spells).
 * Crops without published period factors keep the seasonal Ky.
 */
export function yieldResponse(crop: CropDef, etc: number, eta: number, pEtc: number[], pEta: number[]): number {
  if (!crop.kyStages) return Math.max(0, Math.min(1, 1 - crop.ky * (1 - eta / etc)));
  let y = 1;
  for (let k = 0; k < 4; k++) if (pEtc[k] > 0) y *= Math.max(0, 1 - crop.kyStages[k] * (1 - pEta[k] / pEtc[k]));
  return Math.max(0, Math.min(1, y));
}

export interface SimOptions { irrigate?: boolean; irrigationCapMm?: number; spinUpDays?: number; afterFallow?: boolean }

// --- Off-season (between harvest and sowing) water balance -------------------------------------------
// Snow: NASA POWER PRECTOTCORR is total precipitation incl. snow water equivalent (R5). On days with mean
// T2M ≤ 0 °C it is stored as a snowpack and released by a temperature-index (degree-day) melt of
// 3 mm °C⁻¹ d⁻¹, within the 2.5–6 mm range reported for seasonal snow on open terrain (Hock 2003, R38).
// No soil evaporation is drawn while snow covers the ground.
const SNOW_T_C = 0, DDF_MM_PER_C = 3;
// Bare-soil evaporation: FAO-56 ch. 7 (eqs. 71–77) two-stage evaporation from the surface layer only
// (Ze = 0.10 m). TEW ≈ Ze·(θFC − 0.5θWP) ≈ 0.14·AWC(mm/m) reproduces the FAO-56 Table 19 TEW ranges
// (sand ≈ 9, loam ≈ 19–21, clay ≈ 25 mm); REW ≈ 0.45·TEW (Table 19). Ke = Kr·(Kc,max − Kcb) with
// Kc,max ≈ 1.20 and Kcb ≈ 0.15 for bare soil. The surface layer can only lose what the last rains put in
// it, so the deeper profile is not dried by evaporation (the previous version drew 0.3·ET₀ from the whole
// 1.2 m root zone for months, which emptied the stored autumn and snow-melt water).
const KE_BARE = 1.2 - 0.15;
const tewOf = (awcMmPerM: number) => Math.min(29, Math.max(6, 0.14 * awcMmPerM));

export interface OffSeasonState { dr: number; snowMm: number }
/**
 * Run the bare-soil balance over days [a, b) of the series for a profile of total available water `taw`,
 * starting from depletion `dr0`. Returns the root-zone depletion (mm) and the snowpack left at day b.
 */
export function offSeasonBalance(s: DailySeries, et0: ArrayLike<number>, a: number, b: number, taw: number, dr0: number, awcMmPerM: number): OffSeasonState {
  const tew = tewOf(awcMmPerM), rew = 0.45 * tew;
  let dr = dr0, snow = 0, de = tew; // surface layer starts dry (post-harvest)
  for (let i = Math.max(0, a); i < b && i < s.n; i++) {
    const p = s.P[i] ?? 0;
    const t = s.T[i];
    let water = p;
    if (t != null && t <= SNOW_T_C) { snow += p; water = 0; }
    else if (snow > 0 && t != null) { const m = Math.min(snow, DDF_MM_PER_C * t); snow -= m; water += m; }
    const inf = water - runoff(water);
    de = Math.max(0, de - inf);
    dr = Math.max(0, dr - inf); // surplus above field capacity drains below the profile (deep percolation)
    if (snow <= 0) {
      const e0 = Number.isFinite(et0[i]) ? Math.max(0, et0[i]) : 0;
      const kr = de <= rew ? 1 : Math.max(0, (tew - de) / (tew - rew));
      const ev = Math.min(kr * KE_BARE * e0, tew - de, taw - dr);
      de += ev; dr += ev;
    }
  }
  return { dr: Math.min(taw, dr), snowMm: snow };
}

/**
 * Simulate one season from a given sowing date. Soil water is spun up from the previous harvest (one year
 * minus the season length before sowing; two after a fallow year), so autumn rain and winter snow — the main
 * recharge in continental steppes (R28) — and the dry-season loss in the tropics are both represented.
 */
export function simulateSeason(s: DailySeries, crop: CropDef, sowing: string, awcMmPerM: number, opts: SimOptions = {}): SeasonSim {
  const L = seasonLength(crop);
  const et0 = et0Series(s);
  const i0 = dayIndex(s.meta.start, sowing);
  // After a crop the off-season starts at the previous harvest with the profile depleted by that crop
  // (80% of TAW). After a fallow year the bare, weed-free soil has stored water since the harvest before
  // that (moisture-conservation effect of fallow, R28).
  const spin = opts.spinUpDays ?? Math.max(120, (opts.afterFallow ? 730 : 365) - L);
  const zMax = crop.rootDepthM;
  const zIni = Math.min(0.15, zMax);
  // the first record year cannot see the previous harvest: accept a spin-up clipped to ≥ 120 days
  let complete = i0 - Math.min(spin, 120) >= 0 && i0 + L <= s.n;

  let taw = awcMmPerM * zMax;
  const off = offSeasonBalance(s, et0, i0 - spin, i0, taw, taw * 0.8, awcMmPerM);
  let dr = off.dr;
  let snow = off.snowMm;
  const initialFrac = dr / taw;
  const tawFull = taw, swSowing = taw - dr;
  // per-period ETc/ETa for the FAO-33 growth-period yield response: vegetative, flowering, yield formation, ripening
  const pEtc = [0, 0, 0, 0], pEta = [0, 0, 0, 0];
  let rain = 0, eff = 0, et0Sum = 0, etc = 0, eta = 0, irr = 0, stress = 0, heat = 0, frost = 0, run = 0, longest = 0;
  const capLeft = { v: opts.irrigate ? (opts.irrigationCapMm ?? Infinity) : 0 };
  const flowerStart = crop.stages[0] + crop.stages[1] - 7;
  const flowerEnd = crop.stages[0] + crop.stages[1] + 14;
  dr = initialFrac * awcMmPerM * zIni;
  // Subsoil between the root front and the maximum rooting depth, tracked as a depletion (mm). Water that
  // percolates below the young root zone is stored there (up to field capacity) and becomes available as
  // the roots grow into it, as in FAO-56 ch. 8 for a varying root depth (Zr grows from Zr,min to Zr,max;
  // the soil below the root zone is not empty). The previous version discarded that water and refilled
  // newly explored soil at the sowing-day wetness, regardless of the rain since.
  let sub = initialFrac * awcMmPerM * (zMax - zIni);
  taw = awcMmPerM * zIni;

  for (let d = 0; d < L; d++) {
    const i = i0 + d;
    if (i < 0 || i >= s.n) { complete = false; break; }
    const z = zIni + (zMax - zIni) * Math.min(1, d / (crop.stages[0] + crop.stages[1]));
    const tawPrev = taw;
    taw = awcMmPerM * z;
    // newly explored soil enters with the subsoil's current (uniform) depletion
    if (taw > tawPrev) {
      const subTaw = awcMmPerM * zMax - tawPrev;
      const take = subTaw > 0 ? sub * ((taw - tawPrev) / subTaw) : 0;
      dr += take; sub -= take;
    }
    const raw = crop.p * taw;
    const p = s.P[i];
    if (p == null) complete = false;
    let pp = p ?? 0;
    const tMean = s.T[i];
    // early-season snow / late snowmelt (cold continental springs): same degree-day scheme as the off-season
    if (tMean != null && tMean <= SNOW_T_C) { snow += pp; pp = 0; }
    else if (snow > 0 && tMean != null) { const m = Math.min(snow, DDF_MM_PER_C * tMean); snow -= m; pp += m; }
    const pe = pp - runoff(pp);
    const e = Number.isFinite(et0[i]) ? et0[i] : 0;
    const kc = kcOnDay(crop, d);
    const etcD = kc * e;

    let irrD = 0;
    if (capLeft.v > 0 && dr > raw) {
      irrD = Math.min(dr, capLeft.v);
      capLeft.v -= irrD;
    }
    const drRaw = dr - pe - irrD;
    if (drRaw < 0) sub = Math.max(0, sub + drRaw); // percolation below the root front refills the subsoil
    const drStart = Math.max(0, drRaw);
    const ks = drStart > raw ? Math.max(0, (taw - drStart) / ((1 - crop.p) * taw)) : 1;
    const etaD = ks * etcD;
    dr = drStart + etaD;
    if (dr > taw) dr = taw;
    if (ks < 1) stress++;

    const per = d < flowerStart ? 0 : d <= flowerEnd ? 1 : d < crop.stages[0] + crop.stages[1] + crop.stages[2] ? 2 : 3;
    pEtc[per] += etcD; pEta[per] += etaD;
    const pRaw = p ?? 0;
    rain += pRaw; eff += pe; et0Sum += e; etc += etcD; eta += etaD; irr += irrD;
    const tx = s.TX[i], tn = s.TN[i];
    if (tx != null && d >= flowerStart && d <= flowerEnd && tx >= crop.heatThresholdC) heat++;
    if (tn != null && tn <= 0) frost++;
    if (pRaw < 1) { run++; longest = Math.max(longest, run); } else run = 0;
  }
  const relYield = etc > 0 ? yieldResponse(crop, etc, eta, pEtc, pEta) : 0;
  return {
    sowing, maturity: addDays(sowing, L - 1), days: L,
    rainMm: rain, effRainMm: eff, et0Mm: et0Sum, etcMm: etc, etaMm: eta, irrigationMm: irr,
    stressDays: stress, relYield, heatDaysFlowering: heat, frostDays: frost, longestDry: longest, complete,
    swSowingMm: swSowing, tawMm: tawFull,
  };
}
