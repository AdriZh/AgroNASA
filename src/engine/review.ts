// Past-season review: descriptive, reason-coded statements. Never a causal diagnosis (Spec 01 §4).
import type { CropSeason, DailySeries, FarmScenario, SoilProfile } from '../domain/types';
import { CROPS } from '../data/crops';
import { addDays, dayIndex, fmtDayMonth } from '../domain/dates';
import { normalizeApplication } from '../domain/units';
import { completeYears, median, percentileRank, windowStats } from '../weather/indicators';
import { simulateSeason, seasonLength } from '../weather/waterBalance';
import { sowingFor, type SowingWindow } from './replay';

export interface ReviewStatement { kind: 'weather' | 'model' | 'fertilizer' | 'limit' | 'check'; tone: 'warn' | 'info' | 'ok'; text: string; refs: string[] }
export interface SeasonReview {
  season: CropSeason; start: string; end: string; datesEstimated: boolean;
  rain: number | null; rainMedian: number; rainPct: number;
  longestDry: number | null; dryRun: { start: string; days: number } | null;
  heatDays: number; relYield: number | null; gwet: number | null; gwetMedian: number | null;
  statements: ReviewStatement[];
}

function longestDryRun(s: DailySeries, start: string, end: string) {
  const a = dayIndex(s.meta.start, start), b = dayIndex(s.meta.start, end);
  let run = 0, best = 0, bestStart = a;
  for (let i = a; i <= b && i < s.n; i++) {
    if ((s.P[i] ?? 0) < 1) { run++; if (run > best) { best = run; bestStart = i - run + 1; } } else run = 0;
  }
  return best ? { start: addDays(s.meta.start, bestStart), days: best } : null;
}

export function reviewSeason(sc: FarmScenario, h: CropSeason, s: DailySeries, w: SowingWindow, soil: SoilProfile): SeasonReview | null {
  const crop = CROPS[h.cropId];
  if (!crop) return null;
  let start = h.plantedOn, end = h.harvestedOn, est = false;
  if (!start) {
    const sw = sowingFor(s, w, crop, h.year);
    if (!sw) return null;
    start = sw.date; est = true;
  }
  if (!end) { end = addDays(start, seasonLength(crop) - 1); est = true; }
  if (dayIndex(s.meta.start, end) >= s.n || dayIndex(s.meta.start, start) < 0) return null;

  const ws = windowStats(s, start, end, { hotThr: crop.heatThresholdC });
  // the same calendar window in every complete year → climatological comparison
  const mdS = start.slice(5), mdE = end.slice(5);
  const comp = completeYears(s).map((y) => {
    const yE = mdE < mdS ? y + 1 : y;
    return windowStats(s, `${y}-${mdS}`, `${yE}-${mdE}`, { hotThr: crop.heatThresholdC });
  }).filter((x) => x.rainMm != null);
  const rains = comp.map((x) => x.rainMm!);
  const gws = comp.map((x) => x.meanGwetRoot ?? NaN);
  const rainPct = ws.rainMm != null ? percentileRank(rains, ws.rainMm) : NaN;
  const dry = longestDryRun(s, start, end);
  const sim = crop.id === 'fallow' ? null : simulateSeason(s, crop, start, soil.awcMmPerM, { irrigate: false });
  const flowerS = addDays(start, crop.stages[0] + crop.stages[1] - 7), flowerE = addDays(start, crop.stages[0] + crop.stages[1] + 14);
  const heat = windowStats(s, flowerS, flowerE, { hotThr: crop.heatThresholdC }).hotDays ?? 0;

  const st: ReviewStatement[] = [];
  const y0 = completeYears(s)[0], y1 = completeYears(s).slice(-1)[0];
  if (ws.rainMm != null) {
    if (rainPct <= 0.2) st.push({ kind: 'weather', tone: 'warn', text: `Regional rainfall in this period (${ws.rainMm.toFixed(0)} mm) was lower than in ${Math.round((1 - rainPct) * 100)}% of ${y0}–${y1} seasons (median ${median(rains).toFixed(0)} mm). Moisture stress may have contributed.`, refs: ['D1', 'R17'] });
    else if (rainPct >= 0.85) st.push({ kind: 'weather', tone: 'warn', text: `Rainfall (${ws.rainMm.toFixed(0)} mm) was ${rainPct >= 0.99 ? `above every ${y0}–${y1} season in the record` : `wetter than ${Math.round(rainPct * 100)}% of ${y0}–${y1} seasons`} (median ${median(rains).toFixed(0)} mm) — waterlogging, nutrient leaching or disease pressure are possible.`, refs: ['D1', 'R17'] });
    else st.push({ kind: 'weather', tone: 'ok', text: `Rainfall (${ws.rainMm.toFixed(0)} mm) was within the usual range (median ${median(rains).toFixed(0)} mm).`, refs: ['D1'] });
  }
  if (dry && dry.days >= 10) st.push({ kind: 'weather', tone: 'warn', text: `A ${dry.days}-day run with <1 mm/day occurred from ${fmtDayMonth(dry.start)} to ${fmtDayMonth(addDays(dry.start, dry.days - 1))}.`, refs: ['D1'] });
  if (heat >= 3) st.push({ kind: 'weather', tone: 'warn', text: `${heat} days reached Tmax ≥ ${crop.heatThresholdC} °C around the estimated flowering period (${fmtDayMonth(flowerS)}–${fmtDayMonth(flowerE)}). Contribution is uncertain.`, refs: ['R30', 'R17'] });
  if (sim && sim.complete) {
    const pct = Math.round(sim.relYield * 100);
    st.push({ kind: 'model', tone: sim.relYield < 0.6 ? 'warn' : 'info', text: `FAO-56 water-balance replay: water-limited yield ≈ ${pct}% of attainable (${sim.stressDays} water-stress days). Modeled, not measured.`, refs: ['R8', 'R18'] });
  }
  const gw = ws.meanGwetRoot, gwm = median(gws.filter(Number.isFinite));
  if (gw != null && Number.isFinite(gwm) && Math.abs(gw - gwm) > 0.04) st.push({ kind: 'weather', tone: gw < gwm ? 'warn' : 'info', text: `NASA MERRA-2 root-zone soil wetness averaged ${gw.toFixed(2)} vs a typical ${gwm.toFixed(2)} for this window (${gw < gwm ? 'drier' : 'wetter'} than usual).`, refs: ['R17'] });
  if (!st.some((x) => x.tone === 'warn')) st.push({ kind: 'weather', tone: 'ok', text: 'No clear weather explanation was found in the regional record.', refs: ['D1'] });

  const apps = sc.fertilizer.filter((f) => f.cropSeasonId === h.id);
  if (!apps.length) st.push({ kind: 'fertilizer', tone: 'info', text: 'No fertilizer record for this season — this is not evidence that none was applied.', refs: ['input:fertilizer'] });
  else {
    const ns = apps.map(normalizeApplication);
    const nTot = ns.reduce((a, x) => (x.nKgHa == null ? a : (a ?? 0) + x.nKgHa), null as number | null);
    const unknown = ns.some((x) => x.nKgHa == null);
    st.push({ kind: 'fertilizer', tone: 'info', text: `${apps.length} application(s) recorded${nTot != null ? `: ≈${nTot.toFixed(0)} kg N/ha applied by label arithmetic` : ''}${unknown ? ' (some amounts unknown)' : ''}. This is not plant-available N or present soil status.`, refs: ['R7'] });
  }
  if (h.outcome === 'poor' || h.outcome === 'failed') st.push({ kind: 'check', tone: 'info', text: 'Other possible causes to check locally: pests and diseases, Striga/weeds, seed quality, sowing date, soil fertility and crop establishment.', refs: ['R7'] });
  st.push({ kind: 'limit', tone: 'info', text: `${est ? 'Dates estimated from NASA rain-onset/temperature rules; ' : ''}field water status and crop-stage dates were not measured. Grid cell ≈ 50 km, not your field.`, refs: ['R6'] });

  return {
    season: h, start, end, datesEstimated: est, rain: ws.rainMm, rainMedian: median(rains), rainPct, longestDry: ws.longestDry, dryRun: dry,
    heatDays: heat, relYield: sim?.complete ? sim.relYield : null, gwet: gw, gwetMedian: Number.isFinite(gwm) ? gwm : null, statements: st,
  };
}
