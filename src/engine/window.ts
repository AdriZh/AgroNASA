// "When is your field free?" — a short-window check on the historical NASA POWER record.
// For a field that is free only between two dates (after a harvest, or a skipped main season), each candidate
// crop is replayed in every complete past year: sown at the window start (or the first day inside the window
// whose 5-day mean T2M reaches the crop's sowing temperature), grown on growing-degree days (or its FAO-56
// cycle length when no GDD sum is known), and checked against the window end and the first killing frost.
// The unchanged FAO-56 water balance (simulateSeason) flags severe water stress over the realized season.
// Pure and deterministic: a conditional historical replay, not a forecast.
import type { CropDef, DailySeries, RegionPack } from '../domain/types';
import { addDays, dayIndex, diffDays } from '../domain/dates';
import { completeYears, median } from '../weather/indicators';
import { seasonLength, simulateSeason } from '../weather/waterBalance';
import { isSevere } from './replay';
import { CROPS, cropFor } from '../data/crops';

/** A field-free window as month-day strings (MM-DD). An end before the start wraps into the next year. */
export interface WindowSpec { start: string; end: string }

export type WindowTag = 'cash' | 'cover' | 'rest';
export type Binding = 'frost' | 'window' | 'water' | 'cold' | 'temp' | null;

export interface WindowYear {
  year: number; sowing: string | null; maturity: string | null;
  matured: boolean; frostKill: boolean; tooShort: boolean; noSowing: boolean; severe: boolean;
  /** Season-mean air temperature outside the crop's tolerance range (CropDef.tMeanRange): too hot or too cold to grow well. */
  offTemp: 'hot' | 'cold' | null;
}

export interface WindowFit {
  cropId: string; tag: WindowTag; method: 'gdd' | 'days' | 'none';
  seasons: number;          // past seasons replayed
  matured: number;          // matured before the window end and before a killing frost, within its temperature range
  maturedFrac: number;
  reliable: number;         // matured and without severe water stress
  frostKills: number; tooShort: number; noSowing: number; tooHot: number; tooCold: number;
  severeStress: number;     // matured, but severe water stress (FAO-56 water-limited yield < 50% of attainable)
  medianMaturity: string | null; // MM-DD of the median maturity day (matured seasons only)
  binding: Binding; reason: string;
  seedUsdPerHa: number | null;   // cover crops: seed is the only cost
  years: WindowYear[];
}

export interface WindowResult {
  spec: WindowSpec; days: number; seasons: number;
  all: WindowFit[];          // every candidate, ranked; fallow last
  options: WindowFit[];      // up to 4 to show: the best 3 crops, then fallow
  recommended: string;       // crop id (fallow when nothing is reliable in ≥ RELIABLE_SHARE of seasons)
}

/** A crop is recommended only when it matured without severe water stress in at least this share of past seasons. */
export const RELIABLE_SHARE = 0.7;
/** Killing frost (Tmin, °C): 0 °C for frost-sensitive crops, −2 °C for frost-tolerant ones (CropDef.frostSensitive). */
export const killTempC = (c: CropDef) => (c.frostSensitive ? 0 : -2);
/** Frost only counts after emergence (as in the seasonal replay). */
const EMERGENCE_DAYS = 7;
/** Upper temperature cut-off for growing-degree days (°C): development does not speed up further (R41). */
export const GDD_TUPPER = 30;

const isMMDD = (x: string) => /^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(x);
const wraps = (w: WindowSpec) => w.end < w.start;
/** Window length in days (non-leap reference year). */
export const windowDays = (w: WindowSpec) => {
  const d = diffDays(`2001-${w.start}`, `2001-${w.end}`);
  return d < 0 ? d + 365 : d;
};

/** Pack crops short enough to fit the window, plus every cover crop. Fallow is always included (and listed last). */
export function windowCandidates(pack: RegionPack, w: WindowSpec): string[] {
  const days = windowDays(w);
  const cash = pack.crops.filter((id) => id !== 'fallow' && CROPS[id] && !CROPS[id].cover && seasonLength(cropFor(pack, id)) <= days);
  const cover = Object.values(CROPS).filter((c) => c.cover).map((c) => c.id);
  return [...cash, ...cover, 'fallow'];
}

const tMean = (s: DailySeries, i: number): number | null => {
  const t = s.T[i];
  if (t != null) return t;
  const a = s.TX[i], b = s.TN[i];
  return a != null && b != null ? (a + b) / 2 : null;
};

/** Stretch or shrink the FAO-56 stage lengths to the realized season length (keeps the stage proportions). */
function withLength(c: CropDef, days: number): CropDef {
  const L = seasonLength(c);
  if (days === L) return c;
  const st = c.stages.map((x) => Math.max(1, Math.round((x * days) / L))) as CropDef['stages'];
  st[3] = Math.max(1, days - st[0] - st[1] - st[2]);
  return { ...c, stages: st };
}

/** One crop, one past year. */
function fitYear(s: DailySeries, c: CropDef, w: WindowSpec, year: number, awcMmPerM: number): WindowYear | null {
  const i0 = dayIndex(s.meta.start, `${year}-${w.start}`);
  const iEnd = dayIndex(s.meta.start, `${wraps(w) ? year + 1 : year}-${w.end}`);
  if (i0 < 0 || iEnd >= s.n) return null;
  const out: WindowYear = { year, sowing: null, maturity: null, matured: false, frostKill: false, tooShort: false, noSowing: false, severe: false, offTemp: null };
  // sowing: first day in the window whose 5-day mean temperature reaches the crop threshold
  let iSow = -1;
  for (let i = Math.max(i0, 4); i <= iEnd; i++) {
    let sum = 0, ok = true;
    for (let j = i - 4; j <= i; j++) { const t = tMean(s, j); if (t == null) { ok = false; break; } sum += t; }
    if (ok && sum / 5 >= c.sowTempC) { iSow = i; break; }
  }
  if (iSow < 0) { out.noSowing = true; return out; }
  out.sowing = addDays(s.meta.start, iSow);
  // maturity: GDD sum (daily mean above the base temperature) or the FAO-56 cycle length
  let iMat = -1;
  if (c.tbase != null && c.gddToMaturity != null) {
    let gdd = 0;
    for (let i = iSow; i < s.n && i <= iSow + 365; i++) {
      const t = tMean(s, i);
      if (t != null) gdd += Math.max(0, Math.min(t, GDD_TUPPER) - c.tbase);
      if (gdd >= c.gddToMaturity) { iMat = i; break; }
    }
  } else if (c.id !== 'fallow') {
    iMat = iSow + seasonLength(c);
  }
  // killing frost after emergence, before maturity (only inside the window: the field is cleared at its end)
  const kill = killTempC(c);
  const lastCheck = Math.min(iMat < 0 ? iEnd : iMat, iEnd);
  for (let i = iSow + EMERGENCE_DAYS; i <= lastCheck; i++) {
    const tn = s.TN[i];
    if (tn != null && tn <= kill) { out.frostKill = true; break; }
  }
  if (iMat >= 0 && iMat < s.n) out.maturity = addDays(s.meta.start, iMat);
  if (!out.frostKill && (iMat < 0 || iMat > iEnd)) out.tooShort = true;
  if (!out.frostKill && !out.tooShort) {
    let sum = 0, k = 0;
    for (let i = iSow; i <= iMat; i++) { const t = tMean(s, i); if (t != null) { sum += t; k++; } }
    const m = k ? sum / k : null;
    if (m != null && m > c.tMeanRange[1]) out.offTemp = 'hot';
    else if (m != null && m < c.tMeanRange[0]) out.offTemp = 'cold';
  }
  out.matured = !out.frostKill && !out.tooShort && !out.offTemp;
  if (out.matured) {
    const sim = simulateSeason(s, withLength(c, iMat - iSow), out.sowing, awcMmPerM, {});
    out.severe = sim.complete ? isSevere(sim) : false;
  }
  return out;
}

const seedCost = (c: CropDef) => (c.coverSeed ? c.coverSeed.kgPerHa * c.coverSeed.usdPerKg : null);
const of = (k: number, n: number) => `${k} of ${n}`;

function summarize(c: CropDef, years: WindowYear[], w: WindowSpec): WindowFit {
  const n = years.length;
  const matured = years.filter((y) => y.matured);
  const frostKills = years.filter((y) => y.frostKill).length;
  const tooShort = years.filter((y) => y.tooShort).length;
  const noSowing = years.filter((y) => y.noSowing).length;
  const severeStress = matured.filter((y) => y.severe).length;
  const tooHot = years.filter((y) => y.offTemp === 'hot').length;
  const tooCold = years.filter((y) => y.offTemp === 'cold').length;
  const tag: WindowTag = c.id === 'fallow' ? 'rest' : c.cover ? 'cover' : 'cash';
  const method = c.id === 'fallow' ? 'none' : c.tbase != null && c.gddToMaturity != null ? 'gdd' : 'days';
  // median maturity as a day offset from the window start (robust across a year boundary)
  const offs = matured.filter((y) => y.maturity).map((y) => diffDays(`${y.year}-${w.start}`, y.maturity!));
  const medianMaturity = offs.length ? addDays(`2001-${w.start}`, Math.round(median(offs))).slice(5) : null;
  const fails: [Binding, number][] = [['frost', frostKills], ['window', tooShort], ['cold', noSowing + tooCold], ['temp', tooHot], ['water', severeStress]];
  const [binding, worst] = fails.reduce((a, b) => (b[1] > a[1] ? b : a), [null, 0] as [Binding, number]);
  const reason = tag === 'rest'
    ? 'No seed or work; the bare field keeps stored soil water for the next season.'
    : !worst
      ? `Ready by ${fmtMMDD(medianMaturity)} in a typical year; no frost or severe water stress in the record.`
      : binding === 'frost'
        ? `First autumn frost (≤ ${String(killTempC(c)).replace("-", "−")} °C) before maturity in ${of(frostKills, n)} years.`
        : binding === 'window'
          ? `Not ready before ${fmtMMDD(w.end)} in ${of(tooShort, n)} years: too few warm days.`
          : binding === 'cold'
            ? (noSowing >= tooCold ? `Too cold to sow (5-day mean below ${c.sowTempC} °C) in ${of(noSowing, n)} years.` : `Too cool to grow well (season mean below ${c.tMeanRange[0]} °C) in ${of(tooCold, n)} years.`)
            : binding === 'temp'
              ? `Too hot for this crop (season mean above ${c.tMeanRange[1]} °C) in ${of(tooHot, n)} years.`
            : `Rain runs out: severe water stress in ${of(severeStress, n)} years.`;
  return {
    cropId: c.id, tag, method, seasons: n,
    matured: matured.length, maturedFrac: n ? matured.length / n : 0,
    reliable: matured.length - severeStress,
    frostKills, tooShort, noSowing, tooHot, tooCold, severeStress, medianMaturity,
    binding: tag === 'rest' ? null : binding, reason, seedUsdPerHa: seedCost(c), years,
  };
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** "07-15" → "15 Jul". */
export const fmtMMDD = (x: string | null) => (x ? `${Number(x.slice(3))} ${MONTHS[Number(x.slice(0, 2)) - 1]}` : '—');

/**
 * Replay the window for every candidate crop in every complete past year of the series.
 * Ranking: seasons that matured without severe water stress, then matured seasons, then cash before cover,
 * then the earlier median maturity (more margin before frost or the window end).
 * Fallow (rest) is always last and is the recommendation when no crop is reliable in ≥ 70% of seasons.
 */
export function fitWindow(s: DailySeries, pack: RegionPack, cropIds: string[] | undefined, w: WindowSpec, opts: { awcMmPerM?: number } = {}): WindowResult {
  if (!isMMDD(w.start) || !isMMDD(w.end) || w.start === w.end) throw new Error(`invalid window ${w.start} → ${w.end}`);
  const awc = opts.awcMmPerM ?? 140;
  const ids = [...new Set([...(cropIds ?? windowCandidates(pack, w)).filter((id) => id !== 'fallow' && CROPS[id]), 'fallow'])];
  const years = completeYears(s);
  const fits = ids.map((id) => {
    const c = cropFor(pack, id);
    const ys = id === 'fallow'
      ? years.filter((y) => dayIndex(s.meta.start, `${wraps(w) ? y + 1 : y}-${w.end}`) < s.n).map((y): WindowYear => ({ year: y, sowing: null, maturity: null, matured: true, frostKill: false, tooShort: false, noSowing: false, severe: false, offTemp: null }))
      : years.map((y) => fitYear(s, c, w, y, awc)).filter((y): y is WindowYear => !!y);
    return summarize(c, ys, w);
  });
  const crops = fits.filter((f) => f.tag !== 'rest').sort((a, b) => b.reliable - a.reliable || b.matured - a.matured || (a.tag === 'cash' ? 0 : 1) - (b.tag === 'cash' ? 0 : 1) || (a.medianMaturity ?? '99').localeCompare(b.medianMaturity ?? '99') || a.cropId.localeCompare(b.cropId));
  const fallow = fits.find((f) => f.tag === 'rest')!;
  const all = [...crops, fallow];
  const best = crops[0];
  const recommended = best && best.seasons && best.reliable / best.seasons >= RELIABLE_SHARE ? best.cropId : 'fallow';
  // up to 4 options: the best three crops, then rest. When those are all cover crops, the best cash crop takes the
  // third slot so the farmer sees why no cash crop fits (e.g. frost before maturity).
  const top = crops.slice(0, 3);
  const cash = crops.find((f) => f.tag === 'cash');
  if (cash && !top.includes(cash) && top.length === 3) top[2] = cash;
  return { spec: w, days: windowDays(w), seasons: fallow.seasons, all, options: [...top, fallow], recommended };
}

/** A sensible default gap per region: after harvest in temperate packs, the dry season after the rains in tropical ones. */
export function defaultWindow(pack: RegionPack, lat = 0): WindowSpec & { label: string } {
  if (pack.id === 'kz-north-steppe') return { start: '08-15', end: '10-31', label: 'After the wheat harvest' };
  if (pack.id === 'sn-groundnut-basin') return { start: '10-01', end: '12-31', label: 'After the rains' };
  return { ...skippedSeason(lat), label: 'Mid-summer to end of autumn' };
}
/** "I skipped the main season": free from mid-summer to the end of autumn (mid-Jul → Nov, or mid-Jan → May in the south). */
export const skippedSeason = (lat = 0): WindowSpec & { label: string } =>
  lat < 0 ? { start: '01-15', end: '05-31', label: 'Skipped the main season' } : { start: '07-15', end: '11-30', label: 'Skipped the main season' };

/** Cover crops are never cash crops; anything else with a price is. Exposed for tests and UI. */
export const isCashOption = (f: WindowFit) => f.tag === 'cash';
