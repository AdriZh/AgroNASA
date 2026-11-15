// "Field from space": NASA point data decoded from GIBS + NASA EONET events, for one location.
import type { EngineOutput } from '../engine/plan';
import { addDays, doy, todayISO } from '../domain/dates';
import { percentileRank } from '../weather/indicators';
import { fetchEonet, GRACE_DATES, ndviDates, pointValue, pool, POINT_LAYERS, type EonetEvent, type PointValue } from '../weather/gibsPoint';

export interface NdviYear { year: number; points: { date: string; doy: number; value: number | null }[]; peak: number | null; peakDate: string | null }
export interface SpaceData {
  landcover: PointValue | null;
  smap: { now: PointValue | null; normal: { year: number; value: number | null }[]; pct: number | null };
  grace: { series: { year: number; date: string; value: number | null }[]; trendCmYr: number | null };
  ndvi: { years: NdviYear[]; seasonLabel: string; cropId: string; r: number | null; pairs: { year: number; peak: number; rel: number }[] };
  events: EonetEvent[] | null; eventsError?: string;
}

export function pearson(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 4) return null;
  const mx = x.reduce((a, b) => a + b, 0) / n, my = y.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; }
  return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null;
}
export function slopePerYear(pts: { year: number; value: number }[]): number | null {
  if (pts.length < 5) return null;
  const n = pts.length, mx = pts.reduce((a, p) => a + p.year, 0) / n, my = pts.reduce((a, p) => a + p.value, 0) / n;
  let sxy = 0, sxx = 0;
  for (const p of pts) { sxy += (p.year - mx) * (p.value - my); sxx += (p.year - mx) ** 2; }
  return sxx ? sxy / sxx : null;
}

export async function loadSpace(lat: number, lon: number, engine: EngineOutput, onProgress: (label: string, done: number, total: number) => void): Promise<SpaceData> {
  const L = POINT_LAYERS;
  const today = todayISO();
  const thisYear = Number(today.slice(0, 4));
  // 1) quick layers: land cover, SMAP now vs the same date in past years, GRACE yearly, EONET
  const smapNowDate = addDays(today, -5);
  const smapYears = Array.from({ length: 10 }, (_, k) => thisYear - 10 + k).filter((y) => y >= 2016);
  const quick: { kind: string; date: string; year?: number }[] = [
    { kind: 'landcover', date: '2024-01-01' },
    { kind: 'smap', date: smapNowDate },
    ...smapYears.map((y) => ({ kind: 'smapN', date: `${y}${smapNowDate.slice(4)}`, year: y })),
    ...GRACE_DATES.map((d) => ({ kind: 'grace', date: d, year: Number(d.slice(0, 4)) })),
  ];
  const eventsP = fetchEonet(lat, lon).then((e) => ({ e }), (err) => ({ e: null, err: String(err?.message ?? err) }));
  const qv = await pool(quick, 8, (q) => pointValue(q.kind === 'smapN' ? L.smap : (L as any)[q.kind], lat, lon, q.date), (d, t) => onProgress('NASA SMAP, GRACE & MODIS land cover', d, t));
  const landcover = qv[0] ?? null;
  const smapNow = qv[1] ?? null;
  const normal = quick.map((q, i) => ({ q, v: qv[i] })).filter((x) => x.q.kind === 'smapN').map((x) => ({ year: x.q.year!, value: x.v?.value ?? null }));
  const grace = quick.map((q, i) => ({ q, v: qv[i] })).filter((x) => x.q.kind === 'grace').map((x) => ({ year: x.q.year!, date: x.q.date, value: x.v?.value ?? null }));
  const normVals = normal.map((x) => x.value).filter((v): v is number => v != null);
  const smapPct = smapNow?.value != null && normVals.length >= 3 ? percentileRank(normVals, smapNow.value) : null;
  const gPts = grace.filter((g) => g.value != null && g.value > -29.9) as { year: number; value: number }[];

  // 2) MODIS NDVI 16-day around the main season, last ~10 seasons + the current one
  const w = engine.windows[0];
  const double = engine.pack.mode === 'double' || w.earliest === 'auto';
  const nYears = double ? 6 : 10;
  const lastComplete = Math.min(thisYear - 1, 2025);
  const years = [...Array.from({ length: nYears }, (_, k) => lastComplete - nYears + 1 + k), thisYear];
  const startDoy = double || w.earliest === 'auto' ? 1 : doy(`2001-${w.earliest}`) - 20;
  const spanDays = double ? 366 : 210;
  const jobs: { year: number; date: string }[] = [];
  for (const y of years) {
    for (const d of [...ndviDates(y), ...ndviDates(y + 1)]) {
      const off = doy(d) - startDoy + (Number(d.slice(0, 4)) - y) * 365;
      if (off >= 0 && off <= spanDays && d <= addDays(today, -20)) jobs.push({ year: y, date: d });
    }
  }
  const nv = await pool(jobs, 8, (j) => pointValue(L.ndvi, lat, lon, j.date), (d, t) => onProgress('MODIS NDVI history at your field', d, t));
  const byYear: NdviYear[] = years.map((y) => {
    const points = jobs.map((j, i) => ({ j, v: nv[i] })).filter((x) => x.j.year === y).map((x) => ({ date: x.j.date, doy: doy(x.j.date) - startDoy + (Number(x.j.date.slice(0, 4)) - y) * 365, value: x.v?.value ?? null }));
    const valid = points.filter((p) => p.value != null);
    const best = valid.reduce<typeof valid[number] | null>((a, p) => (!a || p.value! > a.value! ? p : a), null);
    return { year: y, points, peak: best?.value ?? null, peakDate: best?.date ?? null };
  });
  // independent check: does the POWER-driven water-balance model agree with MODIS greenness?
  const crop = engine.baseline.crops[0] === 'fallow' ? engine.baseline.crops[1] : engine.baseline.crops[0];
  const risk = engine.baseline.seasons.find((s) => s.cropId === crop)?.risk;
  const relBy = new Map((risk?.years ?? []).map((y) => [y.year, y.relYield]));
  const pairs = byYear.filter((y) => y.peak != null && relBy.has(y.year)).map((y) => ({ year: y.year, peak: y.peak!, rel: relBy.get(y.year)! }));
  const r = pearson(pairs.map((p) => p.peak), pairs.map((p) => p.rel));
  const ev = await eventsP;
  return {
    landcover, smap: { now: smapNow, normal, pct: smapPct },
    grace: { series: grace, trendCmYr: slopePerYear(gPts) },
    ndvi: { years: byYear, seasonLabel: double ? 'calendar year' : w.label, cropId: crop, r, pairs },
    events: ev.e, eventsError: 'err' in ev ? ev.err : undefined,
  };
}
