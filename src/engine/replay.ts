// Historical-replay climate risk: simulate each crop in every complete NASA POWER year,
// sowing on that year's detected date. Output is a conditional historical scenario, not a forecast.
import type { CropDef, DailySeries, RegionPack, SoilProfile } from '../domain/types';
import { addDays, dayIndex, doy, fromDoy } from '../domain/dates';
import { completeYears, frostDates, median, monthlyClimatology, quantile, rainOnset, temperatureSowing } from '../weather/indicators';
import { seasonLength, simulateSeason, type SeasonSim } from '../weather/waterBalance';

export interface SowingWindow { method: 'rain-onset' | 'temperature'; earliest: string; latest: string; auto: boolean; note: string; lastFrost?: string }

const mmdd = (iso: string) => iso.slice(5);

/** Resolve the sowing window; the global pack derives it from the NASA climatology at the location. */
export function resolveWindow(pack: RegionPack, s: DailySeries): SowingWindow {
  const w = resolveWindowBase(pack, s);
  if (w.method === 'temperature' && s.meta.lat > 0) {
    // climatological (median) last spring frost: frost-sensitive crops are not sown before it + 7 days
    const doys = completeYears(s).map((y) => frostDates(s, y).lastSpring).filter((d): d is string => !!d).map(doy);
    if (doys.length) w.lastFrost = mmdd(fromDoy(2001, median(doys)));
  }
  return w;
}

function resolveWindowBase(pack: RegionPack, s: DailySeries): SowingWindow {
  if (pack.earliestSowing !== 'auto') {
    return { method: pack.sowingMethod, earliest: pack.earliestSowing, latest: pack.latestSowing, auto: false, note: `${pack.short} pack window` };
  }
  const clim = monthlyClimatology(s);
  const tMean = clim.map((m) => (m.tmax + m.tmin) / 2);
  const coldest = Math.min(...tMean);
  if (coldest < 8) {
    // temperate: season starts in the first month whose mean temperature reaches 8 °C (searching from the coldest month)
    const c0 = tMean.indexOf(coldest);
    let m = c0;
    for (let k = 1; k <= 12; k++) { const mm = (c0 + k) % 12; if (tMean[mm] >= 8) { m = mm; break; } }
    const earliest = `${String(m + 1).padStart(2, '0')}-01`;
    return { method: 'temperature', earliest, latest: mmdd(addDays(`2001-${earliest}`, 60)), auto: true, note: 'Auto: temperate climate — sowing when 5-day mean air temperature reaches the crop threshold' };
  }
  // tropical: wettest consecutive 4-month window; window opens one month before it starts
  let best = 0, bestM = 0;
  for (let m = 0; m < 12; m++) {
    const r = [0, 1, 2, 3].reduce((a, k) => a + clim[(m + k) % 12].rain, 0);
    if (r > best) { best = r; bestM = m; }
  }
  const startM = (bestM + 11) % 12;
  const earliest = `${String(startM + 1).padStart(2, '0')}-15`;
  return { method: 'rain-onset', earliest, latest: mmdd(addDays(`2001-${earliest}`, 80)), auto: true, note: 'Auto: tropical climate — sowing at agronomic rain onset within the wettest 4-month period' };
}

export interface SowingResult { date: string; detected: boolean; falseStarts: number }

export function sowingFor(s: DailySeries, w: SowingWindow, crop: CropDef, year: number): SowingResult | null {
  const latestYear = w.latest < w.earliest ? year + 1 : year;
  const latestISO = `${latestYear}-${w.latest}`;
  if (w.method === 'rain-onset') {
    const r = rainOnset(s, year, w.earliest, w.latest);
    if (r.date) return { date: r.date, detected: true, falseStarts: r.falseStarts };
    return { date: latestISO, detected: false, falseStarts: r.falseStarts };
  }
  let earliest = w.earliest, latest = w.latest;
  if (crop.frostSensitive && w.lastFrost) {
    const safe = mmdd(addDays(`2001-${w.lastFrost}`, 7));
    if (safe > earliest) earliest = safe;
    if (latest < earliest) latest = mmdd(addDays(`2001-${earliest}`, 30));
  }
  const d = temperatureSowing(s, year, earliest, latest, crop.sowTempC);
  return d ? { date: d, detected: true, falseStarts: 0 } : { date: `${year}-${latest}`, detected: false, falseStarts: 0 };
}

export interface YearSim extends SeasonSim { year: number; sowingDetected: boolean; meanT: number | null }

export interface CropRisk {
  cropId: string;
  years: YearSim[];
  medianRel: number; p20Rel: number; p80Rel: number;
  pSevere: number;            // share of years with Ya/Ym < 0.5
  medianHeat: number; pHeat: number;
  pFrost: number;             // frost-sensitive: share of years with frost after emergence
  medianIrrigation: number;
  medianSowing: string | null; p20Sowing: string | null; p80Sowing: string | null;
  pNoOnset: number;
  medianRain: number; medianDry: number;
  tempOutOfRange: number;     // share of years with season-mean T outside the crop range
  meanSeasonT: number | null;
}

function seasonMeanT(s: DailySeries, sowing: string, days: number): number | null {
  const i0 = dayIndex(s.meta.start, sowing);
  let sum = 0, n = 0;
  for (let i = i0; i < i0 + days && i < s.n; i++) if (s.T[i] != null) { sum += s.T[i]!; n++; }
  return n ? sum / n : null;
}

export function replayCrop(s: DailySeries, w: SowingWindow, crop: CropDef, soil: SoilProfile, irrigation: { on: boolean; capMm: number }, afterFallow = false): CropRisk {
  const years = completeYears(s);
  const sims: YearSim[] = [];
  for (const y of years) {
    const sw = sowingFor(s, w, crop, y);
    if (!sw) continue;
    const sim = simulateSeason(s, crop, sw.date, soil.awcMmPerM, { irrigate: irrigation.on, irrigationCapMm: irrigation.capMm, afterFallow });
    if (!sim.complete) continue;
    // frost after emergence (day ≥ 7) for frost-sensitive crops
    let frostAfter = 0;
    if (crop.frostSensitive) {
      const i0 = dayIndex(s.meta.start, sw.date);
      for (let d = 7; d < sim.days; d++) { const tn = s.TN[i0 + d]; if (tn != null && tn <= 0) frostAfter++; }
    }
    sims.push({ ...sim, frostDays: frostAfter, year: y, sowingDetected: sw.detected, meanT: seasonMeanT(s, sw.date, seasonLength(crop)) });
  }
  const rel = sims.map((x) => x.relYield);
  const sowDoys = sims.filter((x) => x.sowingDetected).map((x) => doy(x.sowing));
  const refYear = 2001;
  const toDate = (d: number) => (Number.isFinite(d) ? fromDoy(refYear, d) : null);
  const n = Math.max(1, sims.length);
  return {
    cropId: crop.id, years: sims,
    medianRel: median(rel), p20Rel: quantile(rel, 0.2), p80Rel: quantile(rel, 0.8),
    pSevere: sims.filter((x) => x.relYield < 0.5).length / n,
    medianHeat: median(sims.map((x) => x.heatDaysFlowering)), pHeat: sims.filter((x) => x.heatDaysFlowering >= 3).length / n,
    pFrost: crop.frostSensitive ? sims.filter((x) => x.frostDays > 0).length / n : 0,
    medianIrrigation: median(sims.map((x) => x.irrigationMm)),
    medianSowing: toDate(median(sowDoys)), p20Sowing: toDate(quantile(sowDoys, 0.2)), p80Sowing: toDate(quantile(sowDoys, 0.8)),
    pNoOnset: sims.filter((x) => !x.sowingDetected).length / n,
    medianRain: median(sims.map((x) => x.rainMm)), medianDry: median(sims.map((x) => x.longestDry)),
    tempOutOfRange: sims.filter((x) => x.meanT != null && (x.meanT < crop.tMeanRange[0] || x.meanT > crop.tMeanRange[1])).length / n,
    meanSeasonT: sims.length ? sims.reduce((a, x) => a + (x.meanT ?? 0), 0) / sims.length : null,
  };
}
