// Hindcast: modeled water-limited yield index (the unchanged replay at the demo grid cell) vs. FAOSTAT national
// yields (R39), linearly detrended to remove the technology trend. A single NASA POWER grid cell against a
// national average is a weak test by construction (many agro-zones, pests, prices, area shifts), so the
// numbers are reported as they come out — not tuned.
import faostat from './faostat-yields.json';
import modeled from './modeled.json';

export interface HindcastCase {
  key: 'SN-millet' | 'SN-groundnut' | 'KZ-wheat';
  label: string; country: string; cropId: string; demo: 'bambey' | 'kostanay';
  droughtYears: number[];
}

export const HINDCAST_CASES: HindcastCase[] = [
  { key: 'SN-millet', label: 'Senegal · pearl millet', country: 'Senegal', cropId: 'millet', demo: 'bambey', droughtYears: [2002, 2011] },
  { key: 'SN-groundnut', label: 'Senegal · groundnut', country: 'Senegal', cropId: 'groundnut', demo: 'bambey', droughtYears: [2002, 2011] },
  { key: 'KZ-wheat', label: 'Kazakhstan · spring wheat', country: 'Kazakhstan', cropId: 'wheat', demo: 'kostanay', droughtYears: [2010, 2012] },
];

export interface HindcastPoint { year: number; model: number; national: number; nationalKgHa: number; trendKgHa: number; zModel: number; zNational: number }
export interface HindcastResult {
  c: HindcastCase; points: HindcastPoint[]; n: number; r: number;
  /** drought years whose modeled index is in the lowest third of the modeled years */
  hits: { year: number; hit: boolean; modelRank: number; nationalBelowTrend: boolean }[];
  source: { url: string; retrieved: string; itemCode: number; areaCode: number; elementCode: number };
}

export function linearTrend(xs: number[], ys: number[]) {
  const n = xs.length, mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const b = sxx > 0 ? sxy / sxx : 0;
  return { a: my - b * mx, b };
}

export function pearson(a: number[], b: number[]): number {
  const n = a.length; if (n < 3) return NaN;
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < n; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : NaN;
}

const z = (v: number[]) => {
  const m = v.reduce((a, b) => a + b, 0) / v.length;
  const sd = Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) || 1;
  return v.map((x) => (x - m) / sd);
};

type ModeledFile = { generated: string; note: string; series: Record<string, { year: number; relYield: number }[]> };
type FaoFile = { urls: string[]; retrieved: string; series: Record<string, { areaCode: number; itemCode: number; elementCode: number; points: { year: number; kgHa: number }[] }> };

/** Compare a modeled index (year → Ya/Ym) with the detrended national yield for the overlapping years. */
export function hindcast(c: HindcastCase, model: { year: number; relYield: number }[] = (modeled as ModeledFile).series[c.key]): HindcastResult {
  const fao = (faostat as FaoFile).series[c.key];
  const m = new Map(model.map((p) => [p.year, p.relYield]));
  const nat = fao.points.filter((p) => m.has(p.year));
  const years = nat.map((p) => p.year), kg = nat.map((p) => p.kgHa);
  const { a, b } = linearTrend(years, kg);
  const trend = years.map((y) => a + b * y);
  const ratio = kg.map((v, i) => v / trend[i]);           // detrended national yield, 1 = on trend
  const mod = years.map((y) => m.get(y)!);
  const zm = z(mod), zn = z(ratio);
  const points = years.map((year, i) => ({ year, model: mod[i], national: ratio[i], nationalKgHa: kg[i], trendKgHa: trend[i], zModel: zm[i], zNational: zn[i] }));
  const sorted = [...mod].sort((x, y) => x - y);
  const hits = c.droughtYears.filter((y) => m.has(y)).map((year) => {
    const v = m.get(year)!;
    const modelRank = sorted.indexOf(v) + 1;                // 1 = driest modeled year
    const i = years.indexOf(year);
    return { year, modelRank, hit: modelRank <= Math.ceil(sorted.length / 3), nationalBelowTrend: i >= 0 && ratio[i] < 1 };
  });
  return {
    c, points, n: points.length, r: pearson(mod, ratio), hits,
    source: { url: (faostat as FaoFile).urls[c.key.startsWith('KZ') ? 1 : 0], retrieved: (faostat as FaoFile).retrieved, itemCode: fao.itemCode, areaCode: fao.areaCode, elementCode: fao.elementCode },
  };
}

export const allHindcasts = () => HINDCAST_CASES.map((c) => hindcast(c));
