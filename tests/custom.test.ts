// "Try my own plan" (evaluateRotation) and "Near misses" (budgetShortfall, smallestChange): the farmer's own
// rotation must go through exactly the same engine as the ranked plans, and every suggested change must be verified.
import { describe, expect, it } from 'vitest';
import type { FarmScenario } from '../src/domain/types';
import { runEngine } from '../src/engine/plan';
import { evaluateBudget, costLine } from '../src/engine/budget';
import { budgetShortfall, evaluateRotation, nearMisses, smallestChange, stressRotation, type EngineInputs } from '../src/engine/custom';
import { stressTest, WHATIF_PRESETS } from '../src/engine/whatif';
import { detectPack } from '../src/data/regionPacks';
import { cropName } from '../src/data/crops';
import { effectiveSoil } from '../src/soil/soil';
import { DEMO_KAZAKHSTAN, DEMO_SENEGAL } from '../src/state/demo';
import bambey from '../src/data/demo/bambey.json';
import kostanay from '../src/data/demo/kostanay.json';

const demo = (sc: FarmScenario, d: any): EngineInputs => ({ sc, series: d.series, soil: effectiveSoil(sc.soil.texture, d.soil), pack: detectPack(sc.location.lat, sc.location.lon) });
const KZ = demo(DEMO_KAZAKHSTAN, kostanay);
const SN = demo(DEMO_SENEGAL, bambey);
const run = (i: EngineInputs) => runEngine(i.sc, i.series, i.soil, i.pack);
const strip = ({ label, rank, ...p }: any) => p; // eslint-disable-line @typescript-eslint/no-unused-vars

describe('evaluateRotation: same engine as the ranked plans', () => {
  for (const [name, inp] of [['Kazakhstan', KZ], ['Senegal', SN]] as const) {
    it(`${name}: a custom plan equal to a ranked plan gives identical numbers and reasons`, () => {
      const out = run(inp);
      for (const p of [out.baseline, ...out.alternatives, ...out.allPlans]) {
        const c = evaluateRotation(inp, p.crops);
        expect(strip({ ...c, isBaseline: p.isBaseline })).toEqual(strip(p));
      }
      const best = out.alternatives[0];
      const c = evaluateRotation(inp, best.crops);
      expect(c.budget.totalCash).toBe(best.budget.totalCash);
      expect(c.budget.upfront).toBe(best.budget.upfront);
      expect(c.outcome.pSevereAny).toBe(best.outcome.pSevereAny);
      expect(c.outcome.net).toEqual(best.outcome.net);
    });
    it(`${name}: the drier & hotter result matches the ranked card's stress test`, () => {
      const out = run(inp);
      const w = WHATIF_PRESETS[0].w;
      const ref = stressTest(inp.sc, inp.series, inp.soil, inp.pack, out, w).plans;
      for (const r of ref) {
        const s = stressRotation(inp, r.crops, w);
        expect(s.severe).toEqual(r.severe);
        expect(s.pairs).toEqual(r.pairs);
        expect(s.medianRel).toEqual(r.medianRel);
      }
    });
  }

  it('a monoculture custom plan returns the MONOCULTURE block (G-R6)', () => {
    const p = evaluateRotation(KZ, ['barley', 'barley']);
    expect(p.feasible).toBe(false);
    expect(p.eligible).toBe(false);
    expect(p.reasons.some((r) => r.code === 'MONOCULTURE' && r.severity === 'block' && r.refs.includes('G-R6'))).toBe(true);
  });

  it('an unaffordable custom plan returns the budget reason with the exact gap', () => {
    const inp = { ...KZ, sc: { ...KZ.sc, availableFunds: 10_000_000, reserve: 1_000_000, confirmedInflows: [] } };
    const p = evaluateRotation(inp, ['lentil', 'wheat']);
    expect(p.budget.status).toBe('unaffordable');
    expect(p.feasible).toBe(false);
    expect(p.eligible).toBe(true); // rules pass; only the budget blocks it
    const r = p.reasons.find((x) => x.code === 'BUDGET_EXCEEDED')!;
    expect(r.severity).toBe('block');
    expect(r.text).toContain(`by ${Math.round(-p.budget.headroom).toLocaleString('en-US')} KZT`);
  });

  it('a crop outside the regional calendar is blocked honestly and never shown as cheap', () => {
    const p = evaluateRotation(KZ, ['maize', 'wheat']);
    expect(p.reasons.some((r) => r.code === 'OUT_OF_CALENDAR' && r.severity === 'block' && /Season 1 \(Maize\)/.test(r.text))).toBe(true);
    expect(p.budget.status).toBe('unverified');
    expect(p.feasible).toBe(false);
  });
});

describe('near misses: smallest verified change', () => {
  it('budgetShortfall is the exact total gap, rounded up to a whole unit', () => {
    const line = (season: 1 | 2, price: number, due: number) => costLine({ key: `k${season}${due}`, category: 'seed', label: 'x', qtyPerHa: 1, unit: 'ha', unitPrice: price, dueOffsetDays: due, essential: true, cash: true }, season, 'wheat', 1, '2027-05-15');
    const b = evaluateBudget([line(1, 50_000.4, 0), line(2, 40_000, 400)], 100_000, 27_000, [], '2027-05-15');
    expect(b.status).toBe('unaffordable');
    expect(budgetShortfall(b)).toBe(17_001); // 90,000.40 − 73,000 = 17,000.40 → 17,001
    const ok = evaluateBudget([line(1, 50_000, 0)], 100_000, 0, [], '2027-05-15');
    expect(budgetShortfall(ok)).toBe(0);
    const exact = evaluateBudget([line(1, 91_000, 0)], 100_000, 27_000, [], '2027-05-15');
    expect(budgetShortfall(exact)).toBe(18_000);
  });

  it('budgetShortfall covers a cash-timing gap that the season total hides', () => {
    const line = (price: number, due: number) => costLine({ key: `k${due}`, category: 'seed', label: 'x', qtyPerHa: 1, unit: 'ha', unitPrice: price, dueOffsetDays: due, essential: true, cash: true }, 1, 'wheat', 1, '2027-05-15');
    // 60,000 due at sowing, 20,000 later; 50,000 spendable + 40,000 arriving after sowing
    const b = evaluateBudget([line(60_000, 0), line(20_000, 60)], 50_000, 0, [{ id: 'i', date: '2027-06-30', amount: 40_000, label: 'subsidy' }], '2027-05-15');
    expect(b.status).toBe('timing');
    expect(budgetShortfall(b)).toBe(10_000);
  });

  it('a budget-blocked rotation gets "+N budget", and the engine confirms that N makes it fit (N − 1 does not)', () => {
    const out = run(KZ);
    const p = out.excluded.find((x) => x.eligible && x.budget.status === 'unaffordable')!;
    const fix = smallestChange(KZ, p);
    expect(fix.change).toBe(`+${fix.shortfall!.toLocaleString('en-US')} KZT budget`);
    const at = (extra: number) => evaluateRotation({ ...KZ, sc: { ...KZ.sc, availableFunds: KZ.sc.availableFunds + extra } }, p.crops);
    expect(at(fix.shortfall!).feasible).toBe(true);
    expect(at(fix.shortfall! - 1).feasible).toBe(false);
  });

  it('a crop not in the allowed list is suggested as "allow it in Budget & crops", verified', () => {
    const inp = { ...KZ, sc: { ...KZ.sc, unavailableCrops: ['rapeseed'] } };
    const out = run(inp);
    const p = out.allPlans.find((x) => x.id === 'fallow→rapeseed')!;
    expect(p.reasons.some((r) => r.code === 'SEED_UNAVAILABLE')).toBe(true);
    expect(smallestChange(inp, p).change).toBe(`allow ${cropName('rapeseed')} in Budget & crops`);
    expect(evaluateRotation({ ...inp, sc: { ...inp.sc, unavailableCrops: [] } }, p.crops).feasible).toBe(true);
  });

  it('replay or rotation-rule blocks get no invented change; the Kazakhstan list is never empty', () => {
    const out = run(KZ);
    const list = nearMisses(KZ, out);
    expect(list.length).toBeGreaterThanOrEqual(2);
    for (const m of list) {
      expect(m.plan.feasible).toBe(false);
      expect(m.blocks.length).toBeGreaterThan(0);
      expect(m.blocks.some((b) => ['MONOCULTURE', 'RETURN_INTERVAL', 'DISEASE_GROUP'].includes(b.code))).toBe(false);
      if (m.change == null) expect(m.blocks.some((b) => !['BUDGET_EXCEEDED', 'CASH_TIMING', 'SEED_UNAVAILABLE', 'MARKET_CONSTRAINT'].includes(b.code))).toBe(true);
    }
    const climate = out.excluded.find((x) => x.reasons.some((r) => r.code === 'CLIMATE_UNSUITABLE'));
    if (climate) expect(smallestChange(KZ, climate).change).toBeNull();
  });
});
