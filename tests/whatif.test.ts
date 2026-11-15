// "What-if climate" stress test: delta-change perturbation of the NASA POWER record, replayed through
// the unchanged engine.
import { describe, expect, it } from 'vitest';
import type { DailySeries } from '../src/domain/types';
import { runEngine } from '../src/engine/plan';
import { describeWhatIf, isRobust, normalizeWhatIf, perturbSeries, replayPlans, stressHeadline, stressTest, WHATIF_NONE } from '../src/engine/whatif';
import { simulateSeason } from '../src/weather/waterBalance';
import { et0Series } from '../src/weather/et0';
import { detectPack } from '../src/data/regionPacks';
import { CROPS, cropFor } from '../src/data/crops';
import { DEMO_KAZAKHSTAN, DEMO_SENEGAL } from '../src/state/demo';
import { effectiveSoil } from '../src/soil/soil';
import { loadFaostat } from '../src/data/countries';
import bambey from '../src/data/demo/bambey.json';
import kostanay from '../src/data/demo/kostanay.json';

// Prices come from the lazily loaded FAOSTAT table, as in the app (AppContext loads it at startup).
await loadFaostat();

const DEMOS = [
  { sc: DEMO_SENEGAL, d: bambey as any },
  { sc: DEMO_KAZAKHSTAN, d: kostanay as any },
].map(({ sc, d }) => {
  const s = d.series as DailySeries;
  const soil = effectiveSoil(sc.soil.texture, d.soil);
  const pack = detectPack(sc.location.lat, sc.location.lon, sc.countryIso2);
  return { sc, s, soil, pack, base: runEngine(sc, s, soil, pack) };
});
const sum = (a: ArrayLike<number>) => { let t = 0; for (let i = 0; i < a.length; i++) if (Number.isFinite(a[i])) t += a[i]; return t; };

describe('perturbSeries (delta change on the NASA POWER daily record)', () => {
  const { s } = DEMOS[0];
  it('scales precipitation, shifts T2M / T2M_MAX / T2M_MIN, keeps gaps and never mutates the input', () => {
    const before = JSON.stringify([s.P.slice(0, 400), s.T.slice(0, 400)]);
    const p = perturbSeries(s, { rainScale: 0.85, dT: 2 });
    expect(JSON.stringify([s.P.slice(0, 400), s.T.slice(0, 400)])).toBe(before);
    for (let i = 0; i < s.n; i += 97) {
      if (s.P[i] == null) expect(p.P[i]).toBeNull(); else expect(p.P[i]).toBeCloseTo(s.P[i]! * 0.85, 10);
      if (s.TX[i] != null) expect(p.TX[i]).toBeCloseTo(s.TX[i]! + 2, 10);
      if (s.TN[i] != null) expect(p.TN[i]).toBeCloseTo(s.TN[i]! + 2, 10);
      if (s.T[i] != null) expect(p.T[i]).toBeCloseTo(s.T[i]! + 2, 10);
    }
    expect(p.RH).toBe(s.RH); expect(p.WS).toBe(s.WS); expect(p.RS).toBe(s.RS); // humidity, wind, radiation unchanged
    expect(p.n).toBe(s.n);
  });
  it('ET₀ is recomputed from the shifted temperatures (FAO-56) and rises with warming', () => {
    const e0 = sum(et0Series(s));
    const e2 = sum(et0Series(perturbSeries(s, { rainScale: 1, dT: 2 })));
    expect(e2).toBeGreaterThan(e0 * 1.02);
    // rain scaling alone does not change ET₀
    expect(sum(et0Series(perturbSeries(s, { rainScale: 0.7, dT: 0 })))).toBeCloseTo(e0, 6);
  });
  it('normalizes to the slider grid and limits', () => {
    expect(normalizeWhatIf({ rainScale: 0.8499, dT: 2.2 })).toEqual({ rainScale: 0.85, dT: 2 });
    expect(normalizeWhatIf({ rainScale: 0.1, dT: 9 })).toEqual({ rainScale: 0.7, dT: 3 });
    expect(normalizeWhatIf({ rainScale: NaN, dT: -1 })).toEqual({ rainScale: 1, dT: 0 });
    expect(describeWhatIf({ rainScale: 0.85, dT: 2 })).toBe('15% drier and 2 °C hotter');
  });
});

describe('stress test reuses the existing replay pipeline', () => {
  it.each(DEMOS.map((x) => [x.sc.id, x] as const))('%s: rainScale = 1 and ΔT = 0 gives results identical to the baseline replay', (_id, { sc, s, soil, pack, base }) => {
    const shown = [base.baseline, ...base.alternatives];
    const again = replayPlans(sc, perturbSeries(s, WHATIF_NONE), soil, pack, shown, base.baseline.crops);
    for (const p of shown) {
      const q = again.get(p.id)!;
      expect(q).toBeDefined();
      expect(q.outcome).toEqual(p.outcome);
      expect(q.seasons.map((x) => x.risk?.years.map((y) => y.relYield))).toEqual(p.seasons.map((x) => x.risk?.years.map((y) => y.relYield)));
    }
    const r = stressTest(sc, s, soil, pack, base, WHATIF_NONE);
    for (const p of r.plans) { expect(p.severe[1]).toBe(p.severe[0]); expect(p.harvestChange).toBe(0); }
  });

  it.each(DEMOS.map((x) => [x.sc.id, x] as const))('%s: drier never increases the ETa-limited yield of any crop-season (same sowing date)', (_id, { s, soil, pack, base }) => {
    const dry = perturbSeries(s, { rainScale: 0.8, dT: 0 });
    let checked = 0;
    for (const r of Object.values(base.risks)) {
      const crop = cropFor(pack, r.cropId);
      for (const y of r.years) {
        const a = simulateSeason(s, crop, y.sowing, soil.awcMmPerM);
        const b = simulateSeason(dry, crop, y.sowing, soil.awcMmPerM);
        expect(b.etaMm).toBeLessThanOrEqual(a.etaMm + 1e-9);
        expect(b.relYield).toBeLessThanOrEqual(a.relYield + 1e-9);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(100);
  });

  it.each(DEMOS.map((x) => [x.sc.id, x] as const))('%s: drier never lowers severe-stress risk or the median harvest of a displayed plan', (_id, { sc, s, soil, pack, base }) => {
    for (const rainScale of [0.95, 0.85, 0.7]) {
      const r = stressTest(sc, s, soil, pack, base, { rainScale, dT: 0 });
      expect(r.plans.length).toBe(1 + base.alternatives.length);
      for (const p of r.plans) {
        expect(p.pairs[1]).toBe(p.pairs[0]);
        expect(p.severe[1]).toBeGreaterThanOrEqual(p.severe[0]);
        expect(p.medianRel[1]).toBeLessThanOrEqual(p.medianRel[0] + 1e-9);
      }
    }
  });

  it('a hotter climate shifts heat and ET₀ but plan ids stay identical (like-for-like comparison)', () => {
    const { sc, s, soil, pack, base } = DEMOS[1];
    const shown = [base.baseline, ...base.alternatives];
    const hot = replayPlans(sc, perturbSeries(s, { rainScale: 1, dT: 3 }), soil, pack, shown, base.baseline.crops);
    for (const p of shown) expect(hot.get(p.id)?.crops).toEqual(p.crops);
  });

  it('headline states only what the replay shows (Kazakhstan demo, −15% / +2 °C)', () => {
    const { sc, s, soil, pack, base } = DEMOS[1];
    const r = stressTest(sc, s, soil, pack, base, { rainScale: 0.85, dT: 2 });
    const h = stressHeadline(r)!;
    const usual = r.plans.find((p) => p.isBaseline)!;
    const robustAlt = r.plans.find((p) => !p.isBaseline && isRobust(p));
    if (robustAlt && !isRobust(usual)) expect(h).toContain(`${robustAlt.label} stays robust`);
    expect(h).toContain('15% drier and 2 °C hotter');
    expect(stressHeadline(stressTest(sc, s, soil, pack, base, WHATIF_NONE))).toBeNull();
  });

  it('runs fast enough to feel live', () => {
    const { sc, s, soil, pack, base } = DEMOS[0];
    stressTest(sc, s, soil, pack, base, { rainScale: 0.9, dT: 1 }); // warm-up
    const r = stressTest(sc, s, soil, pack, base, { rainScale: 0.85, dT: 2 });
    expect(r.ms).toBeLessThan(400);
    expect(CROPS[r.plans[0].crops[0]]).toBeDefined();
  });
});
