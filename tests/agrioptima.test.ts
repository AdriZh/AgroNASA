// AgriOptima soil-N / multi-year rotation layer: INRAE tree surrogates evaluated in the browser.
import { describe, expect, it } from 'vitest';
import bundleJson from '../src/data/agrioptima/model.json';
import parity from './fixtures/agrioptima_parity.json';
import { predict, validateBundle } from '../src/engine/agrioptima/model';

const bundle = validateBundle(bundleJson);
const rows = (parity.rows as (number | null)[][]).map((r) => Float64Array.from(r, (v) => (v == null ? NaN : v)));

describe('tree evaluator parity with the Python trainer (ml/export_model.py)', () => {
  it('reproduces XGBoost yield and N-uptake predictions, including rows with missing soil data', () => {
    const p = predict(bundle, rows);
    expect(rows.some((r) => r.some(Number.isNaN))).toBe(true);
    p.yieldTHa.forEach((v, i) => expect(v / parity.yield[i]).toBeCloseTo(1, 5));
    p.nUptake.forEach((v, i) => expect(v / parity.n_uptake[i]).toBeCloseTo(1, 5));
  });

  it('rejects a bundle with the wrong format', () => {
    expect(() => validateBundle({ format: 'other' })).toThrow();
    expect(() => validateBundle(null)).toThrow();
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Engine on the bundled demo farms
// ---------------------------------------------------------------------------------------------------------------
import type { DailySeries, FarmScenario } from '../src/domain/types';
import { runEngine } from '../src/engine/plan';
import { detectPack, PACKS } from '../src/data/regionPacks';
import { DEMO_KAZAKHSTAN, DEMO_SENEGAL } from '../src/state/demo';
import { effectiveSoil } from '../src/soil/soil';
import { loadFaostat } from '../src/data/countries';
import kostanay from '../src/data/demo/kostanay.json';
import bambey from '../src/data/demo/bambey.json';
import { blockedBy, buildContext, DEFAULT_WEIGHTS, rank, seasonsPerYear, simulateAll, simulateSequence, utilityOf } from '../src/engine/agrioptima/engine';
import { hargreaves, seasonClimate } from '../src/engine/agrioptima/climate';
import { MAX_TREE_ROWS } from '../src/engine/agrioptima/params';
import { sanitizeSettings, DEFAULT_SETTINGS } from '../src/state/useAgri';

await loadFaostat();

function setup(sc: FarmScenario, d: any, packId?: string) {
  const s = d.series as DailySeries;
  const soil = effectiveSoil(sc.soil.texture, d.soil);
  const pack = packId ? PACKS.find((p) => p.id === packId)! : detectPack(sc.location.lat, sc.location.lon, sc.countryIso2);
  const engine = runEngine(sc, s, soil, pack);
  return { sc, s, soil, engine, ctx: buildContext(bundle, sc, engine, s, soil) };
}
const KZ = setup(DEMO_KAZAKHSTAN, kostanay);
const SN = setup(DEMO_SENEGAL, bambey);
const row = (r: ReturnType<typeof simulateSequence>) => r!.rows;

describe('climate features', () => {
  it('Hargreaves ET0 is in a physical range and zero without a diurnal range', () => {
    const summer = hargreaves(15, 30, 196, 45);
    expect(summer).toBeGreaterThan(4);
    expect(summer).toBeLessThan(8);
    expect(hargreaves(20, 20, 196, 45)).toBe(0);
  });
  it('averages complete NASA POWER seasons into finite features', () => {
    const c = seasonClimate(KZ.s, '05-12', 100)!;
    expect(c.gs_precip_mm).toBeGreaterThan(50);
    expect(c.gs_mean_temp_c).toBeGreaterThan(10);
    expect(c.gs_water_balance_mm).toBeCloseTo(c.gs_precip_mm - c.gs_pet_mm, 6);
  });
});

describe('coverage', () => {
  it('Kostanay: trial crops and mixtures are modeled, others are listed as not covered', () => {
    const ids = KZ.ctx.options.map((o) => o.id);
    for (const c of ['wheat', 'barley', 'lentil', 'pea', 'chickpea', 'wheat+pea']) expect(ids).toContain(c);
    for (const c of ['oats', 'flax', 'sunflower']) expect(KZ.ctx.uncovered.map((u) => u.cropId)).toContain(c);
    expect(KZ.ctx.options.every((o) => o.family === 'fallow' || o.calibrated)).toBe(true);
  });
  it('Sahel: no crop is in the trials, so nothing is modeled (no invented numbers)', () => {
    expect(SN.ctx.options.filter((o) => o.family !== 'fallow')).toHaveLength(0);
    expect(SN.ctx.uncovered.length).toBeGreaterThan(3);
  });
  it('honours the allowed-crops list (and a legacy sellable-crops list)', () => {
    const sc = { ...DEMO_KAZAKHSTAN, unavailableCrops: ['chickpea'], marketCrops: ['wheat', 'barley', 'pea'] };
    const { ctx } = setup(sc, kostanay);
    const ids = ctx.options.map((o) => o.id);
    expect(ids).not.toContain('chickpea');
    expect(ids).not.toContain('lentil');
    expect(ctx.uncovered.find((u) => u.cropId === 'chickpea')?.reason).toMatch(/allowed crops/);
  });
});

describe('soil-N state transition', () => {
  const ctx = KZ.ctx;
  it('a legume leaves more mineral N for the next crop than a cereal, and fixes N', () => {
    const pea = row(simulateSequence(ctx, ['pea'], { soilN: 50 }))[0];
    const wheat = row(simulateSequence(ctx, ['wheat'], { soilN: 50 }))[0];
    expect(pea.soilNEnd).toBeGreaterThan(wheat.soilNEnd);
    expect(pea.nFixed).toBeGreaterThan(0);
    expect(wheat.nFixed).toBe(0);
    expect(pea.nFert).toBe(0);
  });
  it('fertilizer follows the balance sheet: more soil N, less fertilizer (never negative)', () => {
    const lo = row(simulateSequence(ctx, ['wheat'], { soilN: 0 }))[0];
    const hi = row(simulateSequence(ctx, ['wheat'], { soilN: 200 }))[0];
    expect(lo.nFert).toBeGreaterThan(0);
    expect(hi.nFert).toBe(0);
    expect(lo.co2e).toBeGreaterThan(hi.co2e);
  });
  it('wheat after a legume out-yields wheat after wheat (pre-crop and monoculture effects)', () => {
    const afterPea = row(simulateSequence(ctx, ['pea', 'wheat'], { soilN: 50 }))[1];
    const afterWheat = row(simulateSequence(ctx, ['wheat', 'wheat'], { soilN: 50 }))[1];
    expect(afterPea.yieldTHa).toBeGreaterThan(afterWheat.yieldTHa);
  });
  it('flags a usual plan that breaks Field Shift rules without dropping it', () => {
    const r = simulateSequence(ctx, ['wheat', 'wheat'], { soilN: 50 })!;
    expect(r.blocked).toMatch(/G-R6/);
    expect(r.rows).toHaveLength(2);
  });
  it('returns null for crops outside the trials', () => {
    expect(simulateSequence(ctx, ['sunflower', 'wheat'], { soilN: 50 })).toBeNull();
  });
});

describe('multi-season optimizer', () => {
  const sim = simulateAll(KZ.ctx, 4, { soilN: 50 });
  it('only produces rotations Field Shift’s rules allow, each once', () => {
    expect(sim.paths.length).toBeGreaterThan(50);
    const hist = KZ.ctx.history.map((c) => [c]);
    const keys = new Set<string>();
    for (const p of sim.paths) {
      const seq = [...p].map((k) => KZ.ctx.options[k].crops);
      seq.forEach((c, t) => expect(blockedBy(KZ.ctx, [...hist, ...seq.slice(0, t)], c)).toBeNull());
      keys.add(p.join());
    }
    expect(keys.size).toBe(sim.paths.length);
  });
  it('is deterministic and the top plan maximises utility', () => {
    const a = rank(sim, DEFAULT_WEIGHTS, 5), b = rank(simulateAll(KZ.ctx, 4, { soilN: 50 }), DEFAULT_WEIGHTS, 5);
    expect(a.plans.map((p) => p.options.join())).toEqual(b.plans.map((p) => p.options.join()));
    for (let i = 1; i < a.plans.length; i++) expect(a.plans[i - 1].utility).toBeGreaterThanOrEqual(a.plans[i].utility);
    expect(a.plans.some((p) => p.pareto)).toBe(true);
  });
  it('the sliders move the choice: valuing emissions never raises the top plan’s emissions', () => {
    const wCash = { delta: 0.85, wSoilUsd: 0, wCarbonUsdPerT: 0 };
    const cash = rank(sim, wCash, 1).plans[0];
    const green = rank(sim, { ...wCash, wCarbonUsdPerT: 300 }, 1).plans[0];
    expect(green.totals.co2e).toBeLessThanOrEqual(cash.totals.co2e);
    // under cash-only weights the cash winner scores at least as well as the green winner
    expect(cash.utility).toBeGreaterThanOrEqual(utilityOf(KZ.ctx, green.rows, 1, wCash) - 1e-6);
  });
  it('mixtures can be switched off', () => {
    const noMix = simulateAll(KZ.ctx, 3, { soilN: 50, intercrops: false });
    expect(noMix.paths.every((p) => [...p].every((k) => !KZ.ctx.options[k].isIntercrop))).toBe(true);
  });
  it('a 5-year search stays inside the row cap and is fast', () => {
    const t = performance.now();
    const big = simulateAll(KZ.ctx, 5, { soilN: 50 });
    expect(big.evaluatedRows).toBeLessThanOrEqual(MAX_TREE_ROWS);
    expect(performance.now() - t).toBeLessThan(3000);
  });
  it('double-season packs alternate only between seasons that have modeled crops', () => {
    const sa = setup({ ...DEMO_KAZAKHSTAN, regionPackId: 'sas-kharif-rabi' }, kostanay, 'sas-kharif-rabi');
    expect(sa.ctx.modeledWindows.length).toBe(1); // rabi only: kharif crops are not in the trials
    expect(seasonsPerYear(sa.ctx)).toBe(1);
    const s2 = simulateAll(sa.ctx, 2, { soilN: 50 });
    expect(s2.paths.length).toBeGreaterThan(0);
  });
});

describe('settings from device storage are validated', () => {
  it('clamps out-of-range numbers and replaces garbage with defaults', () => {
    const s = sanitizeSettings({ delta: 7, wSoilUsd: -3, wCarbonUsdPerT: 'x', soilN: 1e9, years: 2.6, intercrops: 'yes', extra: '<script>' });
    expect(s).toEqual({ wSoilUsd: 0, wCarbonUsdPerT: DEFAULT_SETTINGS.wCarbonUsdPerT, soilN: 250, years: 3, intercrops: true });
    expect(sanitizeSettings(null)).toEqual(DEFAULT_SETTINGS);
  });
});

// ---------------------------------------------------------------------------------------------------------------
// Calibration to the farmer's recorded yields
// ---------------------------------------------------------------------------------------------------------------
import { calibrateYields, factorFor, MAX_RATIO, PRIOR_SEASONS } from '../src/engine/agrioptima/calibration';

describe('past-yield calibration', () => {
  const withYields = (mult: (modeled: number, i: number) => number | null, extra: Partial<FarmScenario> = {}): FarmScenario => {
    const probe = calibrateYields({ ...DEMO_KAZAKHSTAN, history: DEMO_KAZAKHSTAN.history.map((h) => ({ ...h, yieldTHa: 1 })) }, KZ.engine);
    return { ...DEMO_KAZAKHSTAN, ...extra, history: DEMO_KAZAKHSTAN.history.map((h, i) => ({ ...h, yieldTHa: mult(probe.obs[i].modeled, i) })) };
  };

  it('no recorded yields: no adjustment', () => {
    const c = calibrateYields(DEMO_KAZAKHSTAN, KZ.engine);
    expect(c.obs).toHaveLength(0);
    expect(c.fieldFactor).toBe(1);
    expect(factorFor(c, 'wheat')).toBe(1);
  });

  it('compares each season with the replay for that crop and year (later years vs a typical year)', () => {
    const c = calibrateYields(withYields((m) => m), KZ.engine);
    expect(c.obs).toHaveLength(3);
    for (const o of c.obs) expect(o.ratio).toBeCloseTo(1, 9);
    expect(c.fieldFactor).toBeCloseTo(1, 9);
    const recordYears = new Set(Object.values(KZ.engine.risks)[0].years.map((y) => y.year));
    for (const o of c.obs) expect(o.typicalYear).toBe(!recordYears.has(o.year));
  });

  it('pools log-ratios with shrinkage toward 1', () => {
    const c = calibrateYields(withYields((m) => 1.5 * m), KZ.engine);
    const lf = (3 * Math.log(1.5)) / (3 + PRIOR_SEASONS);
    expect(c.fieldFactor).toBeCloseTo(Math.exp(lf), 9);
    expect(c.byCrop.wheat.factor).toBeCloseTo(Math.exp((3 * Math.log(1.5) + PRIOR_SEASONS * lf) / (3 + PRIOR_SEASONS)), 9);
    expect(c.fieldFactor).toBeGreaterThan(1);
    expect(c.fieldFactor).toBeLessThan(1.5);
  });

  it('caps outliers, skips zero harvests and respects a yield the farmer set in Resources', () => {
    const wild = calibrateYields(withYields((m, i) => (i === 0 ? 100 * m : i === 1 ? 0 : m)), KZ.engine);
    expect(wild.obs).toHaveLength(2);
    expect(wild.skipped[0].reason).toMatch(/zero or failed/);
    expect(wild.fieldFactor).toBeCloseTo(Math.exp(Math.log(MAX_RATIO) / (2 + PRIOR_SEASONS)), 9);
    const own = calibrateYields(withYields((m) => 2 * m, { priceOverrides: { 'wheat:yield': 2 } }), KZ.engine);
    expect(own.overridden).toEqual(['wheat']);
    expect(factorFor(own, 'wheat')).toBe(1);
  });

  it('a more productive field gets higher predicted yields and a larger balance-sheet N need', () => {
    const sc = withYields((m) => 1.6 * m);
    const hi = buildContext(bundle, sc, runEngine(sc, KZ.s, KZ.soil, KZ.engine.pack), KZ.s, KZ.soil);
    const base = row(simulateSequence(KZ.ctx, ['wheat'], { soilN: 0 }))[0];
    const cal = row(simulateSequence(hi, ['wheat'], { soilN: 0 }))[0];
    expect(cal.yieldTHa / base.yieldTHa).toBeGreaterThan(1.2);
    expect(cal.nFert).toBeGreaterThan(base.nFert);
    const wheatOpt = hi.options.find((o) => o.id === 'wheat')!;
    expect(wheatOpt.nReq).toBeCloseTo(KZ.ctx.options.find((o) => o.id === 'wheat')!.nReq * hi.yieldCal.byCrop.wheat.factor, 6);
  });
});
