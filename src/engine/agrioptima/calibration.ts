// Field calibration from the farmer's recorded past yields (Farm & history → "Yield t/ha").
//
// Each recorded season is compared with what Field Shift's NASA water-balance replay gives for the SAME crop in the
// SAME year, so a drought year is not held against the field: ratio = your yield ÷ modeled yield that year.
// The log-ratios are pooled into a field productivity factor (soil, management, variety) and, where a crop has its
// own records, a crop factor. Both are shrunk toward 1 (no adjustment) with PRIOR_SEASONS pseudo-seasons, so one
// season moves the estimate a little and several seasons move it a lot. Single ratios are capped at ×/÷ MAX_RATIO.
import type { FarmScenario } from '../../domain/types';
import type { EngineOutput } from '../plan';
import { riskKey } from '../plan';
import { cropName } from '../../data/crops';
import { median } from '../../weather/indicators';

export const PRIOR_SEASONS = 2;
export const MAX_RATIO = 3;
export const FACTOR_BOUNDS: [number, number] = [0.3, 2];

export interface YieldObs { year: number; cropId: string; observed: number; modeled: number; typicalYear: boolean; ratio: number }
export interface YieldCalibration {
  obs: YieldObs[];
  fieldFactor: number;                                   // applies to every crop without its own records
  byCrop: Record<string, { factor: number; n: number }>;
  skipped: { cropId: string; year: number; reason: string }[];
  overridden: string[];                                  // crops with a Resources yield: the farmer's value is used as is
}

const clamp = (x: number, [lo, hi]: [number, number]) => Math.min(hi, Math.max(lo, x));
const capLog = (r: number) => clamp(Math.log(r), [-Math.log(MAX_RATIO), Math.log(MAX_RATIO)]);

export function calibrateYields(sc: FarmScenario, engine: EngineOutput): YieldCalibration {
  const { pack, windows } = engine;
  const obs: YieldObs[] = [], skipped: YieldCalibration['skipped'] = [];
  const overridden = new Set<string>();
  for (const h of sc.history) {
    if (h.yieldTHa == null || h.cropId === 'fallow') continue;
    const c = h.cropId;
    if (sc.priceOverrides[`${c}:yield`] != null) { overridden.add(c); continue; }
    if (!(h.yieldTHa > 0)) { skipped.push({ cropId: c, year: h.year, reason: 'zero or failed harvest — the NASA replay already models failed seasons' }); continue; }
    const w = windows.find((x) => x.id === h.seasonId) ?? windows.find((x) => x.crops.includes(c));
    const r = w ? engine.risks[riskKey(pack, w, c)] : undefined;
    const att = pack.economics[c]?.attainableYieldTHa;
    if (!r || att == null) { skipped.push({ cropId: c, year: h.year, reason: `${cropName(c)} has no NASA replay in this region` }); continue; }
    const yr = r.years.find((y) => y.year === h.year);
    const rel = yr ? yr.relYield : median(r.years.map((y) => y.relYield));
    const modeled = att * rel;
    if (!(modeled > 0.05)) { skipped.push({ cropId: c, year: h.year, reason: 'the replay models a near-total failure that year, so the ratio is not meaningful' }); continue; }
    obs.push({ year: h.year, cropId: c, observed: h.yieldTHa, modeled, typicalYear: !yr, ratio: h.yieldTHa / modeled });
  }
  const logs = obs.map((o) => capLog(o.ratio));
  const logField = logs.reduce((a, b) => a + b, 0) / (obs.length + PRIOR_SEASONS);
  const byCrop: YieldCalibration['byCrop'] = {};
  for (const c of new Set(obs.map((o) => o.cropId))) {
    const l = obs.filter((o) => o.cropId === c).map((o) => capLog(o.ratio));
    byCrop[c] = { factor: clamp(Math.exp((l.reduce((a, b) => a + b, 0) + PRIOR_SEASONS * logField) / (l.length + PRIOR_SEASONS)), FACTOR_BOUNDS), n: l.length };
  }
  return { obs, fieldFactor: clamp(Math.exp(logField), FACTOR_BOUNDS), byCrop, skipped, overridden: [...overridden] };
}

/** Productivity factor for a Field Shift crop id (1 when the farmer set the crop's yield explicitly in Resources). */
export function factorFor(cal: YieldCalibration, cropId: string): number {
  if (cal.overridden.includes(cropId)) return 1;
  return cal.byCrop[cropId]?.factor ?? cal.fieldFactor;
}
