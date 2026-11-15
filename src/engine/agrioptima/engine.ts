// AgriOptima layer: multi-season soil-N state transition + multi-objective utility, on top of Field Shift.
//
// Division of labour (stated in the UI and Methods):
//  * Yield LEVEL per crop  — Field Shift's NASA POWER water-balance replay (attainable × median water-limited share).
//  * RELATIVE effects      — INRAE trial surrogates: soil mineral N, pre-crop, intercropping (LER), N uptake.
//  * Soil-N carry-over, emissions, pre-crop & monoculture factors — explicit priors in params.ts.
//  * Hard rotation rules   — Field Shift's own (return interval, hard disease successions, monoculture G-R6).
//
// The rotation tree is expanded season by season with one batched model call per season; blocked prefixes are
// pruned, so the search only evaluates rotations Field Shift would allow.
import type { DailySeries, FarmScenario, RegionPack, SoilProfile } from '../../domain/types';
import type { EngineOutput } from '../plan';
import { costConverter, HARD_DISEASE, historyOrder, riskKey } from '../plan';
import type { SowingWindow } from '../replay';
import { costLine } from '../budget';
import { CROPS, cropFor, cropName } from '../../data/crops';
import { fxPerUsd } from '../../data/countries';
import { predict, type ModelBundle } from './model';
import { CLIMATE_FEATURES, seasonClimate, type ClimateFeatures } from './climate';
import * as P from './params';
import { calibrateYields, factorFor, type YieldCalibration } from './calibration';

export interface AgriOption {
  id: string; label: string; crops: string[]; family: P.Family; isIntercrop: boolean;
  window: number;              // index into engine.windows
  pricePerT: number | null;    // scenario currency per tonne (share-weighted for mixtures)
  fixedCostHa: number;         // cash inputs except synthetic N, scenario currency per ha
  nReq: number;
  climate: ClimateFeatures | null;
  sowing: string | null;       // MM-DD used for the climate window
  winter: boolean;
  calib: number;               // Field Shift yield level ÷ INRAE reference prediction
  calibrated: boolean;
  shares: Record<string, number>;
  ndfa: number; nhi: number;
  extrapolated: string[];      // features outside the INRAE training range
}

export interface AgriContext {
  bundle: ModelBundle; sc: FarmScenario; pack: RegionPack; windows: SowingWindow[];
  options: AgriOption[];
  uncovered: { cropId: string; reason: string }[];
  nPricePerKg: number; nPriceSource: string;
  currency: string; toLocalPerUsd: number;
  history: string[];           // farmer history, oldest first (Field Shift crop ids)
  base: Float64Array;          // static part of the feature vector (soil, irrigation)
  /** Sowing windows with at least one modeled crop; the optimizer alternates through these only. */
  modeledWindows: number[];
  irrigationOn: boolean;
  /** Productivity factors from the farmer's recorded yields (calibration.ts). */
  yieldCal: YieldCalibration;
}

export interface Weights { delta: number; wSoilUsd: number; wCarbonUsdPerT: number }
export const DEFAULT_WEIGHTS: Weights = { delta: 0.85, wSoilUsd: 1, wCarbonUsdPerT: 50 };

export interface SeasonRow {
  step: number; year: number; seasonLabel: string; option: string; label: string; family: P.Family;
  yieldTHa: number; revenue: number; costs: number; nFert: number; nFixed: number;
  soilNStart: number; soilNEnd: number; somEnd: number; deltaNEq: number; co2e: number; factor: number;
}

const FI = (b: ModelBundle) => Object.fromEntries(b.feature_columns.map((c, i) => [c, i])) as Record<string, number>;
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const familyOfCrop = (id: string): P.Family => {
  if (id === 'fallow') return 'fallow';
  const g = CROPS[id]?.group;
  return g === 'cereal' ? 'cereal' : g === 'legume' ? 'legume' : 'other';
};
/** prev_cereal, prev_legume, prev_oilseed, prev_grass flags; NaN when the previous crop is unknown. */
function prevFlags(crops: string[] | null): number[] {
  if (!crops) return [NaN, NaN, NaN, NaN];
  const g = new Set(crops.map((c) => CROPS[c]?.group));
  return [Number(g.has('cereal')), Number(g.has('legume')), Number(g.has('oilseed')), 0];
}
const N_ITEM = /urea|\bAN\b|ammonium nitrate|nitrate|\bCAN\b|top-dress/i;

// ---------------------------------------------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------------------------------------------

export function buildContext(bundle: ModelBundle, sc: FarmScenario, engine: EngineOutput, series: DailySeries, soil: SoilProfile): AgriContext {
  const { pack, windows } = engine;
  const fi = FI(bundle);
  const toLocalPerUsd = fxPerUsd(sc.currency) ?? 1;
  const convert = costConverter(pack, sc);
  const irrigationOn = sc.irrigation === 'yes';

  // static features: soil (SoilGrids or farmer) and irrigation; AWC is left missing (different definition in trials)
  const base = new Float64Array(bundle.feature_columns.length).fill(NaN);
  base[fi.soil_pH] = soil.ph ?? NaN;
  base[fi.soil_clay] = soil.clayPct != null ? soil.clayPct / 100 : NaN;
  base[fi.soil_sand] = soil.sandPct != null ? soil.sandPct / 100 : NaN;
  base[fi.irrigation_amount] = 0;

  // cash cost per ha split into seed / synthetic N / other, from the regional template (scenario currency)
  let nPricePerKg: number | null = null, nPriceSource = '';
  const costOf = (c: string) => {
    let seed = 0, other = 0;
    for (const it of pack.economics[c]?.items ?? []) {
      if (!it.cash) continue;
      const conv = convert(it);
      const line = costLine(conv, 1, c, 1, '2001-01-01', sc.priceOverrides[`${c}:${it.key}`]);
      if (it.category === 'fertilizer' && N_ITEM.test(it.label)) {
        const unit = line.unitPrice;
        if (nPricePerKg == null && unit != null && it.unit === 'kg') {
          nPricePerKg = unit / (/urea/i.test(it.label) ? 0.46 : 0.34);
          nPriceSource = `${cropName(c)} template line “${it.label}”`;
        }
        continue; // replaced by the modeled N rate
      }
      if (it.category === 'seed') seed += line.total ?? 0; else other += line.total ?? 0;
    }
    return { seed, other };
  };

  const windowOf = (c: string) => Math.max(0, windows.findIndex((w) => w.crops.includes(c)));
  const climateOf = (c: string, w: number) => {
    const win = windows[w];
    const r = engine.risks[riskKey(pack, win, c)];
    const sow = r?.medianSowing?.slice(5) ?? (win.earliest !== 'auto' ? win.earliest : '06-15');
    const days = cropFor(pack, c).stages.reduce((a, b) => a + b, 0);
    const month = Number(sow.slice(0, 2));
    const autumn = series.meta.lat >= 0 ? month >= 9 : month >= 3 && month <= 6;
    return { climate: seasonClimate(series, sow, days), sowing: sow, winter: autumn && days >= 150, risk: r };
  };
  // Field productivity from the farmer's recorded past yields (1 when none are recorded).
  const yieldCal = calibrateYields(sc, engine);
  const fsYield = (c: string, w: number) => {
    const r = engine.risks[riskKey(pack, windows[w], c)];
    const att = sc.priceOverrides[`${c}:yield`] ?? pack.economics[c]?.attainableYieldTHa;
    return r && att != null && Number.isFinite(r.medianRel) ? att * r.medianRel * factorFor(yieldCal, c) : null;
  };

  const coeff = bundle.coefficients;
  const shareTable = (a: string, b: string) => {
    const t = coeff.intercrop_share[`${a}_${b}`] ?? coeff.intercrop_share[`${b}_${a}`] ?? { [a]: 0.5, [b]: 0.5 };
    const tot = (t[a] ?? 0.5) + (t[b] ?? 0.5);
    return { [a]: (t[a] ?? 0.5) / tot, [b]: (t[b] ?? 0.5) / tot };
  };
  const ndfaOf = (shares: Record<string, number>) => sum(Object.entries(shares).map(([s, w]) => (P.LEGUME_SPECIES.has(s) ? w * (coeff.ndfa_share[s] ?? 0.75) : 0)));
  const nhiOf = (shares: Record<string, number>) => sum(Object.entries(shares).map(([s, w]) => w * (coeff.n_harvest_index[s] ?? 0.75)));

  const options: AgriOption[] = [];
  const uncovered: AgriContext['uncovered'] = [];
  const unavailable = new Set(sc.unavailableCrops);
  const sellable = (c: string) => !sc.marketCrops.length || sc.marketCrops.includes(c);
  const costs: Record<string, { seed: number; other: number }> = {};
  const yieldLevel: Record<string, number> = {};

  for (const c of pack.crops) {
    if (c === 'fallow') continue;
    if (!CROPS[c]) continue;
    if (unavailable.has(c) || !sellable(c)) { uncovered.push({ cropId: c, reason: 'not in your allowed crops' }); continue; }
    if (cropFor(pack, c).irrigationRequired && !irrigationOn) { uncovered.push({ cropId: c, reason: 'needs irrigation' }); continue; }
    const sp = P.SPECIES_OF[c];
    if (!sp) { uncovered.push({ cropId: c, reason: 'not in the INRAE cereal–legume trials' }); continue; }
    const w = windowOf(c);
    const cl = climateOf(c, w);
    costs[c] = costOf(c);
    const shares = { [sp]: 1 };
    const level = fsYield(c, w) ?? (pack.economics[c]?.attainableYieldTHa ?? 2) * factorFor(yieldCal, c);
    yieldLevel[c] = level;
    options.push({
      id: c, label: cropName(c), crops: [c], family: familyOfCrop(c), isIntercrop: false, window: w,
      pricePerT: engine.prices[c]?.perT ?? null, fixedCostHa: costs[c].seed + costs[c].other,
      nReq: P.LEGUME_SPECIES.has(sp) ? 0 : (P.N_PER_T_GRAIN[c] ?? 25) * level,
      climate: cl.climate, sowing: cl.sowing, winter: cl.winter, calib: 1, calibrated: false,
      shares, ndfa: ndfaOf(shares), nhi: nhiOf(shares), extrapolated: [],
    });
  }
  const sole = new Map(options.map((o) => [o.id, o]));
  for (const [a, b] of P.INTERCROPS) {
    const oa = sole.get(a), ob = sole.get(b);
    if (!oa || !ob || !windows.some((w) => w.crops.includes(a) && w.crops.includes(b))) continue;
    const spA = P.SPECIES_OF[a], spB = P.SPECIES_OF[b];
    const shares = shareTable(spA, spB);
    const pa = oa.pricePerT, pb = ob.pricePerT;
    options.push({
      id: P.intercropId(a, b), label: `${cropName(a)} + ${cropName(b)}`, crops: [a, b], family: 'intercrop', isIntercrop: true,
      window: oa.window, pricePerT: pa != null && pb != null ? shares[spA] * pa + shares[spB] * pb : null,
      fixedCostHa: P.INTERCROP_SEED_SHARE * (costs[a].seed + costs[b].seed) + Math.max(costs[a].other, costs[b].other) + P.INTERCROP_SEPARATION_USD * toLocalPerUsd,
      nReq: P.INTERCROP_CEREAL_N_SHARE * oa.nReq, climate: oa.climate, sowing: oa.sowing, winter: oa.winter, calib: 1, calibrated: false,
      shares, ndfa: ndfaOf(shares), nhi: nhiOf(shares), extrapolated: [],
    });
  }
  if (pack.crops.includes('fallow')) {
    const f = costOf('fallow');
    options.push({
      id: 'fallow', label: cropName('fallow'), crops: ['fallow'], family: 'fallow', isIntercrop: false, window: windowOf('fallow'),
      pricePerT: null, fixedCostHa: f.seed + f.other, nReq: 0, climate: null, sowing: null, winter: false, calib: 1, calibrated: true,
      shares: {}, ndfa: 0, nhi: 0, extrapolated: [],
    });
  }
  if (nPricePerKg == null) { nPricePerKg = P.DEFAULT_N_PRICE_USD * toLocalPerUsd; nPriceSource = `default ${P.DEFAULT_N_PRICE_USD} USD/kg N`; }

  const ctx: AgriContext = {
    bundle, sc, pack, windows, options, uncovered, nPricePerKg, nPriceSource, currency: sc.currency, toLocalPerUsd,
    history: historyOrder(sc, pack).map((h) => h.cropId), base, irrigationOn, modeledWindows: [], yieldCal,
  };

  // Calibration: Field Shift's typical yield ÷ INRAE prediction at a reference state (50 kg soil N, cereal pre-crop).
  const modeled = ctx.options.filter((o) => o.family !== 'fallow');
  const ref = modeled.map((o) => featureRow(ctx, o, P.DEFAULT_SOIL_N, Math.max(0, o.nReq - P.DEFAULT_SOIL_N), prevFlags(['wheat'])));
  const refY = predict(bundle, ref).yieldTHa;
  const kOf = new Map<string, number | null>();
  modeled.forEach((o, i) => {
    if (o.isIntercrop) return;
    const fy = fsYield(o.id, o.window);
    kOf.set(o.id, fy != null && refY[i] > 0 ? fy / refY[i] : null);
  });
  modeled.forEach((o) => {
    const ks = o.crops.map((c) => kOf.get(c) ?? null);
    if (ks.every((k): k is number => k != null)) {
      o.calib = o.isIntercrop ? sum(o.crops.map((c, j) => (o.shares[P.SPECIES_OF[c]] ?? 0.5) * ks[j]!)) : ks[0]!;
      o.calibrated = true;
    } else {
      // no Field Shift yield level: trial-level yields, still scaled by the field's productivity factor
      o.calib = sum(o.crops.map((c) => (o.shares[P.SPECIES_OF[c]] ?? 1 / o.crops.length) * factorFor(yieldCal, c)));
    }
    o.extrapolated = extrapolatedFeatures(bundle, o.climate);
  });
  ctx.modeledWindows = windows.map((_, i) => i).filter((i) => modeled.some((o) => o.window === i));
  return ctx;
}

/** Seasons simulated per calendar year: 2 only in double-season packs where both seasons have modeled crops. */
export const seasonsPerYear = (ctx: AgriContext) => (ctx.pack.mode === 'double' && ctx.modeledWindows.length > 1 ? 2 : 1);

function extrapolatedFeatures(b: ModelBundle, c: ClimateFeatures | null): string[] {
  if (!c) return [];
  const out: string[] = [];
  for (const k of ['gs_mean_temp_c', 'gs_precip_mm', 'gs_pet_mm', 'gs_gdd'] as const) {
    const r = b.training_ranges[k];
    const v = c[k];
    if (!r || !Number.isFinite(v)) continue;
    const pad = 0.1 * (r[1] - r[0]);
    if (v < r[0] - pad || v > r[1] + pad) out.push(k);
  }
  return out;
}

function featureRow(ctx: AgriContext, o: AgriOption, soilN: number, nApp: number, prev: number[]): Float64Array {
  const fi = FI(ctx.bundle);
  const x = Float64Array.from(ctx.base);
  x[fi.soil_n_initial] = soilN;
  x[fi.N_amount] = nApp;
  x[fi.is_intercrop] = o.isIntercrop ? 1 : 0;
  x[fi.pattern_within_row] = o.isIntercrop ? 1 : 0;
  x[fi.pattern_alternate_row] = 0;
  x[fi.winter_season] = o.winter ? 1 : 0;
  const med = ctx.bundle.feature_medians;
  for (const k of CLIMATE_FEATURES) { const v = o.climate?.[k]; x[fi[k]] = v != null && Number.isFinite(v) ? v : med[k] ?? NaN; }
  for (const s of ctx.bundle.species_columns) x[fi[s]] = 0;
  for (const s of Object.keys(o.shares)) x[fi[`sp_${s}`]] = 1;
  ['prev_cereal', 'prev_legume', 'prev_oilseed', 'prev_grass'].forEach((k, j) => { x[fi[k]] = prev[j]; });
  return x;
}

// ---------------------------------------------------------------------------------------------------------------
// One batched season step: many (state, option) pairs → outcomes and next states
// ---------------------------------------------------------------------------------------------------------------

interface Pair { soilN: number; som: number; prevOpt: number; prevCrops: string[] | null; opt: number }
interface Outcome { soilNStart: number; yieldTHa: number; revenue: number; costs: number; nFert: number; nFixed: number; soilNEnd: number; somEnd: number; deltaNEq: number; co2e: number; factor: number }

function step(ctx: AgriContext, pairs: Pair[]): Outcome[] {
  const rows: Float64Array[] = [], rowOf = new Int32Array(pairs.length).fill(-1);
  pairs.forEach((p, i) => {
    const o = ctx.options[p.opt];
    if (o.family === 'fallow') return;
    rowOf[i] = rows.length;
    rows.push(featureRow(ctx, o, p.soilN, Math.max(0, o.nReq - p.soilN), prevFlags(p.prevCrops)));
  });
  const pr = rows.length ? predict(ctx.bundle, rows) : null;
  return pairs.map((p, i) => {
    const o = ctx.options[p.opt];
    const nApp = Math.max(0, o.nReq - p.soilN);
    const som = Math.min(P.SOM_BOUNDS[1], Math.max(P.SOM_BOUNDS[0], p.som + P.SOM_DELTA[o.family]));
    const costs = o.fixedCostHa + ctx.nPricePerKg * nApp;
    const co2e = P.EMISSIONS_PER_KG_N * nApp + P.FIELD_OPS_EMISSIONS[o.family];
    if (o.family === 'fallow') {
      const end = clampN(P.N_CARRYOVER * p.soilN + P.BASE_MINERALIZATION * som);
      return { soilNStart: p.soilN, yieldTHa: 0, revenue: 0, costs, nFert: 0, nFixed: 0, soilNEnd: end, somEnd: som, deltaNEq: end - p.soilN + P.SOM_INDEX_TO_KG_N * (som - p.som), co2e, factor: 1 };
    }
    const prevFam: P.Family | null = p.prevCrops ? (p.prevOpt >= 0 ? ctx.options[p.prevOpt].family : familyOfCrop(p.prevCrops[0])) : null;
    const pre = prevFam ? P.PRECROP_YIELD_FACTOR[prevFam]?.[o.family] ?? 1 : 1;
    const mono = p.prevOpt === p.opt ? P.MONOCULTURE_FACTOR : 1;
    const somF = 1 - P.SOM_YIELD_SENSITIVITY * Math.max(0, 1 - p.som);
    const factor = pre * mono * somF;
    const yld = Math.max(0.05, pr!.yieldTHa[rowOf[i]] * o.calib) * factor;
    const upt = Math.max(1, pr!.nUptake[rowOf[i]] * o.calib) * factor;
    const fixed = upt * o.ndfa;
    const exported = upt * o.nhi;
    const residue = upt - exported + P.BELOWGROUND_N_FACTOR * upt;
    const surplus = Math.max(0, p.soilN + nApp - (upt - fixed));
    const end = clampN(P.N_CARRYOVER * surplus + P.RESIDUE_N_AVAILABLE[o.family] * residue + P.BASE_MINERALIZATION * som);
    const revenue = o.pricePerT != null ? yld * o.pricePerT : NaN;
    return { soilNStart: p.soilN, yieldTHa: yld, revenue, costs, nFert: nApp, nFixed: fixed, soilNEnd: end, somEnd: som, deltaNEq: end - p.soilN + P.SOM_INDEX_TO_KG_N * (som - p.som), co2e, factor };
  });
}
const clampN = (x: number) => Math.min(P.SOIL_N_BOUNDS[1], Math.max(P.SOIL_N_BOUNDS[0], x));

// ---------------------------------------------------------------------------------------------------------------
// Field Shift rotation rules applied to option sequences
// ---------------------------------------------------------------------------------------------------------------

/** Reason a succession is blocked by Field Shift's hard rules, or null. `before` = earlier seasons, oldest first. */
export function blockedBy(ctx: AgriContext, before: string[][], next: string[]): string | null {
  const prev = before[before.length - 1];
  if (prev && prev.join('+') === next.join('+') && next[0] !== 'fallow') {
    const c = cropFor(ctx.pack, next[0]);
    if (next.length > 1 || !(ctx.pack.continuousCrops?.includes(c.id))) return `${next.map(cropName).join(' + ')} twice in a row (G-R6)`;
  }
  for (const id of next) {
    if (id === 'fallow') continue;
    const c = cropFor(ctx.pack, id);
    for (let j = 1; j <= c.minReturnSeasons; j++) {
      const s = before[before.length - j];
      if (s?.includes(id)) return `${c.name} needs a ${c.minReturnSeasons}-season break (G-R1)`;
    }
    if (prev) {
      for (const q of prev) {
        if (q === 'fallow' || q === id) continue;
        const shared = c.diseaseGroups.filter((g) => HARD_DISEASE.has(g) && cropFor(ctx.pack, q).diseaseGroups.includes(g));
        if (shared.length) return `${cropName(q)} → ${c.name} share ${shared[0].replace('-', ' ')} (G-R2)`;
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------------------------------------------------------
// Multi-season optimizer
// ---------------------------------------------------------------------------------------------------------------

export interface Simulation {
  ctx: AgriContext; seasons: number; seasonsPerYear: number;
  paths: Int32Array[];                 // per sequence: option index per season
  out: Outcome[][];                    // per sequence: outcome per season
  evaluatedRows: number; truncated: boolean;
}

export interface Initial { soilN: number; intercrops?: boolean }

/** Expand every rule-compliant sequence of `seasons` seasons (pruning blocked prefixes) and simulate it. */
export function simulateAll(ctx: AgriContext, seasons: number, init: Initial): Simulation {
  const perYear = seasonsPerYear(ctx);
  const double = perYear === 2;
  const hist = ctx.history.map((c) => [c]);
  const lastHist = ctx.history[ctx.history.length - 1];
  const lastOpt = ctx.options.findIndex((o) => o.id === lastHist);
  interface Node { parent: number; opt: number; soilN: number; som: number; out: Outcome | null }
  let level: Node[] = [{ parent: -1, opt: lastOpt, soilN: init.soilN, som: 1, out: null }];
  const levels: Node[][] = [];
  const pathOf = (lv: number, idx: number): number[] => {
    const p: number[] = [];
    for (let l = lv; l >= 0; l--) { const n = levels[l][idx]; p.unshift(n.opt); idx = n.parent; }
    return p;
  };
  let rows = 0, truncated = false;
  for (let t = 0; t < seasons; t++) {
    const allowed = ctx.options.map((o, i) => ({ o, i }))
      .filter(({ o }) => (init.intercrops !== false || !o.isIntercrop) && (o.family === 'fallow' || !double ? true : o.window === ctx.modeledWindows[t % 2]))
      .map(({ i }) => i);
    const pairs: Pair[] = [], parents: number[] = [];
    level.forEach((n, pi) => {
      const path = t === 0 ? [] : pathOf(t - 1, pi);
      const before = [...hist, ...path.map((k) => ctx.options[k].crops)];
      for (const k of allowed) {
        if (blockedBy(ctx, before, ctx.options[k].crops)) continue;
        pairs.push({ soilN: n.soilN, som: n.som, prevOpt: n.opt, prevCrops: before.length ? before[before.length - 1] : null, opt: k });
        parents.push(pi);
      }
    });
    if (t > 0 && rows + pairs.length > P.MAX_TREE_ROWS) { truncated = true; break; }
    rows += pairs.length;
    const outs = step(ctx, pairs);
    level = pairs.map((p, i) => ({ parent: parents[i], opt: p.opt, soilN: outs[i].soilNEnd, som: outs[i].somEnd, out: outs[i] }));
    levels.push(level);
  }
  const H = levels.length;
  const last = levels[H - 1] ?? [];
  const paths: Int32Array[] = [], out: Outcome[][] = [];
  last.forEach((_, i) => {
    const p = pathOf(H - 1, i);
    paths.push(Int32Array.from(p));
    const o: Outcome[] = [];
    let idx = i;
    for (let l = H - 1; l >= 0; l--) { o.unshift(levels[l][idx].out!); idx = levels[l][idx].parent; }
    out.push(o);
  });
  return { ctx, seasons: H, seasonsPerYear: perYear, paths, out, evaluatedRows: rows, truncated };
}

/** Simulate one given sequence of option ids (no rule pruning) — used for Compare plans and the usual-plan reference. */
export function simulateSequence(ctx: AgriContext, ids: string[], init: Initial): { rows: SeasonRow[]; blocked: string | null } | null {
  const idx = ids.map((id) => ctx.options.findIndex((o) => o.id === id));
  if (idx.some((i) => i < 0)) return null;
  const hist = ctx.history.map((c) => [c]);
  let soilN = init.soilN, som = 1, prevOpt = ctx.options.findIndex((o) => o.id === ctx.history[ctx.history.length - 1]);
  const before = [...hist];
  const outs: Outcome[] = [];
  let blocked: string | null = null;
  for (const k of idx) {
    blocked ??= blockedBy(ctx, before, ctx.options[k].crops);
    const [o] = step(ctx, [{ soilN, som, prevOpt, prevCrops: before.length ? before[before.length - 1] : null, opt: k }]);
    outs.push(o);
    soilN = o.soilNEnd; som = o.somEnd; prevOpt = k; before.push(ctx.options[k].crops);
  }
  return { rows: outs.map((o, t) => toRow(ctx, idx[t], o, t, seasonsPerYear(ctx))), blocked };
}

function toRow(ctx: AgriContext, opt: number, o: Outcome, t: number, perYear: number): SeasonRow {
  const op = ctx.options[opt];
  return {
    step: t, year: ctx.sc.firstSeasonYear + Math.floor(t / perYear), seasonLabel: ctx.windows[op.window]?.label ?? '',
    option: op.id, label: op.label, family: op.family,
    yieldTHa: o.yieldTHa, revenue: o.revenue, costs: o.costs, nFert: o.nFert, nFixed: o.nFixed,
    soilNStart: o.soilNStart, soilNEnd: o.soilNEnd, somEnd: o.somEnd, deltaNEq: o.deltaNEq, co2e: o.co2e, factor: o.factor,
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Utility & ranking (cheap: re-run on every slider move)
// ---------------------------------------------------------------------------------------------------------------

export interface RankedPlan {
  options: string[]; labels: string[]; utility: number; pareto: boolean;
  totals: { net: number; nFert: number; co2e: number; soilNChange: number; nFixed: number };
  rows: SeasonRow[];
}

function weightsLocal(ctx: AgriContext, w: Weights) {
  return { soil: w.wSoilUsd * ctx.toLocalPerUsd, carbonPerKg: (w.wCarbonUsdPerT / 1000) * ctx.toLocalPerUsd };
}

/** Utility of season outcomes: Σ δ^year [net cash + w_soil·ΔN_eq − w_carbon·CO2e]. NaN revenue (no price) → −∞. */
export function utilityOf(ctx: AgriContext, outs: Outcome[] | SeasonRow[], perYear: number, w: Weights): number {
  const l = weightsLocal(ctx, w);
  let u = 0;
  outs.forEach((o, t) => {
    const net = o.revenue - o.costs;
    u += w.delta ** Math.floor(t / perYear) * (net + l.soil * o.deltaNEq - l.carbonPerKg * o.co2e);
  });
  return Number.isFinite(u) ? u : -Infinity;
}

export function rank(sim: Simulation, w: Weights, topK = 5): { plans: RankedPlan[]; considered: number } {
  const { ctx, paths, out, seasonsPerYear } = sim;
  const u = out.map((o) => utilityOf(ctx, o, seasonsPerYear, w));
  const obj = out.map((o) => [sum(o.map((x) => x.revenue - x.costs)), sum(o.map((x) => x.deltaNEq)), -sum(o.map((x) => x.co2e))]);
  const order = u.map((_, i) => i).filter((i) => Number.isFinite(u[i])).sort((a, b) => u[b] - u[a] || (paths[a].join() < paths[b].join() ? -1 : 1));
  const isPareto = (i: number) => !obj.some((q, j) => j !== i && Number.isFinite(u[j]) && q.every((v, k) => v >= obj[i][k]) && q.some((v, k) => v > obj[i][k]));
  const plans = order.slice(0, topK).map((i) => {
    const rows = out[i].map((o, t) => toRow(ctx, paths[i][t], o, t, seasonsPerYear));
    return planOf(rows, u[i], isPareto(i));
  });
  return { plans, considered: order.length };
}

export function planOf(rows: SeasonRow[], utility: number, pareto: boolean): RankedPlan {
  return {
    options: rows.map((r) => r.option), labels: rows.map((r) => r.label), utility, pareto,
    totals: {
      net: sum(rows.map((r) => r.revenue - r.costs)), nFert: sum(rows.map((r) => r.nFert)), co2e: sum(rows.map((r) => r.co2e)),
      soilNChange: rows.length ? rows[rows.length - 1].soilNEnd - rows[0].soilNStart : 0, nFixed: sum(rows.map((r) => r.nFixed)),
    },
    rows,
  };
}
