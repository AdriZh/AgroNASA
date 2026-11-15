// G-R9: the top-ranked alternative is never a same-crop / same-family succession while a feasible alternation exists;
// group alternation (cereal ↔ legume ↔ oilseed) is credited; the usual plan stays the baseline, flagged.
import { describe, expect, it } from 'vitest';
import type { FarmScenario, Priority, PriorityWeights } from '../src/domain/types';
import { DEFAULT_WEIGHTS, planValue, PRIORITY_KEYS, rotationBenefit, rotationPenalty, weightsFromPriority } from '../src/engine/plan';
import { isRepeat, runEngine } from '../src/engine/plan';
import { detectPack, SENEGAL } from '../src/data/regionPacks';
import { effectiveSoil } from '../src/soil/soil';
import { DEMO_KAZAKHSTAN, DEMO_SENEGAL } from '../src/state/demo';
import bambey from '../src/data/demo/bambey.json';
import kostanay from '../src/data/demo/kostanay.json';
import { loadFaostat } from '../src/data/countries';

// prices must be loaded before any describe body runs an engine (beforeAll in setup.ts runs later)
await loadFaostat();

const run = (sc: FarmScenario, d: any) => runEngine(sc, d.series, effectiveSoil(sc.soil.texture, d.soil), detectPack(sc.location.lat, sc.location.lon));
const DEMOS: [string, FarmScenario, any][] = [['Senegal', DEMO_SENEGAL, bambey], ['Kazakhstan', DEMO_KAZAKHSTAN, kostanay]];
// every single-criterion slider setting, plus the balanced default
const only = (k: Priority): PriorityWeights => ({ delta: 0.85, cost: 0, climate: 0, continuity: 0, soil: 0, [k]: 1 });
const PRESETS: [string, PriorityWeights][] = [...PRIORITY_KEYS.map((k) => [`only ${k}`, only(k)] as [string, PriorityWeights]), ['balanced default', DEFAULT_WEIGHTS]];

describe('G-R9: no same-crop or same-family top pick while an alternation is feasible', () => {
  for (const [name, demo, d] of DEMOS) for (const [label, weights] of PRESETS) {
    it(`${name}, weights ${label}`, () => {
      const out = run({ ...structuredClone(demo), weights }, d);
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
    // ranked by discounted expected profit: sesame → cowpea earns ≈ 61,000 XOF more than sesame → millet
    expect(best.id).toBe('sesame→cowpea');
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
    const out = run({ ...structuredClone(demo), weights: only('soil') }, d);
    expect(out.alternatives.length).toBeGreaterThan(0);
    const top = out.alternatives[0];
    expect(isRepeat(top)).toBe(false);
    expect(top.reasons.some((r) => ['BREAK_CROP', 'ALTERNATION', 'LEGUME_BENEFIT', 'FALLOW_BENEFIT'].includes(r.code) || r.severity === 'good')).toBe(true);
  });
});

describe('ranking = discounted expected profit', () => {
  const out = run(structuredClone(DEMO_KAZAKHSTAN), kostanay);
  const feasible = out.allPlans.filter((p) => p.feasible && p.finance.expectedProfit != null);
  const profitOnly: PriorityWeights = { delta: 0.99, cost: 0, climate: 0, continuity: 0, soil: 0 };

  it('with no concerns and almost no discounting, the value is the expected profit', () => {
    for (const p of feasible) {
      const v = planValue(p, profitOnly);
      const scale = v.revenuePV + v.costPV;
      expect(Math.abs(v.value - p.finance.expectedProfit!)).toBeLessThan(0.03 * scale);
    }
  });

  it('closer cash flows are discounted less', () => {
    const p = structuredClone(feasible.find((x) => x.seasons[1].maturity > x.seasons[0].maturity)!);
    const R = 1_000_000;
    const at = (k: 0 | 1) => {
      const q = structuredClone(p);
      q.finance.seasons = q.finance.seasons.map((s, i) => ({ ...s, revenueMean: i === k ? R : 0, revenueBad: i === k ? R : 0 }));
      return planValue(q, { ...profitOnly, delta: 0.6 }).revenuePV;
    };
    expect(at(0)).toBeGreaterThan(at(1));
    expect(at(0)).toBeLessThan(R);
    const lowDelta = planValue(p, { ...profitOnly, delta: 0.5 }), highDelta = planValue(p, { ...profitOnly, delta: 0.99 });
    expect(lowDelta.revenuePV).toBeLessThan(highDelta.revenuePV);
    expect(lowDelta.costPV).toBeLessThan(highDelta.costPV);
  });

  it('each concern moves the value in its direction', () => {
    for (const p of feasible.slice(0, 15)) {
      const v0 = planValue(p, profitOnly).value;
      expect(planValue(p, { ...profitOnly, climate: 1 }).value).toBeLessThanOrEqual(v0 + 1e-6); // bad year ≤ average
      expect(planValue(p, { ...profitOnly, cost: 1 }).value).toBeLessThan(v0);                    // tying up cash costs
      expect(planValue(p, { ...profitOnly, continuity: 1 }).value).toBeLessThanOrEqual(v0 + 1e-6);
      expect(planValue(p, { ...profitOnly, soil: 1 }).value).toBeGreaterThanOrEqual(v0 - 1e-6);
      if (rotationBenefit(p) > 0) expect(planValue(p, { ...profitOnly, soil: 1 }).value).toBeGreaterThan(v0);
    }
  });

  it('the best fit has the highest value among plans of equal rotation quality', () => {
    for (const w of [DEFAULT_WEIGHTS, profitOnly, only('climate'), only('continuity')]) {
      const top = run({ ...structuredClone(DEMO_KAZAKHSTAN), weights: w }, kostanay).alternatives[0];
      const peers = feasible.filter((p) => !isRepeat(p) && rotationPenalty(p) === rotationPenalty(top));
      expect(planValue(top, w).value).toBeCloseTo(Math.max(...peers.map((p) => planValue(p, w).value)), 6);
    }
  });

  it('a plan with a missing price ranks after every plan with a value', () => {
    const p = structuredClone(feasible[0]);
    p.finance.expectedProfit = null;
    expect(planValue(p, DEFAULT_WEIGHTS).value).toBe(-Infinity);
  });

  it('legacy single priority: that concern at 100 %, the others at 20 % ("return" = profit only)', () => {
    expect(weightsFromPriority('soil')).toEqual({ delta: DEFAULT_WEIGHTS.delta, cost: 0.2, climate: 0.2, continuity: 0.2, soil: 1 });
    expect(weightsFromPriority('return')).toEqual({ delta: DEFAULT_WEIGHTS.delta, cost: 0.2, climate: 0.2, continuity: 0.2, soil: 0.2 });
  });
});
