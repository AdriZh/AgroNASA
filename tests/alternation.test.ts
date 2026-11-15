// G-R9: the top-ranked alternative is never a same-crop / same-family succession while a feasible alternation exists;
// group alternation (cereal ↔ legume ↔ oilseed) is credited; the usual plan stays the baseline, flagged.
import { describe, expect, it } from 'vitest';
import type { FarmScenario } from '../src/domain/types';
import { isRepeat, runEngine } from '../src/engine/plan';
import { detectPack, SENEGAL } from '../src/data/regionPacks';
import { effectiveSoil } from '../src/soil/soil';
import { DEMO_KAZAKHSTAN, DEMO_SENEGAL } from '../src/state/demo';
import bambey from '../src/data/demo/bambey.json';
import kostanay from '../src/data/demo/kostanay.json';

const run = (sc: FarmScenario, d: any) => runEngine(sc, d.series, effectiveSoil(sc.soil.texture, d.soil), detectPack(sc.location.lat, sc.location.lon));
const DEMOS: [string, FarmScenario, any][] = [['Senegal', DEMO_SENEGAL, bambey], ['Kazakhstan', DEMO_KAZAKHSTAN, kostanay]];
const PRIORITIES: FarmScenario['priority'][] = ['cost', 'climate', 'continuity', 'return', 'soil'];

describe('G-R9: no same-crop or same-family top pick while an alternation is feasible', () => {
  for (const [name, demo, d] of DEMOS) for (const priority of PRIORITIES) {
    it(`${name}, priority ${priority}`, () => {
      const out = run({ ...structuredClone(demo), priority }, d);
      const feasible = out.allPlans.filter((p) => p.feasible);
      expect(feasible.some((p) => !isRepeat(p))).toBe(true);
      expect(out.alternatives.length).toBeGreaterThan(0);
      expect(isRepeat(out.alternatives[0])).toBe(false);
      const [a, b] = out.alternatives[0].crops;
      expect(a).not.toBe(b);
    });
  }
  it('a cheaper same-family plan does not beat a dearer alternation under the cost priority', () => {
    // Senegal demo: Sorghum → Sesame (337,200) follows last season's millet (same family, shared Striga host).
    const out = run(structuredClone(DEMO_SENEGAL), bambey);
    const ss = out.allPlans.find((p) => p.id === 'sorghum→sesame')!;
    expect(ss.feasible).toBe(true);
    expect(ss.reasons.some((r) => r.code === 'SAME_FAMILY' && /last season/.test(r.text))).toBe(true);
    expect(out.alternatives.map((p) => p.id)).not.toContain('sorghum→sesame');
  });
});

describe('G-R9: alternation is preferred and explained', () => {
  it('Senegal best fit alternates groups across the season boundary and says so', () => {
    const out = run(structuredClone(DEMO_SENEGAL), bambey);
    const best = out.alternatives[0];
    expect(best.id).toBe('sesame→millet');
    expect(best.budget.totalCash).toBe(327000);
    const alt = best.reasons.filter((r) => r.code === 'ALTERNATION' && r.severity === 'good');
    expect(alt.length).toBe(2);
    expect(alt[0].text).toMatch(/last season's Pearl millet/);
    expect(alt[0].refs).toContain('G-R9');
  });
  it('with only barley and flax to sell, the flax alternation outranks barley after wheat', () => {
    // Only Kazakh cereals and an oilseed: wheat history → barley is same family, flax is an alternation.
    const sc: FarmScenario = { ...structuredClone(DEMO_KAZAKHSTAN), marketCrops: ['barley', 'flax'], allowFallow: false, availableFunds: 1e12, reserve: 0 };
    const out = run(sc, kostanay);
    expect(out.alternatives[0].id).toBe('flax→barley');
    expect(out.alternatives[0].reasons.filter((r) => r.code === 'ALTERNATION').length).toBe(2);
    const bf = out.allPlans.find((p) => p.id === 'barley→flax')!;
    expect(bf.feasible).toBe(true);
    expect(isRepeat(bf)).toBe(true);
  });
});

describe('G-R9: the usual plan stays the baseline', () => {
  it('Senegal usual plan and headline numbers are untouched', () => {
    const out = run(structuredClone(DEMO_SENEGAL), bambey);
    expect(out.baseline.isBaseline).toBe(true);
    expect(out.baseline.crops).toEqual(['groundnut', 'millet']);
    expect(out.baseline.budget.totalCash).toBe(454500);
    expect(Math.round(out.baseline.budget.headroom)).toBe(-74500);
  });
  it('a repeating usual plan is still the baseline, flagged, and never an alternative', () => {
    const out = run(structuredClone(DEMO_KAZAKHSTAN), kostanay);
    expect(out.baseline.crops).toEqual(['wheat', 'wheat']);
    expect(out.baseline.reasons.some((r) => r.code === 'MONOCULTURE')).toBe(true);
    expect(out.alternatives.some((p) => p.id === 'wheat→wheat')).toBe(false);
  });
});

describe('G-R9: all-same-family fallback', () => {
  it('when only same-family plans are feasible, they are shown with the warning rather than nothing', () => {
    const sc: FarmScenario = { ...structuredClone(DEMO_SENEGAL), marketCrops: ['millet', 'sorghum'], availableFunds: 1e9, reserve: 0 };
    const out = run(sc, bambey);
    expect(out.pack.id).toBe(SENEGAL.id);
    expect(out.alternatives.length).toBeGreaterThan(0);
    for (const p of out.alternatives) {
      expect(isRepeat(p)).toBe(true);
      expect(p.reasons.some((r) => r.code === 'SAME_FAMILY' && r.severity === 'warn' && r.refs.includes('G-R7'))).toBe(true);
    }
  });
});

describe('soil-benefit goal', () => {
  for (const [name, demo, d] of DEMOS) it(`${name}: the top pick is an alternation with a rotation benefit`, () => {
    const out = run({ ...structuredClone(demo), priority: 'soil' }, d);
    expect(out.alternatives.length).toBeGreaterThan(0);
    const top = out.alternatives[0];
    expect(isRepeat(top)).toBe(false);
    expect(top.reasons.some((r) => ['BREAK_CROP', 'ALTERNATION', 'LEGUME_BENEFIT', 'FALLOW_BENEFIT'].includes(r.code) || r.severity === 'good')).toBe(true);
  });
});
