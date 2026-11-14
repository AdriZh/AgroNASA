import type { DailySeries } from '../domain/types';
import { addDays, dayIndex, diffDays, fromDoy, MONTHS } from '../domain/dates';
import { et0Series } from './et0';

export interface WindowStats {
  start: string; end: string;
  rainMm: number | null; missing: number; days: number;
  longestDry: number | null; hotDays: number | null; frostDays: number | null;
  et0Mm: number | null; meanGwetRoot: number | null; meanTmax: number | null;
}

function clampIdx(s: DailySeries, iso: string) {
  return dayIndex(s.meta.start, iso);
}

/** Descriptive statistics over an explicit date window [start, end] inclusive. Missing days are counted, never treated as zero. */
export function windowStats(s: DailySeries, start: string, end: string, opts: { dryThr?: number; hotThr?: number; frostThr?: number } = {}): WindowStats {
  const dryThr = opts.dryThr ?? 1, hotThr = opts.hotThr ?? 35, frostThr = opts.frostThr ?? 0;
  const i0 = clampIdx(s, start), i1 = clampIdx(s, end);
  const et0 = et0Series(s);
  let rain = 0, miss = 0, run = 0, longest = 0, hot = 0, frost = 0, et = 0, gw = 0, gwN = 0, tx = 0, txN = 0, days = 0;
  for (let i = i0; i <= i1; i++) {
    days++;
    if (i < 0 || i >= s.n) { miss++; run = 0; continue; }
    const p = s.P[i];
    if (p == null) { miss++; run = 0; } else {
      rain += p;
      if (p < dryThr) { run++; longest = Math.max(longest, run); } else run = 0;
    }
    const t = s.TX[i];
    if (t != null) { tx += t; txN++; if (t >= hotThr) hot++; }
    const tn = s.TN[i];
    if (tn != null && tn <= frostThr) frost++;
    if (Number.isFinite(et0[i])) et += et0[i];
    const g = s.GWR[i];
    if (g != null) { gw += g; gwN++; }
  }
  const ok = miss === 0;
  return {
    start, end, days, missing: miss,
    rainMm: ok ? rain : null, longestDry: ok ? longest : null, hotDays: txN ? hot : null, frostDays: frost,
    et0Mm: et, meanGwetRoot: gwN ? gw / gwN : null, meanTmax: txN ? tx / txN : null,
  };
}

/** Calendar years fully covered by the series with no missing precipitation. */
export function completeYears(s: DailySeries): number[] {
  const y0 = Number(s.meta.start.slice(0, 4)), y1 = Number(s.meta.end.slice(0, 4));
  const out: number[] = [];
  for (let y = y0; y <= y1; y++) {
    const a = dayIndex(s.meta.start, `${y}-01-01`), b = dayIndex(s.meta.start, `${y}-12-31`);
    if (a < 0 || b >= s.n) continue;
    let ok = true;
    for (let i = a; i <= b; i++) if (s.P[i] == null) { ok = false; break; }
    if (ok) out.push(y);
  }
  return out;
}

export interface YearRow {
  year: number; annualRain: number; windowRain: number; longestDry: number; hotDays: number; et0: number; gwetRoot: number | null;
}

/** Per-year indicators over a fixed MM-DD window (the planning pack's method, reproducible). */
export function yearlyWindow(s: DailySeries, startMMDD: string, endMMDD: string, hotThr = 35): YearRow[] {
  return completeYears(s).map((y) => {
    const annual = windowStats(s, `${y}-01-01`, `${y}-12-31`);
    const endY = endMMDD < startMMDD ? y + 1 : y;
    const w = windowStats(s, `${y}-${startMMDD}`, `${endY}-${endMMDD}`, { hotThr });
    return { year: y, annualRain: annual.rainMm ?? NaN, windowRain: w.rainMm ?? NaN, longestDry: w.longestDry ?? NaN, hotDays: w.hotDays ?? NaN, et0: w.et0Mm ?? NaN, gwetRoot: w.meanGwetRoot };
  }).filter((r) => Number.isFinite(r.windowRain));
}

export interface MonthClim { month: string; m: number; rain: number; et0: number; tmax: number; tmin: number; gwetRoot: number | null; rainP20: number; rainP80: number }

/** Monthly climatology: mean of per-year monthly sums (complete years only). */
export function monthlyClimatology(s: DailySeries): MonthClim[] {
  const years = completeYears(s);
  const et0 = et0Series(s);
  return MONTHS.map((name, m) => {
    const sums: number[] = [], ets: number[] = [];
    let tx = 0, tn = 0, nT = 0, gw = 0, nG = 0;
    for (const y of years) {
      const a = dayIndex(s.meta.start, `${y}-${String(m + 1).padStart(2, '0')}-01`);
      const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
      let r = 0, e = 0;
      for (let i = a; i < a + days; i++) {
        r += s.P[i] ?? 0; e += Number.isFinite(et0[i]) ? et0[i] : 0;
        if (s.TX[i] != null && s.TN[i] != null) { tx += s.TX[i]!; tn += s.TN[i]!; nT++; }
        if (s.GWR[i] != null) { gw += s.GWR[i]!; nG++; }
      }
      sums.push(r); ets.push(e);
    }
    const mean = (a: number[]) => a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
    return { month: name, m, rain: mean(sums), et0: mean(ets), tmax: tx / Math.max(1, nT), tmin: tn / Math.max(1, nT), gwetRoot: nG ? gw / nG : null, rainP20: quantile(sums, 0.2), rainP80: quantile(sums, 0.8) };
  });
}

export function quantile(values: number[], q: number): number {
  const a = values.filter(Number.isFinite).slice().sort((x, y) => x - y);
  if (!a.length) return NaN;
  const pos = (a.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return a[lo] + (a[hi] - a[lo]) * (pos - lo);
}
export const median = (v: number[]) => quantile(v, 0.5);
export const mean = (v: number[]) => { const a = v.filter(Number.isFinite); return a.reduce((x, y) => x + y, 0) / Math.max(1, a.length); };

/** Share of values ≤ x (empirical non-exceedance), for "how unusual was this season" statements. */
export function percentileRank(values: number[], x: number): number {
  const a = values.filter(Number.isFinite);
  if (!a.length) return NaN;
  return a.filter((v) => v <= x).length / a.length;
}

// ---------- Sowing-date detection ----------

/**
 * Agronomic rainfall onset (Sivakumar 1988, used by AGRHYMET for the Sahel):
 * first day after `earliest` when 3-day rain ≥ 20 mm and no dry spell > 7 days follows within 30 days.
 */
export function rainOnset(s: DailySeries, year: number, earliestMMDD: string, latestMMDD: string): { date: string | null; falseStarts: number } {
  let falseStarts = 0;
  const a = dayIndex(s.meta.start, `${year}-${earliestMMDD}`);
  const latestY = latestMMDD < earliestMMDD ? year + 1 : year;
  const b = dayIndex(s.meta.start, `${latestY}-${latestMMDD}`);
  for (let i = Math.max(a, 0); i <= Math.min(b, s.n - 33); i++) {
    const r3 = (s.P[i] ?? 0) + (s.P[i + 1] ?? 0) + (s.P[i + 2] ?? 0);
    if (r3 < 20) continue;
    let run = 0, maxRun = 0;
    for (let j = i + 3; j < i + 33; j++) {
      if ((s.P[j] ?? 0) < 1) { run++; maxRun = Math.max(maxRun, run); } else run = 0;
    }
    if (maxRun <= 7) return { date: addDays(s.meta.start, i), falseStarts };
    falseStarts++;
    i += 2;
  }
  return { date: null, falseStarts };
}

/** Temperature-based sowing: first day after `earliest` when 5-day mean T2M ≥ threshold. */
export function temperatureSowing(s: DailySeries, year: number, earliestMMDD: string, latestMMDD: string, thrC: number): string | null {
  const a = dayIndex(s.meta.start, `${year}-${earliestMMDD}`);
  const b = dayIndex(s.meta.start, `${year}-${latestMMDD}`);
  for (let i = Math.max(a, 4); i <= Math.min(b, s.n - 1); i++) {
    let sum = 0, ok = true;
    for (let j = i - 4; j <= i; j++) { const t = s.T[j]; if (t == null) { ok = false; break; } sum += t; }
    if (ok && sum / 5 >= thrC) return addDays(s.meta.start, i);
  }
  return null;
}

/** Last spring and first autumn frost (Tmin ≤ 0 °C) for temperate seasons. */
export function frostDates(s: DailySeries, year: number): { lastSpring: string | null; firstAutumn: string | null } {
  let lastSpring: string | null = null, firstAutumn: string | null = null;
  for (let d = 1; d <= 196; d++) {
    const i = dayIndex(s.meta.start, fromDoy(year, d));
    if (i >= 0 && i < s.n && s.TN[i] != null && s.TN[i]! <= 0) lastSpring = fromDoy(year, d);
  }
  for (let d = 197; d <= 365; d++) {
    const i = dayIndex(s.meta.start, fromDoy(year, d));
    if (i >= 0 && i < s.n && s.TN[i] != null && s.TN[i]! <= 0) { firstAutumn = fromDoy(year, d); break; }
  }
  return { lastSpring, firstAutumn };
}

/** Days-since-season-start rainfall accumulation curves for the current year vs. history. */
export function cumulativeRain(s: DailySeries, year: number, startMMDD: string, days: number): (number | null)[] {
  const a = dayIndex(s.meta.start, `${year}-${startMMDD}`);
  const out: (number | null)[] = [];
  let acc = 0;
  for (let k = 0; k < days; k++) {
    const i = a + k;
    if (i < 0 || i >= s.n || s.P[i] == null) { out.push(null); continue; }
    acc += s.P[i]!;
    out.push(acc);
  }
  return out;
}

export function lastDataDate(s: DailySeries) { return s.meta.end; }
export function seriesYears(s: DailySeries) { return diffDays(s.meta.start, s.meta.end) / 365.25; }
