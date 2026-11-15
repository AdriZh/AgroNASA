// Growing-season length from the NASA POWER daily record: per year the last spring frost, the first autumn
// frost (Tmin ≤ 0 °C, T2M_MIN), the frost-free days and the growing degree-days (GDD) above a crop's base
// temperature; then whether a crop's cycle fits before the first autumn frost.
//
// Self-contained on purpose (only the date helpers and a DailySeries): the field-window feature and any later
// screen can reuse these functions without going through the planning engine.
//
// Method notes
// - Season year: 1 Jan – 31 Dec in the northern hemisphere, 1 Jul – 30 Jun in the southern one. Frost in the
//   first 196 days of the season year is "spring" frost, frost after that "autumn" frost (as in frostDates).
// - Crop need: the crop library has no calibrated base temperatures or thermal-time requirements, so the
//   blocking check compares the crop's cycle length (sum of the FAO-56 stage lengths, R8 Table 11 as used by the
//   water balance) with the days from that year's sowing to the first autumn frost. GDD (McMaster & Wilhelm
//   1997, R40: Σ max(0, Tmean − Tbase)) is reported alongside, with a conventional Tbase of 10 °C for
//   warm-season (frost-sensitive) crops and 5 °C for cool-season crops unless a crop defines `tbaseC`.
//   A crop that defines both `tbaseC` and `gddToMaturity` is checked on thermal time instead of days.
// - Overwintering crops (frost-tolerant with a cycle of more than 200 days, e.g. winter wheat) and crops sown in
//   the autumn half of the season year (rabi, Australian autumn break) are not checked: frost during their
//   season is expected and they are not limited by the first autumn frost.
// - A location with no frost in most years is frost-free: every crop passes.
import type { DailySeries } from '../domain/types';
import { addDays, dayIndex } from '../domain/dates';

export const FROST_TMIN_C = 0;
const SPRING_DAYS = 196;          // first 196 days of the season year count as spring (≈ 15 July north)
const MAX_MISSING_SHARE = 0.1;    // a season year with more than 10% missing Tmin is skipped
const OVERWINTER_DAYS = 200;

export interface FrostYear {
  year: number;                    // season year (southern hemisphere: year of its 1 July start)
  start: string;                   // ISO first day of the season year
  lastSpringFrost: string | null;  // ISO date, null when no spring frost
  firstAutumnFrost: string | null; // ISO date, null when no autumn frost
  frostFreeDays: number;           // days strictly between the two frosts (365 when frost-free)
}

/** Minimal crop shape the season check needs (CropDef satisfies it). */
export interface SeasonCrop {
  stages: number[]; frostSensitive: boolean;
  tbaseC?: number; gddToMaturity?: number;
}

export interface SeasonYearCheck {
  year: number; sowing: string; maturity: string; firstAutumnFrost: string | null;
  daysToFrost: number | null;      // sowing → first autumn frost (null: no autumn frost)
  gdd: number;                     // GDD above Tbase from sowing to the first autumn frost (or the full cycle)
  matures: boolean;
}

export interface SeasonLengthCheck {
  applicable: boolean;             // false for overwintering / autumn-sown crops or no usable record
  frostFree: boolean;              // no autumn frost in most season years
  cycleDays: number; tbaseC: number; gddNeed: number | null;
  years: number; okYears: number;  // season years checked, and those in which the crop matured before frost
  pass: boolean;                   // fails only when the crop misses the frost in more than half of the years
  medianFrostFreeDays: number | null; medianLastSpring: string | null; medianFirstAutumn: string | null; // MM-DD
  medianGdd: number | null;        // median season GDD above Tbase, sowing → first autumn frost
  detail: SeasonYearCheck[];
}

const isSouth = (s: DailySeries) => s.meta.lat < 0;
const seasonStart = (s: DailySeries, y: number) => (isSouth(s) ? `${y}-07-01` : `${y}-01-01`);

function med(v: number[]): number | null {
  if (!v.length) return null;
  const a = [...v].sort((x, y) => x - y);
  const m = a.length >> 1;
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}
/** Median calendar day (MM-DD) of a set of offsets from each season year's start. */
function medianMmdd(s: DailySeries, offsets: number[]): string | null {
  const m = med(offsets);
  if (m == null) return null;
  const y0 = Number(s.meta.start.slice(0, 4));
  return addDays(seasonStart(s, y0 + 1), Math.round(m)).slice(5);
}

const cache = new WeakMap<DailySeries, FrostYear[]>();

/** Last spring frost, first autumn frost and frost-free days for every complete season year of the record. */
export function frostYears(s: DailySeries, thresholdC = FROST_TMIN_C): FrostYear[] {
  if (thresholdC === FROST_TMIN_C && cache.has(s)) return cache.get(s)!;
  const y0 = Number(s.meta.start.slice(0, 4)), y1 = Number(s.meta.end.slice(0, 4));
  const out: FrostYear[] = [];
  for (let y = y0; y <= y1; y++) {
    const start = seasonStart(s, y);
    const i0 = dayIndex(s.meta.start, start);
    if (i0 < 0 || i0 + 364 >= s.n) continue;
    let last = -1, first = -1, missing = 0;
    for (let k = 0; k < 365; k++) {
      const tn = s.TN[i0 + k];
      if (tn == null || !Number.isFinite(tn)) { missing++; continue; }
      if (tn > thresholdC) continue;
      if (k < SPRING_DAYS) last = k;
      else if (first < 0) first = k;
    }
    if (missing > 365 * MAX_MISSING_SHARE) continue;
    out.push({
      year: y, start,
      lastSpringFrost: last >= 0 ? addDays(start, last) : null,
      firstAutumnFrost: first >= 0 ? addDays(start, first) : null,
      frostFreeDays: (first >= 0 ? first : 365) - last - 1,
    });
  }
  if (thresholdC === FROST_TMIN_C) cache.set(s, out);
  return out;
}

/** Growing degree-days Σ max(0, Tmean − Tbase) over [fromIso, fromIso + days) (Tmean = T2M, else (Tmax+Tmin)/2). */
export function gdd(s: DailySeries, fromIso: string, days: number, tbaseC: number): number {
  const i0 = dayIndex(s.meta.start, fromIso);
  let sum = 0;
  for (let k = 0; k < days; k++) {
    const i = i0 + k;
    if (i < 0 || i >= s.n) continue;
    const t = s.T[i] ?? (s.TX[i] != null && s.TN[i] != null ? (s.TX[i]! + s.TN[i]!) / 2 : null);
    if (t != null && t > tbaseC) sum += t - tbaseC;
  }
  return sum;
}

export const cropTbase = (c: SeasonCrop) => c.tbaseC ?? (c.frostSensitive ? 10 : 5);
export const cycleDays = (c: SeasonCrop) => c.stages.reduce((a, b) => a + b, 0);

/**
 * Does the crop mature before the first autumn frost? `sowings` maps a calendar year to that year's sowing date
 * (the replay's dates); without it, the crop is sown the day after the last spring frost (a week later for
 * frost-sensitive crops), i.e. the longest season the frost record allows.
 */
export function seasonLengthCheck(s: DailySeries, crop: SeasonCrop, sowings?: Record<number, string>): SeasonLengthCheck {
  const fy = frostYears(s);
  const days = cycleDays(crop), tb = cropTbase(crop);
  const gddNeed = crop.tbaseC != null && crop.gddToMaturity != null ? crop.gddToMaturity : null;
  const frostFree = fy.length > 0 && fy.filter((f) => f.firstAutumnFrost == null).length > fy.length / 2;
  const base: SeasonLengthCheck = {
    applicable: false, frostFree, cycleDays: days, tbaseC: tb, gddNeed, years: 0, okYears: 0, pass: true,
    medianFrostFreeDays: med(fy.map((f) => f.frostFreeDays)),
    medianLastSpring: medianMmdd(s, fy.filter((f) => f.lastSpringFrost).map((f) => dayIndex(f.start, f.lastSpringFrost!))),
    medianFirstAutumn: medianMmdd(s, fy.filter((f) => f.firstAutumnFrost).map((f) => dayIndex(f.start, f.firstAutumnFrost!))),
    medianGdd: null, detail: [],
  };
  if (!fy.length || (!crop.frostSensitive && days > OVERWINTER_DAYS)) return base;
  const byYear = new Map(fy.map((f) => [f.year, f]));
  // the replay keys sowings by calendar year; map each onto the season year it falls in
  const sows: { f: FrostYear; sowing: string }[] = [];
  if (sowings) {
    for (const iso of Object.values(sowings)) {
      const y = Number(iso.slice(0, 4));
      const f = [byYear.get(y), byYear.get(y - 1)].find((x) => x && dayIndex(x.start, iso) >= 0 && dayIndex(x.start, iso) < 365);
      if (f) sows.push({ f, sowing: iso });
    }
  } else {
    for (const f of fy) sows.push({ f, sowing: f.lastSpringFrost ? addDays(f.lastSpringFrost, crop.frostSensitive ? 8 : 1) : f.start });
  }
  const detail: SeasonYearCheck[] = [];
  for (const { f, sowing } of sows) {
    if (dayIndex(f.start, sowing) >= SPRING_DAYS) continue; // autumn-sown in this season year: not frost-limited
    const maturity = addDays(sowing, days - 1);
    const daysToFrost = f.firstAutumnFrost ? dayIndex(sowing, f.firstAutumnFrost) : null;
    const g = gdd(s, sowing, daysToFrost ?? days, tb);
    const matures = gddNeed != null ? daysToFrost == null || g >= gddNeed : daysToFrost == null || daysToFrost >= days;
    detail.push({ year: f.year, sowing, maturity, firstAutumnFrost: f.firstAutumnFrost, daysToFrost, gdd: Math.round(g), matures });
  }
  if (!detail.length) return base;
  const okYears = detail.filter((d) => d.matures).length;
  return {
    ...base, applicable: true, years: detail.length, okYears,
    pass: frostFree || okYears >= detail.length / 2,
    medianGdd: med(detail.map((d) => d.gdd)), detail,
  };
}
